"""Contracts for the offline-first JEV advisory shadow tool."""

from __future__ import annotations

import inspect
import json

import pytest
import requests

from pipeline import jev_advisory as advisory


def public_side(name: str = "Product", brand: str = "Brand") -> dict:
    return {"product_name": name, "brand": brand, "variant": None, "package": None, "quantity": "500 g"}


def raw_case(state: str = "semantic_ambiguity", *, source_name: str = "Produkt") -> dict:
    reference, source = public_side(), public_side(source_name)
    return {
        "case_ref": "local-review-1",
        "reference": reference,
        "source": source,
        "market": "DE",
        "source_url": "https://world.openfoodfacts.org/product/12345678",
        "reference_public_sha256": advisory.digest(reference),
        "source_public_sha256": advisory.digest(source),
        "deterministic": {"state": state, "reasons": ["identity_text_change_requires_review"], "authoritative": True},
    }


def input_document(*cases: dict) -> dict:
    return {"schema_version": 1, "cohort_id": "shadow-1", "cases": list(cases or [raw_case()])}


def prepare_run(tmp_path, monkeypatch, *cases: dict):
    monkeypatch.setattr(advisory, "REPORT_ROOT", tmp_path / "reports")
    source = advisory.REPORT_ROOT / "inbox" / "input.json"
    source.parent.mkdir(parents=True)
    source.write_text(json.dumps(input_document(*cases)), encoding="utf-8")
    return advisory.prepare(source, advisory.REPORT_ROOT / "run")


def valid_response(identity: str = "insufficient_evidence") -> dict:
    identity_probabilities = {"consistent": 0.05, "inconsistent": 0.05, "insufficient_evidence": 0.9}
    if identity != "insufficient_evidence":
        identity_probabilities = {"consistent": 0.05, "inconsistent": 0.05, "insufficient_evidence": 0.05}
        identity_probabilities[identity] = 0.9
    return {
        "model": advisory.MODEL,
        "answers": {
            "identity": {
                "type": "choice",
                "choice": identity,
                "probabilities": identity_probabilities,
                "confidence": 0.85,
            },
            "variant_conflict": {
                "type": "choice",
                "choice": "insufficient_evidence",
                "probabilities": {"conflict": 0.05, "no_explicit_conflict": 0.05, "insufficient_evidence": 0.9},
                "confidence": 0.85,
            },
            "meaning_change": {
                "type": "choice",
                "choice": "insufficient_evidence",
                "probabilities": {"cosmetic": 0.05, "substantive": 0.05, "insufficient_evidence": 0.9},
                "confidence": 0.85,
            },
        },
        "usage": {"input_tokens": 500, "output_tokens": 100},
    }


class FakeResponse:
    def __init__(self, status: int = 200, body: dict | None = None, headers: dict | None = None, invalid_json=False):
        self.status_code = status
        self.body = body if body is not None else valid_response()
        self.headers = headers or {}
        self.invalid_json = invalid_json

    def json(self):
        if self.invalid_json:
            raise requests.JSONDecodeError("bad", "x", 0)
        return self.body


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def test_exact_model_and_validated_prompt_hash():
    assert advisory.MODEL == "jev-1.13.0"
    assert advisory.PROMPT_ID == "generic-abstention-v2"
    assert advisory.digest(advisory.QUESTIONS) == advisory.PROMPT_SHA256


def test_prepare_keeps_only_allowlisted_outbound_fields(tmp_path, monkeypatch):
    manifest = advisory.load_manifest(prepare_run(tmp_path, monkeypatch))
    state = manifest["cases"][0]["state"]
    assert set(state) == {"market", "reference", "candidate"}
    assert set(state["reference"]) == advisory.IDENTITY_FIELDS
    assert "case_ref" not in json.dumps(state)
    assert "deterministic" not in json.dumps(state)


@pytest.mark.parametrize("private_field", ["user_id", "saved_product", "review_note", "product_id", "trust_score"])
def test_private_or_internal_field_is_rejected(private_field):
    case = raw_case()
    case[private_field] = "private"
    with pytest.raises(advisory.AdvisoryError, match="private or unknown"):
        advisory.sanitize_case(case)


