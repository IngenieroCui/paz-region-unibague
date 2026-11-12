"""Versioned, validated policy configuration (weights, hard-rule switches, enumerations)."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from .text import strip_accents

COMPONENTS_V02 = ("program", "skills", "semantic", "lexical", "location", "modality")
ALGORITHM_VERSION_V02 = "hybrid-pyr-v0.2"
DEFAULT_POLICY_PATH = Path(__file__).resolve().parent / "config" / "policy_pyr_provisional.json"


class PolicyError(ValueError):
    pass


def canon(value: Any) -> str | None:
    """Normalise an enumeration-like cell: 'Municipio de origen' -> 'MUNICIPIO_DE_ORIGEN'."""
    if value is None:
        return None
    return _canon_str(str(value))


@lru_cache(maxsize=65536)
def _canon_str(value: str) -> str | None:
    text = value.strip()
    if not text:
        return None
    return re.sub(r"[^A-Z0-9]+", "_", strip_accents(text).upper()).strip("_") or None


def canon_place(value: Any) -> str | None:
    """Municipality/program comparison key (accent/case/spacing-insensitive)."""
    c = canon(value)
    return c


def canon_modality(value: Any) -> str | None:
    c = canon(value)
    if not c:
        return None
    for prefix, label in (("SEMIPRESENCIAL", "SEMIPRESENCIAL"), ("PRESENCIAL", "PRESENCIAL"), ("REMOT", "REMOTA"), ("VIRTUAL", "REMOTA"), ("HIBRID", "SEMIPRESENCIAL")):
        if c.startswith(prefix):
            return label
    return c


class Policy:
    def __init__(self, raw: dict, source: str = "<dict>"):
        self.raw = copy.deepcopy(raw)
        self.source = source
        self._validate()

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Policy":
        p = Path(path) if path else DEFAULT_POLICY_PATH
        return cls(json.loads(p.read_text(encoding="utf-8")), source=str(p.name))

    def __getitem__(self, key):
        return self.raw[key]

    def get(self, key, default=None):
        return self.raw.get(key, default)

    @property
    def fingerprint(self) -> str:
        return hashlib.sha256(json.dumps(self.raw, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]

    @property
    def weights(self) -> dict[str, float]:
        return self.raw["weights"]

    def alias(self, kind: str, value: Any) -> str | None:
        c = canon(value)
        if c is None:
            return None
        return self.raw.get("value_aliases", {}).get(kind, {}).get(c, c)

    def _validate(self):
        r = self.raw
        if r.get("algorithm_version") != ALGORITHM_VERSION_V02:
            raise PolicyError(f"algorithm_version debe ser {ALGORITHM_VERSION_V02}; hybrid-v0.1 vive en la plataforma original.")
        w = r.get("weights")
        if not isinstance(w, dict) or set(w) != set(COMPONENTS_V02):
            raise PolicyError(f"weights debe definir exactamente {COMPONENTS_V02}.")
        for k, v in w.items():
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0:
                raise PolicyError(f"Peso inválido para {k}.")
        if abs(sum(w.values()) - 100) > 1e-9:
            raise PolicyError("Los pesos deben sumar 100.")
        t = r.get("minimum_recommended_score")
        if not isinstance(t, (int, float)) or not 0 <= t <= 100:
            raise PolicyError("minimum_recommended_score fuera de [0, 100].")
        if r.get("program_profile_rule") not in ("hard", "soft", "off"):
            raise PolicyError("program_profile_rule debe ser hard, soft u off.")
        if not isinstance(r.get("top_k"), int) or r["top_k"] < 1:
            raise PolicyError("top_k debe ser entero >= 1.")
        if r.get("semantic", {}).get("backend") not in ("tfidf", "sentence-transformers", "none"):
            raise PolicyError("semantic.backend debe ser tfidf, sentence-transformers o none.")
        for key in ("allowed_vacancy_statuses", "siga_vacancy_types", "active_enrollment_statuses"):
            if not isinstance(r.get(key), list):
                raise PolicyError(f"{key} debe ser lista.")
