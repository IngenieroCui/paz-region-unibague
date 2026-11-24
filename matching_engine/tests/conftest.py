import pytest

from pyr_matching import Policy
from pyr_matching.fixtures import hand_rows, write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match

TS = "2026-11-12T00:00:00+00:00"


@pytest.fixture
def policy():
    return Policy.load()


@pytest.fixture
def hand_path(tmp_path):
    return write_workbook(tmp_path / "hand.xlsx", hand_rows())


@pytest.fixture
def hand_bundle(hand_path, policy):
    return read_bundle([hand_path], policy, load_mapping())


@pytest.fixture
def hand_result(hand_bundle, policy):
    return run_match(hand_bundle, "2027A", policy, simulate_general_assignment=True, pairs_detail="all", run_timestamp=TS)


def by_student(rows):
    return {r["id_estudiante"]: r for r in rows}
