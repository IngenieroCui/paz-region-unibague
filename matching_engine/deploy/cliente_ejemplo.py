"""Cliente mínimo (solo biblioteca estándar): sube un Excel a la API y guarda el libro de resultados.

Uso:  python cliente_ejemplo.py insumo.xlsx 2027A resultados.xlsx [https://servidor]
Lee el token de la variable de entorno PYR_API_TOKEN (nunca lo escriba en el código).
"""
import json
import os
import sys
import urllib.error
import urllib.request

entrada, periodo, salida = sys.argv[1:4]
base = sys.argv[4] if len(sys.argv) > 4 else "http://127.0.0.1:8080"
headers = {"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
if os.environ.get("PYR_API_TOKEN"):
    headers["Authorization"] = "Bearer " + os.environ["PYR_API_TOKEN"]
with open(entrada, "rb") as f:
    req = urllib.request.Request(f"{base}/v1/match/excel?period={periodo}&policy=v0.3", data=f.read(), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=300) as r:
        open(salida, "wb").write(r.read())
        print("OK ->", salida, r.headers.get("X-PyR-Resumen"))
except urllib.error.HTTPError as e:
    print("ERROR", e.code, json.dumps(json.loads(e.read()), ensure_ascii=False, indent=1))
    sys.exit(1)
