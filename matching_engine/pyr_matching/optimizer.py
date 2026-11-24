"""Capacity-constrained global assignment (P6-C port).

Port of `src/features/optimizer/solveAssignments.ts`: successive shortest augmenting paths with
reduced costs + Dijkstra. Flow (number of placed students) is maximised first; among
maximum-cardinality solutions the total score is maximised (cost = 10000 - score*100, scores at
two decimals). Graph construction is sorted by identifier and the heap is ordered by
(distance, node id), so exact ties resolve deterministically regardless of input order.

Two entry points:
* `min_cost_assignment` – generic core used by the PyR pipeline (direct proposals, opt-in simulation).
* `solve_assignments` – faithful port of the TS function and its validation rules, used for parity tests.
"""
from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Any, Iterable

from .text import js_round


@dataclass(frozen=True)
class Edge:
    student_id: str
    vacancy_id: str
    score: float  # 0..100, two decimals
    payload: Any = None


def _valid_score(score: Any) -> bool:
    return (
        isinstance(score, (int, float))
        and not isinstance(score, bool)
        and math.isfinite(score)
        and 0 <= score <= 100
        and abs(score * 100 - js_round(score * 100)) <= 1e-7
    )


def min_cost_assignment(student_ids: Iterable[str], capacities: dict[str, int], edges: Iterable[Edge], sort_edges: bool = True) -> list[Edge]:
    """Return the chosen edges (one per student at most, capacity respected).

    `edges` must already be filtered by hard constraints: the optimiser never decides eligibility.
    """
    students = sorted(set(student_ids))
    vacancies = sorted(capacities)
    edges = sorted(edges, key=lambda e: (e.student_id, e.vacancy_id)) if sort_edges else list(edges)
    s_node = {s: i + 1 for i, s in enumerate(students)}
    v_node = {v: len(students) + i + 1 for i, v in enumerate(vacancies)}
    size = 2 + len(students) + len(vacancies)
    sink = size - 1
    # adjacency: [to, reverse_index, capacity, cost, edge]
    graph: list[list[list]] = [[] for _ in range(size)]

    def add(u: int, v: int, cap: int, cost: int, row: Edge | None = None):
        graph[u].append([v, len(graph[v]), cap, cost, row])
        graph[v].append([u, len(graph[u]) - 1, 0, -cost, None])

    for s in students:
        add(0, s_node[s], 1, 0)
    for v in vacancies:
        cap = capacities[v]
        if not isinstance(cap, int) or cap < 0:
            raise ValueError(f"Capacidad inválida para {v}.")
        add(v_node[v], sink, cap, 0)
    seen: set[tuple[str, str]] = set()
    for e in edges:
        if e.student_id not in s_node or e.vacancy_id not in v_node:
            continue
        if not _valid_score(e.score):
            raise ValueError("Score inválido en una arista del optimizador.")
        key = (e.student_id, e.vacancy_id)
        if key in seen:
            raise ValueError("Parejas duplicadas en la ejecución.")
        seen.add(key)
        add(s_node[e.student_id], v_node[e.vacancy_id], 1, 10000 - int(js_round(e.score * 100)), e)

    potential = [0] * size
    INF = math.inf
    while True:
        dist = [INF] * size
        prev_node = [-1] * size
        prev_edge = [-1] * size
        dist[0] = 0
        heap = [(0, 0)]
        while heap:
            d, u = heapq.heappop(heap)
            if d != dist[u]:
                continue
            for i, e in enumerate(graph[u]):
                if not e[2]:
                    continue
                nd = d + e[3] + potential[u] - potential[e[0]]
                if nd < dist[e[0]]:
                    dist[e[0]] = nd
                    prev_node[e[0]] = u
                    prev_edge[e[0]] = i
                    heapq.heappush(heap, (nd, e[0]))
        if dist[sink] == INF:
            break
        for i in range(size):
            if dist[i] != INF:
                potential[i] += dist[i]
        v = sink
        while v != 0:
            e = graph[prev_node[v]][prev_edge[v]]
            e[2] -= 1
            graph[v][e[1]][2] += 1
            v = prev_node[v]
    chosen: list[Edge] = []
    for s in students:
        for e in graph[s_node[s]]:
            if e[4] is not None and e[2] == 0:
                chosen.append(e[4])
    return chosen


# ---------------------------------------------------------------------------------------------
# Faithful port of solveAssignments.ts (validation + reasons), for parity with P6-C.
# ---------------------------------------------------------------------------------------------

