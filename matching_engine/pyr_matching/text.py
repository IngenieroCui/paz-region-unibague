"""Spanish/English token normalisation shared by every algorithm version.

`normalize_tokens` and `text_score` are a faithful port of
`supabase/functions/_shared/matching/engine.ts` (hybrid-v0.1). They are covered by
golden parity tests generated from the TypeScript implementation itself
(`parity/generate_golden.ts`). Changing them changes hybrid-v0.1 semantics: don't.
"""
from __future__ import annotations

import math
import re
import unicodedata
from functools import lru_cache

STOPWORDS = frozenset(
    (
        "a al algo algunas algunos ante antes como con contra cual cuando de del desde donde el ella ellas "
        "ellos en entre era es esa esas ese eso esos esta estaba estamos estan estar estas este esto estos fue "
        "ha hasta hay la las le les lo los mas me mi mis mucha mucho muy no nos o otra otro para pero poco por "
        "porque que quien se ser si sin sobre son su sus te tiene todo tu tus un una unas uno unos y ya the and "
        "for with from this that these those are was were been being have has had not but you your our their "
        "they them into its can could would should will about any all also more most some than then there "
        "which who how what where when is of to on in as it an be at by or"
    ).split()
)

_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)


def js_round(value: float) -> float:
    """JavaScript Math.round semantics (ties toward +infinity)."""
    return float(math.floor(value + 0.5))


def js_num(value: float | int | None) -> str:
    """Format a number like JavaScript template literals do."""
    if value is None:
        return "null"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return repr(value) if isinstance(value, float) else str(value)


def strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    return "".join(ch for ch in decomposed if not unicodedata.category(ch).startswith("M"))


@lru_cache(maxsize=65536)
def _tokens(value: str) -> tuple[str, ...]:
    tokens = set(_TOKEN.findall(strip_accents(value)))
    return tuple(sorted(t for t in tokens if len(t) >= 3 and t not in STOPWORDS))


def normalize_tokens(value: str | None) -> list[str]:
    return list(_tokens(value)) if value else []


def text_score(left: str | None, right: str | None) -> float | None:
    """Symmetric-normalised token overlap in [0, 100]; None when either side has no tokens."""
    a = _tokens(left) if left else ()
    b = _token_set(right) if right else frozenset()
    if not a or not b:
        return None
    shared = sum(1 for token in a if token in b)
    return max(0.0, min(100.0, js_round(100 * shared / math.sqrt(len(a) * len(b)))))


@lru_cache(maxsize=65536)
def _token_set(value: str) -> frozenset[str]:
    return frozenset(_tokens(value))


def join_text(values) -> str:
    return " ".join(v for v in values if v)
