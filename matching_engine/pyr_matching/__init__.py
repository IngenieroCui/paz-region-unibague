"""PyR standalone matching engine (Universidad de Ibagué – Paz y Región).

Excel-in / Excel-out recommendation and direct-placement proposal engine. It never approves special
cases, selects call winners, or enrolls students: institutional decisions remain authoritative.

Public API (stable, versioned by OUTPUT_SCHEMA_VERSION):
    from pyr_matching import match_files, run_match, Policy, read_bundle, write_result
"""
__version__ = "0.3.0"

from .policy import Policy  # noqa: E402
from .schema import OUTPUT_SCHEMA_VERSION  # noqa: E402


def match_files(inputs, period, output=None, policy_path=None, mapping_path=None, **kwargs):
    """Read Excel inputs, run the pipeline and optionally write the output workbook. Returns MatchResult."""
    from .io_excel import load_mapping, read_bundle, write_result
    from .pipeline import run_match

    policy = Policy.load(policy_path)
    bundle = read_bundle(list(inputs), policy, load_mapping(mapping_path))
    result = run_match(bundle, str(period), policy, **kwargs)
    if output:
        write_result(result, output)
    return result


def __getattr__(name):  # lazy re-exports keep `import pyr_matching` light
    if name in ("run_match", "MatchResult", "ValidationFailed"):
        from . import pipeline

        return getattr(pipeline, name)
    if name in ("read_bundle", "write_result"):
        from . import io_excel

        return getattr(io_excel, name)
    raise AttributeError(name)


__all__ = ["__version__", "Policy", "OUTPUT_SCHEMA_VERSION", "match_files", "run_match", "read_bundle", "write_result"]
