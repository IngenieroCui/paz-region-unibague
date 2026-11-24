# Despliegue en servidor y API HTTP — pyr-matching v1.0.0

Desde la v1.0.0 el motor trae su propio servidor HTTP (`pyr-match serve`). Está escrito solo con la biblioteca estándar de Python: no agrega dependencias. Recibe el Excel, lo transforma con el mismo pipeline de la consola y devuelve el libro de resultados (o JSON).

## 1. Probar en el equipo local

```bash
cd matching_engine
python -m venv .venv
.venv/Scripts/python -m pip install -e .
.venv/Scripts/pyr-match serve --port 8080
```
(Linux/macOS: `.venv/bin/...`.) Sin `--host`, escucha solo en `127.0.0.1`.

```bash
curl http://127.0.0.1:8080/health
curl -X POST "http://127.0.0.1:8080/v1/match/excel?period=2027A&policy=v0.3" \
     -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
     --data-binary @insumo.xlsx -o resultados.xlsx
```

## 2. Endpoints

| Método y ruta | Entrada | Salida |
|---|---|---|
| `GET /health` | — | `{"status":"ok"}` (sin token, para monitoreo) |
| `GET /v1/version` | — | versión del motor y de los contratos |
| `POST /v1/validate/excel?period=2027A` | Excel | `200` válido / `422` con `bloqueantes` y `advertencias` |
| `POST /v1/match/excel?period=2027A` | Excel | `200` libro `resultados_2027A.xlsx` (cabecera `X-PyR-Resumen` con conteos) |
| `POST /v1/match/excel?period=2027A&format=json` | Excel | `200` JSON `pyr-match-result/1.0` |
| `POST /v1/match/json` | JSON `pyr-match-request/1.0` ([INTEGRATION.md](INTEGRATION.md)) | JSON `pyr-match-result/1.0` |

**Cómo enviar el Excel** (dos formas equivalentes):
- Cuerpo binario: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (o `application/octet-stream`) y los bytes del `.xlsx`.
- Formulario: `multipart/form-data` con uno o varios campos de archivo (p. ej. `-F file=@estudiantes.xlsx -F file=@plazas.xlsx`). Varios archivos se consolidan igual que `--inputs a.xlsx b.xlsx`.

**Parámetros de consulta** de `/v1/match/excel`:

| Parámetro | Valores | Por defecto |
|---|---|---|
| `period` | `2027A`, ... | obligatorio |
| `policy` | `v0.2`, `v0.3` | la del servidor (`PYR_POLICY`), si no `v0.2` |
| `semantic` | `tfidf`, `tfidf-conceptos`, `sentence-transformers`, `none` | el de la política |
| `simulate` | `1` | desactivado |
| `pairs` | `none`, `top`, `all` | `top` |
| `format` | `xlsx`, `json` | `xlsx` |
| `timestamp` | fecha ISO fija (reproducibilidad) | hora actual |

**Errores** (siempre JSON `{"error": CODIGO, ...}`): `400` petición mal formada (`PERIODO_FALTANTE`, `ARCHIVO_FALTANTE`, `ARCHIVO_NO_ES_XLSX`, `POLITICA_DESCONOCIDA`, `JSON_INVALIDO`, ...), `401` token, `404` ruta, `413` archivo grande, `415` tipo de contenido, `422` validación de datos o mapeo (`VALIDACION`, `CONFIGURACION_O_MAPEO`), `500` error interno (sin detalles ni datos).

## 3. Conectar una aplicación

**Python** (sin dependencias): [`deploy/cliente_ejemplo.py`](../deploy/cliente_ejemplo.py).
```bash
PYR_API_TOKEN=... python deploy/cliente_ejemplo.py insumo.xlsx 2027A resultados.xlsx https://pyr-motor.unibague.edu.co
```

**JavaScript / TypeScript** (navegador o Node 18+), por ejemplo desde la plataforma React del repositorio:
```ts
async function emparejar(archivo: File, periodo: string, token: string) {
  const form = new FormData();
  form.append("file", archivo);
  const r = await fetch(`${API_URL}/v1/match/excel?period=${encodeURIComponent(periodo)}&policy=v0.3`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  if (!r.ok) throw new Error(JSON.stringify(await r.json()));
  return await r.blob();               // resultados.xlsx
}
```
No ponga el token en código de navegador público: llame a la API desde el backend (p. ej. una Edge Function de Supabase) o desde un usuario ya autenticado detrás de un proxy que inyecte el token.

**Excel/Power Automate/otro sistema**: cualquier herramienta que pueda hacer un `POST` HTTP con un archivo sirve; el contrato es el de la tabla anterior.

## 4. Desplegar en un servidor

### Opción A — Docker (recomendada)
```bash
cd matching_engine
docker build -t pyr-matching:1.0.0 .
cp deploy/env.example deploy/.env        # completar PYR_API_TOKEN (nunca subir a git)
docker run -d --name pyr-matching --restart unless-stopped \
  --env-file deploy/.env -p 127.0.0.1:8080:8080 \
  -v /srv/pyr/registro:/data/registro pyr-matching:1.0.0
```
Token: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Para usar un modelo reentrenado y activado, poner `PYR_REGISTRY=/data/registro` en `.env`.

### Opción B — systemd (sin Docker)
Seguir los comentarios de [`deploy/pyr-matching.service`](../deploy/pyr-matching.service): usuario de sistema `pyr`, entorno virtual en `/opt/pyr/venv`, variables en `/etc/pyr-matching.env` (permisos 600).

### HTTPS (obligatorio fuera de localhost)
Los libros contienen datos de estudiantes. Exponer solo el puerto 443 mediante un proxy inverso; ejemplo para nginx en [`deploy/nginx-pyr.conf.example`](../deploy/nginx-pyr.conf.example). En nubes administradas (Azure App Service, Google Cloud Run, AWS App Runner, Render, Railway) basta con desplegar la imagen Docker: ellas ponen el HTTPS; configurar `PYR_API_TOKEN` como secreto y el puerto 8080.

> Vercel no es adecuado para este servicio (funciones con límites de tiempo y tamaño de carga); la plataforma web sí puede seguir en Vercel y llamar a la API desplegada en otro lugar.

### Variables de entorno
| Variable | Uso |
|---|---|
| `PYR_API_TOKEN` | Token Bearer exigido en todo salvo `/health`. Si falta y el host no es local, el servicio lo advierte al arrancar |
| `PYR_POLICY` | Política por defecto (ruta a JSON) |
| `PYR_MAPPING` | Mapeo de encabezados institucionales |
| `PYR_REGISTRY` | Registro de modelos; se usa el modelo ACTIVO compatible con la política |
| `PYR_API_MAX_MB` | Tamaño máximo de carga (25) |
| `PYR_HOST`, `PYR_PORT` | Interfaz y puerto (`127.0.0.1`, `8080`; la imagen Docker usa `0.0.0.0`) |

## 5. Privacidad y operación
- Cada carga se guarda en un directorio temporal privado que se borra al terminar la petición. El servicio no guarda insumos ni resultados.
- Los registros solo contienen método, ruta, código HTTP y hora: nunca parámetros, nombres ni contenido.
- Actualizar: reconstruir la imagen con la nueva versión y reiniciar; `GET /v1/version` confirma la versión activa.
- Reentrenar **no** se hace por la API: es un proceso con revisión humana y aprobación explícita ([RETRAINING_PLAYBOOK.md](RETRAINING_PLAYBOOK.md)). Una vez activado un modelo en el registro montado, la API lo usa sin reiniciar.
