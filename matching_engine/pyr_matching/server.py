"""HTTP API for the PyR engine (v1.0.0). Standard library only: no web framework, no new dependencies.

Endpoints (all responses JSON unless an Excel workbook is requested):
    GET  /health                      -> {"status": "ok"}
    GET  /v1/version                  -> engine, output schema and request schema versions
    POST /v1/validate/excel?period=   -> validation report for an uploaded workbook (no recommendations)
    POST /v1/match/excel?period=      -> result workbook (.xlsx) or, with format=json, the JSON result
    POST /v1/match/json               -> `pyr-match-request/1.0` body -> `pyr-match-result/1.0`

Excel upload: either the raw .xlsx bytes as the request body (Content-Type
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or application/octet-stream) or
multipart/form-data with one or more file fields (any field name). Several files are consolidated like
`pyr-match match --inputs a.xlsx b.xlsx`.

Query options for /v1/match/excel: period (required), policy=v0.2|v0.3, semantic=tfidf|tfidf-conceptos|
sentence-transformers|none, simulate=1, pairs=none|top|all, format=xlsx|json, timestamp=<fixed run time>.

Security and privacy:
  * If the environment variable PYR_API_TOKEN is set, every request except /health must send
    `Authorization: Bearer <token>`. Always set it outside a closed local network, and put the service
    behind HTTPS (reverse proxy) because the workbooks contain student data.
  * Uploads are written to a private temporary directory that is deleted when the request ends; nothing
    is persisted, logged or sent to third parties. Request logs carry method, path, status and time only.
  * Body size is capped (PYR_API_MAX_MB, default 25 MB).
"""
from __future__ import annotations

import email.parser
import email.policy
import hmac
import json
import os
import shutil
import sys
import tempfile
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import __version__
from .api import REQUEST_SCHEMA_VERSION, match_request
from .io_excel import MappingError, load_mapping, read_bundle, write_result
from .pipeline import ValidationFailed, run_match, validate
from .policy import POLICY_V03_PATH, Policy, PolicyError
from .schema import OUTPUT_SCHEMA_VERSION

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
SEMANTIC_CHOICES = {"tfidf", "tfidf-conceptos", "sentence-transformers", "none"}
PAIRS_CHOICES = {"none", "top", "all"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail=None):
        super().__init__(code)
        self.status, self.code, self.detail = status, code, detail


class ServerConfig:
    def __init__(self, policy_path=None, mapping_path=None, registry=None, token=None, max_mb=25.0):
        self.policy_path = policy_path
        self.mapping_path = mapping_path
        self.registry = registry
        self.token = token
        self.max_bytes = int(max_mb * 1024 * 1024)

    def policy(self, choice: str | None) -> Policy:
        if choice in (None, ""):
            return Policy.load(self.policy_path)
        if choice not in ("v0.2", "v0.3"):
            raise ApiError(400, "POLITICA_DESCONOCIDA", {"allowed": ["v0.2", "v0.3"]})
        return Policy.load(POLICY_V03_PATH if choice == "v0.3" else None)

    def model(self, policy: Policy):
        if not self.registry:
            return None
        from .training import Registry

        return Registry(self.registry).active_model(policy)


def _excel_files(content_type: str, body: bytes, workdir: Path) -> list[Path]:
    ctype = (content_type or "").split(";")[0].strip().lower()
    files: list[Path] = []
    if ctype == "multipart/form-data":
        msg = email.parser.BytesParser(policy=email.policy.HTTP).parsebytes(
            b"Content-Type: " + content_type.encode("latin-1") + b"\r\n\r\n" + body)
        for i, part in enumerate(msg.iter_parts()):
            if part.get_filename() is None:
                continue
            data = part.get_payload(decode=True) or b""
            if data:
                files.append(workdir / f"insumo_{i}.xlsx")
                files[-1].write_bytes(data)
    elif ctype in (XLSX_MIME, "application/octet-stream", ""):
        if body:
            files.append(workdir / "insumo.xlsx")
            files[0].write_bytes(body)
    else:
        raise ApiError(415, "TIPO_DE_CONTENIDO_NO_SOPORTADO", {"accepted": [XLSX_MIME, "application/octet-stream", "multipart/form-data"]})
    if not files:
        raise ApiError(400, "ARCHIVO_FALTANTE", "Envíe el .xlsx como cuerpo o como campo de archivo multipart.")
    for f in files:
        if f.read_bytes()[:2] != b"PK":
            raise ApiError(400, "ARCHIVO_NO_ES_XLSX", f.name)
    return files