def test_public_field_hash_mismatch_is_rejected():
    case = raw_case()
    case["source"]["brand"] = "Changed"
    with pytest.raises(advisory.AdvisoryError, match="hash mismatch"):
        advisory.sanitize_case(case)


def test_all_file_io_is_confined_to_advisory_root(tmp_path, monkeypatch):
    monkeypatch.setattr(advisory, "REPORT_ROOT", tmp_path / "reports")
    outside = tmp_path / "outside.json"
    outside.write_text(json.dumps(input_document(raw_case())), encoding="utf-8")

    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.read_json(outside)
    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.write_new(outside, {})
    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.write_atomic(outside, {})
    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.prepare(outside, advisory.REPORT_ROOT / "run")


def test_output_traversal_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(advisory, "REPORT_ROOT", tmp_path / "reports")
    source = advisory.REPORT_ROOT / "inbox" / "input.json"
    source.parent.mkdir(parents=True)
    source.write_text(json.dumps(input_document(raw_case())), encoding="utf-8")

    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.prepare(source, advisory.REPORT_ROOT / ".." / "escaped")


def test_atomic_write_cleans_owned_temporary_file_on_replace_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(advisory, "REPORT_ROOT", tmp_path / "reports")
    advisory.REPORT_ROOT.mkdir()

    def fail_replace(_source, _destination):
        raise OSError("simulated replace failure")

    monkeypatch.setattr(advisory.os, "replace", fail_replace)
    with pytest.raises(OSError, match="simulated replace failure"):
        advisory.write_atomic(advisory.REPORT_ROOT / "run" / "results.json", {"advisory_only": True})
    assert list(advisory.REPORT_ROOT.glob(".jev-advisory-*.tmp")) == []


def test_offline_is_default_and_never_calls_provider(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    session = FakeSession()
    results = advisory.read_json(advisory.evaluate(manifest, session=session))
    assert session.calls == []
    assert results["cases"][0]["execution_status"] == "offline_disabled"


def test_deterministic_conflict_is_authoritative_and_skips_provider(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch, raw_case("conflict"))
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse(body=valid_response("consistent")))
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    result = results["cases"][0]
    assert session.calls == []
    assert result["execution_status"] == "skipped_deterministic_authority"
    assert result["deterministic_review_state"]["state"] == "conflict"
    assert result["identity"] is None


def test_missing_key_records_failure_without_provider_call(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    session = FakeSession()
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    assert session.calls == []
    assert results["cases"][0]["execution_status"] == "failed_missing_credentials"


def test_live_request_contains_only_frozen_public_state(tmp_path, monkeypatch):
    manifest_path = prepare_run(tmp_path, monkeypatch)
    manifest = advisory.load_manifest(manifest_path)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse())
    results = advisory.read_json(advisory.evaluate(manifest_path, jev_live=True, session=session))
    sent = session.calls[0][1]["json"]
    assert sent == {"state": manifest["cases"][0]["state"], "model": advisory.MODEL, "questions": advisory.QUESTIONS}
    result = results["cases"][0]
    assert result["advisory_only"] is True
    assert result["identity"]["answer"] == "insufficient_evidence"
    assert result["deterministic_review_state"]["state"] == "semantic_ambiguity"


def test_probability_rounding_is_preserved():
    response = valid_response()
    response["answers"]["variant_conflict"]["probabilities"] = {
        "conflict": 0.02,
        "no_explicit_conflict": 0.93,
        "insufficient_evidence": 0.04,
    }
    result = advisory.validate_response(response)
    probabilities = result["answers"]["variant_conflict"]["probabilities"]
    assert sum(probabilities.values()) == pytest.approx(0.99)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda value: value.update(model="jev-latest"),
        lambda value: value["answers"].update(identity=None),
        lambda value: value["answers"]["identity"].update(choice="unknown"),
        lambda value: value["answers"]["identity"]["probabilities"].update(consistent=0.5),
        lambda value: value["answers"]["identity"]["probabilities"].update(consistent=float("nan")),
    ],
)
def test_malformed_provider_answers_fail_closed(mutation):
    response = valid_response()
    mutation(response)
    with pytest.raises(advisory.AdvisoryError):
        advisory.validate_response(response)