def solve_assignments(inp: dict, excluded_candidate_ids: Iterable[str] = ()) -> dict:
    run = inp.get("run")
    if not run or run.get("status") != "completed" or run.get("periodId") != inp["periodId"]:
        raise ValueError("Selecciona una ejecución completada del mismo periodo.")
    th = run.get("threshold")
    if th is None or not isinstance(th, (int, float)) or not math.isfinite(th) or th < 0 or th > 100:
        raise ValueError("La ejecución no tiene un umbral histórico válido.")
    period = inp["periodId"]
    students = sorted(inp["students"], key=lambda s: s["id"])
    positions = sorted(inp["positions"], key=lambda p: p["id"])
    pmap = {p["id"]: p for p in positions}
    if len({s["id"] for s in students}) != len(students) or len(pmap) != len(positions):
        raise ValueError("Identificadores duplicados en el pool.")
    occupied: dict[str, int] = {}
    available: dict[str, int] = {}
    assigned: set[str] = set()
    for a in inp["existing"]:
        if a["active"] and a["periodId"] == period:
            assigned.add(a["studentId"])
            occupied[a["positionId"]] = occupied.get(a["positionId"], 0) + 1
    for p in positions:
        cap = p["capacity"]
        if not isinstance(cap, int) or isinstance(cap, bool) or cap < 0:
            raise ValueError("Capacidad inválida.")
        if occupied.get(p["id"], 0) > cap:
            raise ValueError("La ocupación existente excede la capacidad. Requiere revisión administrativa.")
        ok = p["periodId"] == period and p["active"] and p["approved"] and p["validated"]
        available[p["id"]] = cap - occupied.get(p["id"], 0) if ok else 0
    free = [s for s in students if s["periodId"] == period and s["active"] and s["eligible"] and s["id"] not in assigned]
    free_ids = {s["id"] for s in free}
    excluded = set(excluded_candidate_ids)
    reasons: dict[str, list[str]] = {s["id"]: [] for s in free}
    candidates = []
    for c in sorted(inp["candidates"], key=lambda c: c["id"]):
        if c["studentId"] not in free_ids:
            continue
        p = pmap.get(c["positionId"])
        score = c.get("score")
        reason = ""
        if c["runId"] != run["id"]:
            reason = "Candidato de otra ejecución"
        elif not c["eligible"] or not isinstance(c.get("blockers"), list) or c["blockers"]:
            reason = "Candidato bloqueado"
        elif c.get("currentEligible") is not True:
            reason = "Restricciones actuales de programa o habilidades"
        elif not _valid_score(score):
            reason = "Score inválido"
        elif score < th:
            reason = "Score debajo del umbral histórico"
        elif not p or p["periodId"] != period:
            reason = "Plaza de otro periodo o inexistente"
        elif not p["active"] or not p["approved"] or not p["validated"] or p["capacity"] <= 0:
            reason = "Plaza no habilitada para asignación"
        elif not available.get(p["id"]):
            reason = "Sin capacidad disponible"
        elif c["id"] in excluded:
            reason = "Excluido por administración"
        if reason:
            if reason not in reasons[c["studentId"]]:
                reasons[c["studentId"]].append(reason)
            continue
        candidates.append(c)
    edges = [Edge(c["studentId"], c["positionId"], c["score"], c) for c in candidates]
    chosen = min_cost_assignment([s["id"] for s in free], {p["id"]: available[p["id"]] for p in positions}, edges, sort_edges=False)
    rows = [{"studentId": e.student_id, "positionId": e.vacancy_id, "candidateId": e.payload["id"], "score": e.score} for e in chosen]
    for r in rows:
        available[r["positionId"]] -= 1
    picked = {r["studentId"] for r in rows}
    with_candidates = {c["studentId"] for c in candidates}
    unassigned = []
    for s in free:
        if s["id"] in picked:
            continue
        if s["id"] in with_candidates:
            why = ["Capacidad distribuida por el óptimo global"]
        elif reasons[s["id"]]:
            why = list(reasons[s["id"]])
        else:
            why = ["Sin candidatos en la ejecución"]
        unassigned.append({"studentId": s["id"], "reasons": why})
    return {
        "rows": rows,
        "totalScore": js_round(sum(r["score"] for r in rows) * 100) / 100,
        "occupied": occupied,
        "available": available,
        "eligibleStudents": sum(1 for s in students if s["active"] and s["eligible"] and s["periodId"] == period),
        "unassigned": unassigned,
    }
