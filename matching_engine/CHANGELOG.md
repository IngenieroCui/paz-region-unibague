# Historial de versiones — pyr-matching

## 1.0.0 — 2026-11-24 (versión de entrega)
- **API HTTP** `pyr-match serve` (solo biblioteca estándar): `POST /v1/match/excel` recibe el Excel (cuerpo binario o multipart, uno o varios archivos) y devuelve el libro de resultados o JSON; `POST /v1/validate/excel`; `POST /v1/match/json`; `GET /health`, `GET /v1/version`.
- Seguridad del servicio: token Bearer (`PYR_API_TOKEN`) con comparación de tiempo constante, límite de tamaño (`PYR_API_MAX_MB`), archivos temporales borrados al terminar cada petición, registros sin datos, errores internos sin detalles.
- Despliegue: `Dockerfile` (usuario sin privilegios, healthcheck), unidad systemd, ejemplo de proxy nginx HTTPS, `deploy/env.example` y cliente de ejemplo.
- Documentación de entrega: `docs/GUIA_ENTREGA_v1.0.0.md`, `docs/REQUISITOS.md`, `docs/DESPLIEGUE_Y_API.md`.
- 12 pruebas nuevas de la API (349 en total).
- Sin cambios en el algoritmo, las políticas ni los contratos de entrada/salida respecto a 0.3.2: los resultados son idénticos.

## 0.3.2 — 2026-11-16
Catálogo oficial de programas Unibagué en la regla de perfil, datos pendientes como falla segura, verificador independiente, componente de campo profesional, léxico 1.1, escritura de Excel 7× más rápida.

## 0.3.1 — 2026-11-16
Respaldo semántico `tfidf-conceptos`, revisión experta con exploración y modo ciego, compuerta de orden por estudiante, simulación de reentrenamiento.

## 0.3.0 — 2026-11-12
Histórico canónico seudonimizado, evaluación temporal, retroalimentación experta y reentrenamiento con compuertas, contrato JSON `pyr-match-request/1.0`.

## 0.2.0 — 2026-11-12
Motor independiente Excel → Excel `hybrid-pyr-v0.2` con paridad frente a la plataforma original.