def make_handler(cfg: ServerConfig):
    class Handler(BaseHTTPRequestHandler):
        server_version = f"pyr-matching/{__version__}"
        protocol_version = "HTTP/1.1"

        # --- plumbing -------------------------------------------------------------------------
        def log_message(self, fmt, *args):  # never log query strings or bodies (may contain identifiers)
            sys.stderr.write(f"{self.log_date_time_string()} {self.command} {urlparse(self.path).path} {args[1] if len(args) > 1 else ''}\n")

        def _send(self, status: int, body: bytes, ctype: str, extra: dict | None = None):
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _json(self, status: int, payload):
            self._send(status, json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"), "application/json; charset=utf-8")

        def _authorized(self) -> bool:
            if not cfg.token:
                return True
            got = self.headers.get("Authorization", "")
            return got.startswith("Bearer ") and hmac.compare_digest(got[7:].encode(), cfg.token.encode())

        def _body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            if length > cfg.max_bytes:
                raise ApiError(413, "ARCHIVO_DEMASIADO_GRANDE", {"max_bytes": cfg.max_bytes})
            return self.rfile.read(length) if length else b""

        def _dispatch(self, method: str):
            url = urlparse(self.path)
            q = {k: v[-1] for k, v in parse_qs(url.query).items()}
            try:
                if url.path == "/health" and method == "GET":
                    return self._json(200, {"status": "ok"})
                if not self._authorized():
                    return self._send(401, b'{"error":"NO_AUTORIZADO"}', "application/json", {"WWW-Authenticate": "Bearer"})
                route = (method, url.path.rstrip("/"))
                if route == ("GET", "/v1/version"):
                    return self._json(200, {"engine_version": __version__, "output_schema": OUTPUT_SCHEMA_VERSION,
                                            "request_schema": REQUEST_SCHEMA_VERSION})
                if route == ("POST", "/v1/match/json"):
                    return self._match_json()
                if route in (("POST", "/v1/match/excel"), ("POST", "/v1/validate/excel")):
                    return self._excel(q, validate_only=route[1].startswith("/v1/validate"))
                raise ApiError(404, "RUTA_NO_ENCONTRADA")
            except ApiError as exc:
                self._json(exc.status, {"error": exc.code, "detalle": exc.detail})
            except ValidationFailed as exc:
                self._json(422, {"error": "VALIDACION", "problemas": exc.issues})
            except (MappingError, PolicyError) as exc:
                self._json(422, {"error": "CONFIGURACION_O_MAPEO", "detalle": str(exc)})
            except Exception:  # pragma: no cover - never leak internals or data to the client
                traceback.print_exc(file=sys.stderr)
                self._json(500, {"error": "ERROR_INTERNO"})

        def do_GET(self):  # noqa: N802
            self._dispatch("GET")

        def do_POST(self):  # noqa: N802
            self._dispatch("POST")

        # --- endpoints ------------------------------------------------------------------------
        def _match_json(self):
            try:
                req = json.loads(self._body().decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ApiError(400, "JSON_INVALIDO")
            policy = cfg.policy(req.get("policy")) if isinstance(req, dict) and (req.get("policy") or cfg.policy_path) else None
            res = match_request(req, policy, model=cfg.model(policy) if policy else None)
            status = 200 if res.get("status") == "OK" else (422 if res.get("status") == "VALIDATION_ERROR" else 400)
            self._json(status, res)

        def _excel(self, q: dict, validate_only: bool):
            period = (q.get("period") or "").strip()
            if not period:
                raise ApiError(400, "PERIODO_FALTANTE", "Use ?period=2027A")
            semantic = q.get("semantic") or None
            if semantic and semantic not in SEMANTIC_CHOICES:
                raise ApiError(400, "SEMANTICA_DESCONOCIDA", sorted(SEMANTIC_CHOICES))
            pairs = q.get("pairs", "top")
            if pairs not in PAIRS_CHOICES:
                raise ApiError(400, "PAIRS_DESCONOCIDO", sorted(PAIRS_CHOICES))
            fmt = q.get("format", "xlsx")
            if fmt not in ("xlsx", "json"):
                raise ApiError(400, "FORMATO_DESCONOCIDO", ["xlsx", "json"])
            body = self._body()
            policy = cfg.policy(q.get("policy"))
            workdir = Path(tempfile.mkdtemp(prefix="pyr_api_"))
            try:
                files = _excel_files(self.headers.get("Content-Type", ""), body, workdir)
                bundle = read_bundle(files, policy, load_mapping(cfg.mapping_path))
                if validate_only:
                    issues, warns = validate(bundle, period, policy)
                    return self._json(422 if issues else 200, {
                        "periodo": period, "valido": not issues, "bloqueantes": issues, "advertencias": bundle.load_warnings + warns,
                        "estudiantes": len(bundle.students), "plazas": len(bundle.vacancies), "decisiones": len(bundle.decisions)})
                res = run_match(bundle, period, policy, semantic_override=semantic, model=cfg.model(policy),
                                simulate_general_assignment=q.get("simulate") in ("1", "true", "si", "sí"),
                                pairs_detail=pairs, run_timestamp=q.get("timestamp"))
                if fmt == "json":
                    return self._json(200, {"status": "OK", **res.to_json_dict()})
                out = workdir / "resultados.xlsx"
                write_result(res, out)
                s = res.summary
                self._send(200, out.read_bytes(), XLSX_MIME, {
                    "Content-Disposition": f'attachment; filename="resultados_{period}.xlsx"',
                    "X-PyR-Engine-Version": __version__,
                    "X-PyR-Resumen": json.dumps({k: s.get(k) for k in ("directas_confirmadas", "directas_propuestas", "requieren_gestion_humana",
                                                                     "estudiantes_con_recomendacion", "estudiantes_electivos")}, ensure_ascii=True)})
            finally:
                shutil.rmtree(workdir, ignore_errors=True)

    return Handler


def serve(host="127.0.0.1", port=8080, cfg: ServerConfig | None = None):
    cfg = cfg or ServerConfig()
    if host not in ("127.0.0.1", "localhost", "::1") and not cfg.token:
        print("ADVERTENCIA: el servicio escucha fuera de localhost SIN PYR_API_TOKEN. Configure un token y HTTPS.", file=sys.stderr)
    httpd = ThreadingHTTPServer((host, port), make_handler(cfg))
    print(f"pyr-matching {__version__} escuchando en http://{host}:{port} (Ctrl+C para detener)", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover
        pass
    finally:
        httpd.server_close()
    return 0


def config_from_env(**overrides) -> ServerConfig:
    return ServerConfig(
        policy_path=overrides.get("policy") or os.environ.get("PYR_POLICY") or None,
        mapping_path=overrides.get("mapping") or os.environ.get("PYR_MAPPING") or None,
        registry=overrides.get("registry") or os.environ.get("PYR_REGISTRY") or None,
        token=os.environ.get("PYR_API_TOKEN") or None,
        max_mb=float(overrides.get("max_mb") or os.environ.get("PYR_API_MAX_MB") or 25),
    )

