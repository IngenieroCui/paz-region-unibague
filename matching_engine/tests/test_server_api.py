"""v1.0.0: HTTP API (stdlib server) — Excel upload, validation, JSON contract, auth and limits."""
from __future__ import annotations

import io
import json
import threading
import urllib.error
import urllib.request
import uuid

import openpyxl
import pytest

from pyr_matching import __version__
from pyr_matching.fixtures import hand_scenario
from pyr_matching.server import XLSX_MIME, ServerConfig, ThreadingHTTPServer, make_handler


@pytest.fixture()
def server(request):
    cfg = getattr(request, "param", None) or ServerConfig()
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(cfg))
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def call(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


@pytest.fixture()
def sample(tmp_path):
    return hand_scenario(tmp_path / "ejemplo.xlsx").read_bytes()


def test_health_and_version(server):
    assert json.loads(call(server + "/health")[2]) == {"status": "ok"}
    v = json.loads(call(server + "/v1/version")[2])
    assert v["engine_version"] == __version__ == "1.0.0"


def test_match_excel_raw_body_returns_workbook(server, sample):
    st, h, body = call(server + "/v1/match/excel?period=2027A&timestamp=2027-01-01T00:00:00", sample, {"Content-Type": XLSX_MIME})
    assert st == 200 and h["Content-Type"] == XLSX_MIME
    wb = openpyxl.load_workbook(io.BytesIO(body), read_only=True)
    assert "Resumen_Ejecucion" in wb.sheetnames and "Recomendaciones_SIGA" in wb.sheetnames
    assert json.loads(h["X-PyR-Resumen"])["estudiantes_electivos"] >= 1


def test_match_excel_multipart_json_format_matches_raw(server, sample):
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"ejemplo.xlsx\"\r\n"
            f"Content-Type: {XLSX_MIME}\r\n\r\n").encode() + sample + f"\r\n--{b}--\r\n".encode()
    q = "/v1/match/excel?period=2027A&format=json&timestamp=2027-01-01T00:00:00"
    st, _, multi = call(server + q, body, {"Content-Type": f"multipart/form-data; boundary={b}"})
    st2, _, raw = call(server + q, sample, {"Content-Type": "application/octet-stream"})
    assert st == st2 == 200
    a, c = json.loads(multi), json.loads(raw)
    assert a["status"] == "OK" and a["tables"]["Recomendaciones_SIGA"] == c["tables"]["Recomendaciones_SIGA"]


def test_validate_excel(server, sample):
    st, _, body = call(server + "/v1/validate/excel?period=2027A", sample, {"Content-Type": XLSX_MIME})
    r = json.loads(body)
    assert st == 200 and r["valido"] is True and r["estudiantes"] > 0


@pytest.mark.parametrize("q,data,ctype,code", [
    ("/v1/match/excel", b"PK", XLSX_MIME, "PERIODO_FALTANTE"),
    ("/v1/match/excel?period=2027A", b"no es excel", XLSX_MIME, "ARCHIVO_NO_ES_XLSX"),
    ("/v1/match/excel?period=2027A", b"", XLSX_MIME, "ARCHIVO_FALTANTE"),
    ("/v1/match/excel?period=2027A", b"x", "text/plain", "TIPO_DE_CONTENIDO_NO_SOPORTADO"),
    ("/v1/match/excel?period=2027A&policy=v9", b"PK", XLSX_MIME, "POLITICA_DESCONOCIDA"),
    ("/v1/match/json", b"{no json", "application/json", "JSON_INVALIDO"),
])
def test_bad_requests_are_explicit(server, q, data, ctype, code):
    st, _, body = call(server + q, data, {"Content-Type": ctype})
    assert 400 <= st < 500 and json.loads(body)["error"] == code


def test_match_json_contract(server):
    req = {"schema_version": "pyr-match-request/1.0", "period": "2027A", "options": {"timestamp": "2027-01-01T00:00:00"},
           "students": [{"student_id": "E1", "academic_program": "Ingeniería de Sistemas", "eligible": True}],
           "vacancies": [{"vacancy_id": "P1", "capacity": 1, "status": "ABIERTA", "vacancy_type": "GENERAL",
                          "program_profile": "Ingeniería de Sistemas"}]}
    st, _, body = call(server + "/v1/match/json", json.dumps(req).encode(), {"Content-Type": "application/json"})
    assert st == 200 and json.loads(body)["status"] == "OK"
    req["students"][0]["nombre"] = "no permitido"
    st, _, body = call(server + "/v1/match/json", json.dumps(req).encode(), {"Content-Type": "application/json"})
    assert st == 400 and json.loads(body)["issues"][0]["code"] == "CAMPO_NO_PERMITIDO"


@pytest.mark.parametrize("server", [ServerConfig(token="s3creto", max_mb=0.001)], indirect=True)
def test_token_and_size_limit(server, sample):
    assert call(server + "/health")[0] == 200
    assert call(server + "/v1/version")[0] == 401
    assert call(server + "/v1/version", headers={"Authorization": "Bearer otro"})[0] == 401
    assert call(server + "/v1/version", headers={"Authorization": "Bearer s3creto"})[0] == 200
    st, _, body = call(server + "/v1/match/excel?period=2027A", sample, {"Content-Type": XLSX_MIME, "Authorization": "Bearer s3creto"})
    assert st == 413 and json.loads(body)["error"] == "ARCHIVO_DEMASIADO_GRANDE"