def test_timeout_retries_twice_then_records_failure(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(requests.Timeout(), requests.Timeout(), requests.Timeout())
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session, sleep=lambda _: None))
    assert len(session.calls) == 3
    assert results["cases"][0]["execution_status"] == "failed_transient"


def test_rate_limit_honors_retry_and_completes(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    delays = []
    session = FakeSession(FakeResponse(429, headers={"Retry-After": "2"}), FakeResponse())
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session, sleep=delays.append))
    assert delays == [2]
    assert len(session.calls) == 2
    assert results["cases"][0]["execution_status"] == "completed"


def test_authentication_failure_does_not_retry(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse(401))
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    assert len(session.calls) == 1
    assert results["cases"][0]["execution_status"] == "failed_authentication"


def test_authentication_failure_stops_later_advisory_calls(tmp_path, monkeypatch):
    second = raw_case(source_name="Another")
    second["case_ref"] = "local-review-2"
    second["source_public_sha256"] = advisory.digest(second["source"])
    manifest = prepare_run(tmp_path, monkeypatch, raw_case(), second)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse(401), FakeResponse())
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    assert len(session.calls) == 1
    assert [case["execution_status"] for case in results["cases"]] == [
        "failed_authentication",
        "not_attempted_terminal_provider_error",
    ]


def test_request_validation_failure_does_not_retry(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse(422))
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    assert len(session.calls) == 1
    assert results["cases"][0]["execution_status"] == "failed_request_validation"


def test_unexpected_model_records_specific_failure(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    response = valid_response()
    response["model"] = "jev-substituted"
    results = advisory.read_json(
        advisory.evaluate(manifest, jev_live=True, session=FakeSession(FakeResponse(body=response)))
    )
    assert results["cases"][0]["execution_status"] == "failed_unexpected_model"


def test_invalid_json_is_local_advisory_failure(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    session = FakeSession(FakeResponse(invalid_json=True))
    results = advisory.read_json(advisory.evaluate(manifest, jev_live=True, session=session))
    assert results["cases"][0]["execution_status"] == "failed_invalid_json"
    assert results["cases"][0]["deterministic_review_state"]["state"] == "semantic_ambiguity"


def test_resume_requires_identical_manifest_prompt_and_model(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    advisory.evaluate(manifest)
    results_path = manifest.parent / "results.json"
    results = advisory.read_json(results_path)
    results["prompt_sha256"] = "0" * 64
    results_path.write_text(json.dumps(results), encoding="utf-8")
    with pytest.raises(advisory.AdvisoryError, match="identical manifest"):
        advisory.evaluate(manifest)


def test_report_escapes_malicious_product_text(tmp_path, monkeypatch):
    case = raw_case(source_name="</script><img src=x onerror=alert(1)>")
    manifest = prepare_run(tmp_path, monkeypatch, case)
    advisory.evaluate(manifest)
    rendered = advisory.report(manifest).read_text(encoding="utf-8")
    assert "</script><img" not in rendered
    assert "\\u003c/script\\u003e\\u003cimg" in rendered
    assert "ADVISORY — NOT AN APPROVAL DECISION" in rendered
    assert "approve" not in rendered.lower()
    assert "!value || !value.probabilities" in rendered


def test_shadow_label_template_is_created_only_after_inference(tmp_path, monkeypatch):
    manifest = prepare_run(tmp_path, monkeypatch)
    with pytest.raises(advisory.AdvisoryError, match="only after"):
        advisory.init_shadow_labels(manifest, advisory.REPORT_ROOT / "labels-before.json")
    advisory.evaluate(manifest)
    labels = advisory.read_json(advisory.init_shadow_labels(manifest, advisory.REPORT_ROOT / "labels.json"))
    assert labels["labels_created_after_inference"] is True
    assert labels["promotion_target_minimum_cases"] == 150
    assert labels["entries"][0]["human_final_label"] is None

    with pytest.raises(advisory.AdvisoryError, match="must stay below"):
        advisory.init_shadow_labels(manifest, tmp_path / "escaped-labels.json")


def test_module_has_no_database_or_write_dependency():
    source = inspect.getsource(advisory).lower()
    for forbidden in ("supabase", "psycopg", "sqlalchemy", "observation_sql", "ingestion_apply_observation"):
        assert forbidden not in source
    assert "insert into" not in source
    assert "update public." not in source
