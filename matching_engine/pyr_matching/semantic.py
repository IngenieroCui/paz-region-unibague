"""Semantic similarity backends for professional Spanish text.

* `TfidfBackend` (default, offline, dependency-free): TF-IDF over accent-folded Spanish tokens with a
  light prefix stemmer (first 6 characters) plus word bigrams, cosine similarity. Fitted per run on
  the run's own professional texts (no external data, nothing persisted).
* `SentenceTransformerBackend` (optional): local multilingual sentence embeddings, e.g.
  `paraphrase-multilingual-MiniLM-L12-v2`. Runs on this machine; texts are never sent to a third
  party. If the package/model is unavailable the engine falls back explicitly and records a warning.

Neither backend is "trained" on PyR outcomes. Pre-trained embeddings are not a supervised PyR model.
"""
from __future__ import annotations

import hashlib
import math
from collections import Counter
from typing import Iterable, Protocol

from .text import normalize_tokens


class SemanticBackend(Protocol):
    name: str
    version: str

    def prepare(self, texts: Iterable[str]) -> None: ...

    def similarity(self, a: str, b: str) -> float | None: ...


class NoSemanticBackend:
    name = "none"
    version = "0"

    def prepare(self, texts):
        pass

    def similarity(self, a, b):
        return None


def _stem(token: str) -> str:
    return token[:6]


def _features(text: str) -> list[str]:
    toks = [_stem(t) for t in normalize_tokens_ordered(text)]
    return toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]


def normalize_tokens_ordered(text: str) -> list[str]:
    """Like normalize_tokens but preserving order/multiplicity (needed for bigrams and tf)."""
    from .text import STOPWORDS, _TOKEN, strip_accents

    return [t for t in _TOKEN.findall(strip_accents(text or "")) if len(t) >= 3 and t not in STOPWORDS]


class TfidfBackend:
    name = "tfidf"
    version = "tfidf-es-stem6-bigram/1.0"

    def __init__(self):
        self._idf: dict[str, float] = {}
        self._cache: dict[str, dict[str, float]] = {}

    def prepare(self, texts: Iterable[str]) -> None:
        docs = sorted({t for t in texts if t and normalize_tokens(t)})
        df: Counter[str] = Counter()
        for d in docs:
            df.update(set(_features(d)))
        n = len(docs)
        self._idf = {f: math.log((1 + n) / (1 + c)) + 1 for f, c in df.items()}
        self._cache = {}

    def _vec(self, text: str) -> dict[str, float]:
        if text in self._cache:
            return self._cache[text]
        tf = Counter(_features(text))
        vec = {f: (1 + math.log(c)) * self._idf.get(f, 1.0) for f, c in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values()))
        vec = {f: v / norm for f, v in vec.items()} if norm else {}
        self._cache[text] = vec
        return vec

    def similarity(self, a: str, b: str) -> float | None:
        if not a or not b:
            return None
        va, vb = self._vec(a), self._vec(b)
        if not va or not vb:
            return None
        if len(va) > len(vb):
            va, vb = vb, va
        cos = sum(v * vb.get(f, 0.0) for f, v in va.items())
        return round(max(0.0, min(1.0, cos)) * 100, 4)


