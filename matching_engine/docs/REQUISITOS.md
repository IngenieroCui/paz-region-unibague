# Requisitos mínimos y recomendados — pyr-matching v1.0.0

Cifras medidas el 2026-11-24 con 520 estudiantes × 370 plazas sintéticos (tamaño similar a 2026B), Windows 11, Python 3.14, respaldo semántico sin dependencias. Una corrida típica tarda entre 8 y 25 s y no supera ~200 MB de memoria.

## 1. Usar el motor (emparejar un semestre)

| Recurso | Mínimo | Recomendado |
|---|---|---|
| Sistema operativo | Windows 10, macOS 12 o Linux de 64 bits | Windows 11 o Ubuntu 22.04/24.04 LTS |
| Python | 3.10 | 3.12 (versión de la imagen Docker); probado hasta 3.14 |
| CPU | 2 núcleos | 4 núcleos (la simulación `--simulate` usa más CPU) |
| Memoria RAM | 2 GB libres | 4 GB (8 GB si se activan embeddings) |
| Disco | 200 MB (entorno + motor) | 1 GB; +500 MB si se usan embeddings locales |
| Red | No necesita Internet para emparejar | Solo una vez, para instalar paquetes y (opcional) descargar el modelo de embeddings |
| Software | `openpyxl` (se instala solo) | Excel o LibreOffice para leer los resultados |
| Datos | Libro Excel con las hojas del contrato ([EXCEL_CONTRACT.md](EXCEL_CONTRACT.md)) ya validado por la institución | Textos de estudiantes completos (`Habilidades`, `Intereses`, `Trabajo_Deseado`, `Modalidad_Preferida`) para subir la confianza de la evidencia |

## 2. Reentrenar ("entrenar más") el motor

El reentrenamiento es una regresión logística ligera: no necesita GPU ni servidores especiales. Lo que limita es la **cantidad y calidad de las etiquetas**, no el hardware.

| Recurso | Mínimo (lo exige la política) | Recomendado |
|---|---|---|
| Hardware | El mismo del uso normal | 4 núcleos, 8 GB RAM |
| Parejas revisadas utilizables | 200 | 800 o más (≈ 50 estudiantes por periodo con `--explore 2`) |
| Parejas positivas (nota ≥ 3) | 20 | Positivas y negativas en todos los periodos |
| Periodos revisados | 2 | 3 o más; el último se reserva como prueba |
| Parejas en el periodo de prueba | 40 | 150 o más |
| Subgrupos (programa/municipio) | 30 parejas y 5 por clase para evaluar equidad | Todos los programas y municipios relevantes por encima de ese tamaño |
| Personas | 1 revisor + 1 aprobador **distinto** | 2 revisores por pareja en una muestra (≈ 10 %) para medir desacuerdo |
| Almacenamiento | Carpeta institucional privada fuera de git | Carpeta cifrada con respaldo, con acceso solo de la Coordinación PyR |

Si falta algo, `pyr-match retrain` termina con código 3 y dice exactamente qué (`POCAS_ETIQUETAS`, `POCOS_POSITIVOS`, `POCOS_PERIODOS`, ...).

## 3. Servidor (API HTTP)

| Recurso | Mínimo | Recomendado (producción institucional) |
|---|---|---|
| Máquina | VM o contenedor con 1 vCPU, 1 GB RAM | 2 vCPU, 4 GB RAM, 20 GB disco |
| SO | Cualquier Linux con Python ≥ 3.10, o Docker | Ubuntu 24.04 LTS con Docker o systemd |
| Red | Puerto interno 8080 | Solo 443 expuesto, con proxy inverso HTTPS (nginx/Apache/IIS) y certificado válido |
| Seguridad | `PYR_API_TOKEN` configurado | Token rotado por semestre, acceso restringido a la red de la Universidad o VPN, registros del proxy sin cuerpos |
| Concurrencia | 1 solicitud a la vez | Hasta ~4 simultáneas por cada 2 vCPU (cada corrida grande usa un núcleo durante 10–25 s) |
| Tiempo de espera del proxy | 120 s | 300 s (corridas con `simulate=1`) |
| Tamaño de carga | 25 MB (por defecto) | Ajustar `PYR_API_MAX_MB` y `client_max_body_size` a la par |

## 4. Personas y conocimientos

| Rol | Necesita saber |
|---|---|
| Analista PyR (uso semestral) | Excel, abrir una terminal y copiar comandos del [manual](MANUAL_DE_USO.md) |
| Revisores (reentrenamiento) | Conocer el programa académico y el territorio; no requieren conocimientos técnicos |
| TI (servidor) | Linux básico, Docker o systemd, proxy inverso HTTPS, gestión de secretos |
| Desarrollador (integración) | HTTP/JSON o Python; ver [DESPLIEGUE_Y_API.md](DESPLIEGUE_Y_API.md) e [INTEGRATION.md](INTEGRATION.md) |
