# Imagen del motor PyR v1.0.0 con su API HTTP (sin datos, sin modelos, sin credenciales dentro).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PYR_HOST=0.0.0.0 PYR_PORT=8080

WORKDIR /app
COPY pyproject.toml README.md ./
COPY pyr_matching ./pyr_matching
RUN pip install . && useradd --system --uid 10001 pyr && mkdir -p /data/registro && chown -R pyr /data

USER pyr
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=4).status==200 else 1)"

# PYR_API_TOKEN, PYR_POLICY, PYR_REGISTRY y PYR_API_MAX_MB se pasan en tiempo de ejecución (docker run -e / --env-file).
CMD ["pyr-match", "serve"]