class SentenceTransformerBackend:
    """Local multilingual embeddings. Offline by default: the model must already be on disk.

    * `allow_download=False` (default) loads with `local_files_only=True`, so a run can never reach the
      network implicitly. Download once, explicitly, with `pyr-match download-model` (no student data
      is involved in that step).
    * Texts are embedded in batches (`batch_size`) and kept in memory for the run.
    * `cache_dir` (opt-in, keep OUTSIDE git): vectors persisted per model, keyed by SHA-256 of the text,
      so the raw text is never written. Vectors are still derived from private text: treat the folder as
      institutional data (see docs/FAIRNESS_PRIVACY.md).
    """

    name = "sentence-transformers"

    def __init__(self, model_name: str, cache_folder: str | None = None, encoder=None, *, allow_download: bool = False,
                 batch_size: int = 32, cache_dir: str | None = None):
        self.model_name = model_name
        self.version = f"st:{model_name}"
        self._encoder = encoder  # injectable for tests (callable: list[str] -> list[list[float]])
        self._cache_folder = cache_folder
        self._allow_download = allow_download
        self.batch_size = max(1, int(batch_size))
        self._vectors: dict[str, list[float]] = {}
        self._disk_cache_path = None
        self._disk: dict[str, list[float]] = {}
        if cache_dir:
            from pathlib import Path

            d = Path(cache_dir)
            d.mkdir(parents=True, exist_ok=True)
            self._disk_cache_path = d / f"emb_{hashlib.sha256(model_name.encode()).hexdigest()[:12]}.json"
            if self._disk_cache_path.exists():
                import json

                self._disk = json.loads(self._disk_cache_path.read_text(encoding="utf-8"))

    def _load(self):
        if self._encoder is not None:
            return self._encoder
        from sentence_transformers import SentenceTransformer  # optional dependency

        model = SentenceTransformer(self.model_name, cache_folder=self._cache_folder, device="cpu",
                                    local_files_only=not self._allow_download)
        try:
            import sentence_transformers

            self.version = f"st:{self.model_name}@sentence-transformers=={sentence_transformers.__version__}"
        except Exception:  # pragma: no cover
            pass
        bs = self.batch_size

        def encode(texts):
            return [list(map(float, v)) for v in model.encode(texts, batch_size=bs, normalize_embeddings=True, show_progress_bar=False)]

        self._encoder = encode
        return encode

    def prepare(self, texts: Iterable[str]) -> None:
        unique = sorted({t for t in texts if t and t.strip()})
        missing = []
        for t in unique:
            if t in self._vectors:
                continue
            key = text_fingerprint(t, 32)
            if key in self._disk:
                self._vectors[t] = self._disk[key]
            else:
                missing.append(t)
        if missing:
            enc = self._load()
            for i in range(0, len(missing), self.batch_size):
                chunk = missing[i:i + self.batch_size]
                vectors = enc(chunk)
                if len(vectors) != len(chunk):
                    raise RuntimeError("El modelo de embeddings devolvió un número inesperado de vectores.")
                for t, v in zip(chunk, vectors):
                    self._vectors[t] = v
                    if self._disk_cache_path is not None:
                        self._disk[text_fingerprint(t, 32)] = [round(x, 6) for x in v]
            if self._disk_cache_path is not None:
                import json

                self._disk_cache_path.write_text(json.dumps(self._disk), encoding="utf-8")

    def similarity(self, a: str, b: str) -> float | None:
        va, vb = self._vectors.get(a), self._vectors.get(b)
        if not va or not vb or len(va) != len(vb):
            return None
        dot = sum(x * y for x, y in zip(va, vb))
        na = math.sqrt(sum(x * x for x in va))
        nb = math.sqrt(sum(y * y for y in vb))
        if not na or not nb:
            return None
        return round(max(0.0, min(1.0, dot / (na * nb))) * 100, 4)


def build_backend(policy, override: str | None = None, encoder=None) -> tuple[SemanticBackend, list[str]]:
    """Return (backend, warnings). Falls back to the policy fallback when the optional stack is missing."""
    cfg = policy.get("semantic", {})
    choice = override or cfg.get("backend", "tfidf")
    warnings: list[str] = []
    if choice == "none":
        return NoSemanticBackend(), warnings
    if choice == "sentence-transformers":
        backend = SentenceTransformerBackend(cfg.get("embedding_model"), cfg.get("cache_folder"), encoder=encoder,
                                             allow_download=bool(cfg.get("allow_model_download", False)),
                                             batch_size=cfg.get("batch_size", 32), cache_dir=cfg.get("vector_cache_dir"))
        try:
            backend._load()
            return backend, warnings
        except Exception as exc:  # ImportError, download/network errors, etc.
            warnings.append(f"SEMANTIC_BACKEND_UNAVAILABLE: {type(exc).__name__}; se usa '{cfg.get('fallback_backend', 'tfidf')}'.")
            choice = cfg.get("fallback_backend", "tfidf")
            if choice == "none":
                return NoSemanticBackend(), warnings
    return TfidfBackend(), warnings


def text_fingerprint(text: str, n: int = 12) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


def download_model(model_name: str, cache_folder: str | None = None) -> str:
    """Explicit, one-time model download (public weights only; no institutional data is sent)."""
    from sentence_transformers import SentenceTransformer

    SentenceTransformer(model_name, cache_folder=cache_folder, device="cpu")
    return model_name
