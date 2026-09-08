"""No live reads: frozen membership, rate policy, failure retention, semantics."""

from __future__ import annotations

import json

import pytest
import requests

from pipeline import (
    evidence_cohort as cohort,
    off_client,
)
from pipeline.test_observations import fixture


class Clock:
    def __init__(self):
        self.now = 0.0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


@pytest.fixture()
def clock(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(off_client.time, "monotonic", clock.monotonic)
    monkeypatch.setattr(off_client.time, "sleep", clock.sleep)
    monkeypatch.setattr(off_client, "_NEXT_REQUEST_AT", {})
    return clock


def test_endpoint_limiters_include_every_request(clock):
    off_client._wait_for_request_slot(off_client.OFF_PRODUCT_URL)
    assert clock.now == 0
    off_client._wait_for_request_slot(off_client.OFF_PRODUCT_URL)
    assert clock.now == pytest.approx(4.1)
    off_client._wait_for_request_slot(off_client.OFF_SEARCH_URL)
    off_client._wait_for_request_slot(off_client.OFF_SEARCH_URL)
    assert clock.now == pytest.approx(10.2)


class Session:
    def __init__(self, statuses, clock):
        self.statuses = iter(statuses)
        self.starts = []
        self.clock = clock

    def get(self, *args, **kwargs):
        self.starts.append(self.clock.now)
        response = requests.Response()
        response.status_code = next(self.statuses)
        response._content = b'{"status": 1}'
        return response


def test_retries_share_product_rate_budget(clock):
    session = Session([500, 500, 200], clock)
    assert off_client._get_json(session, off_client.OFF_PRODUCT_URL, {}) == {"status": 1}
    assert session.starts == pytest.approx([0, 4.1, 8.2])


def test_permanent_http_failure_not_selectively_retried(clock):
    session = Session([403], clock)
    assert off_client._get_json(session, off_client.OFF_PRODUCT_URL, {}) is None
    assert len(session.starts) == 1


def test_retry_after_long_pause_is_respected_without_long_block(clock):
    off_client._respect_retry_after(off_client.OFF_PRODUCT_URL, "90")
    with pytest.raises(off_client.OffRateLimitDeferredError):
        off_client._wait_for_request_slot(off_client.OFF_PRODUCT_URL)
    assert clock.now == 0


def test_frozen_cohort_has_every_required_member():
    manifest, digest = cohort.load_cohort(cohort.COHORT_PATH)
    assert len(manifest["members"]) == 60
    assert len(digest) == 64
    dairy = {m["product_id"] for m in manifest["members"] if m["country"] == "PL" and m["category"] == "Dairy"}
    assert {628, 2882} <= dairy


def test_member_removal_is_rejected(tmp_path):
    manifest, _ = cohort.load_cohort(cohort.COHORT_PATH)
    manifest["members"].pop()
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="sixty"):
        cohort.load_cohort(path)


def test_missing_qualified_and_unknown_basis_are_not_exact_comparison():
    _, product = fixture()
    member = {"product_id": 1}
    ref = {"stored_nutrition": {"salt_100g": "0.01", "fat_100g": "1.1234"}}
    result = cohort.reconcile(member, ref, product)
    salt = next(f for f in result["nutrition"] if f["field"] == "salt_100g")
    assert salt["disposition"] == "qualified_source_not_exactly_comparable"
    assert salt["source_basis"] == "unknown"
    assert result["independent_package_verification"] is False


def test_external_circuit_keeps_all_frozen_members_and_failures(tmp_path, monkeypatch):
    manifest, _ = cohort.load_cohort(cohort.COHORT_PATH)
    reference = tmp_path / "reference.json"
    reference.write_text(json.dumps({"captured_at": "2026-09-05T00:00:00Z", "members": manifest["members"]}))
    monkeypatch.setattr(cohort, "REPORT_ROOT", tmp_path)
    calls = []

    def failure(member, session):
        calls.append(member["product_id"])
        return {**member, "status": "unavailable", "reason": "http_403", "attempts": [{"http_status": 403}]}, None

    monkeypatch.setattr(cohort, "fetch_member", failure)
    result = cohort.run_cohort(cohort.COHORT_PATH, reference, tmp_path / "run")
    assert len(calls) == 3
    assert len(result["members"]) == 60
    assert result["counts"] == {"unavailable": 3, "not_attempted": 57}
    assert [m["product_id"] for m in result["members"]] == [m["product_id"] for m in manifest["members"]]
    assert (tmp_path / "run/dry-run.sql").is_file()


def test_saved_run_integrity_without_more_network_calls(tmp_path, monkeypatch):
    manifest, _ = cohort.load_cohort(cohort.COHORT_PATH)
    reference = tmp_path / "reference.json"
    reference.write_text(json.dumps({"captured_at": "2026-09-05T00:00:00Z", "members": manifest["members"]}))
    monkeypatch.setattr(cohort, "REPORT_ROOT", tmp_path)

    def success(member, session):
        raw, _ = fixture()
        raw["code"] = member["ean"]
        raw = off_client._with_fetch_metadata(raw, "2026-09-05T10:00:00Z")
        return {**member, "status": "fetched", "attempts": []}, off_client.extract_product_data(raw)

    monkeypatch.setattr(cohort, "fetch_member", success)
    output = tmp_path / "run"
    result = cohort.run_cohort(cohort.COHORT_PATH, reference, output)
    verification = cohort.verify_saved_run(output)
    assert verification["verified_observation_files"] == 60
    assert verification["network_requests"] == 0
    target = output / result["members"][0]["observation_file"]
    target.write_bytes(target.read_bytes() + b" ")
    with pytest.raises(ValueError, match="file hash"):
        cohort.verify_saved_run(output)
