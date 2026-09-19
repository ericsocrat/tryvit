"""Offline-first, read-only JEV shadow advisory for source identity review.

This module consumes a local deterministic review manifest and emits local
evidence. It has no database client, SQL generator, ingestion hook, or source
selection return value.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent
REPORT_ROOT = ROOT / "audit-reports/jev-advisory"
TEMPLATE_PATH = ROOT / "pipeline/templates/jev-advisory-report.html"
API_URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-1.13.0"
PROMPT_ID = "generic-abstention-v2"
PROMPT_SHA256 = "014135aad814b77554b79680146e5156c11e6f12b0f756127d290b468b846447"
PRICE_PER_MILLION_INPUT_TOKENS = 0.042
PROBABILITY_SUM_TOLERANCE = 0.011
PUBLIC_FIELDS = frozenset({"product_name", "brand", "variant", "package", "quantity", "market"})
IDENTITY_FIELDS = frozenset({"product_name", "brand", "variant", "package", "quantity"})
DETERMINISTIC_STATES = frozenset({"semantic_ambiguity", "conflict", "consistent", "insufficient_evidence"})
OPTIONS = {
    "identity": frozenset({"consistent", "inconsistent", "insufficient_evidence"}),
    "variant_conflict": frozenset({"conflict", "no_explicit_conflict", "insufficient_evidence"}),
    "meaning_change": frozenset({"cosmetic", "substantive", "insufficient_evidence"}),
}
QUESTIONS = {
    "identity": {
        "type": "choice",
        "instructions": (
            "Classify whether the two records identify the same specific retail product using only explicit supplied "
            "evidence. Missing, generic, category-only, or ambiguous candidate text does not prove a mismatch; choose "
            "insufficient_evidence whenever both consistency and inconsistency remain possible. Choose inconsistent "
            "only for an explicit incompatible brand, product kind, flavor, formulation, preparation, package form, "
            "pack count, or quantity. Treat casing, punctuation, spacing, compound-word segmentation, descriptor "
            "order, abbreviation expansion, grammatical inflection, and equivalent quantities as cosmetic when "
            "meaning is preserved."
        ),
        "criteria": {
            "consistent": "Enough explicit identity evidence agrees and every difference is meaning-preserving.",
            "inconsistent": "At least one explicit identity attribute is incompatible.",
            "insufficient_evidence": (
                "Evidence is missing, generic, or ambiguous, with no explicit contradiction that proves a mismatch."
            ),
        },
    },
    "variant_conflict": {
        "type": "choice",
        "instructions": (
            "Using only explicit fields, determine whether flavor, formulation, preparation, package form, pack count, "
            "or quantity conflicts. Missing or generic fields are insufficient evidence, not a conflict. Equivalent "
            "quantity expressions do not conflict."
        ),
        "criteria": {
            "conflict": "An explicit variant or package attribute is incompatible.",
            "no_explicit_conflict": "Explicit supplied variant and package attributes are compatible.",
            "insufficient_evidence": "The relevant fields are absent, generic, or ambiguous.",
        },
    },
    "meaning_change": {
        "type": "choice",
        "instructions": (
            "Judge whether explicit wording differences change identity meaning. Ignore casing, punctuation, spacing, "
            "compound segmentation, descriptor order, abbreviation expansion, grammatical inflection, and equivalent "
            "quantities. If sparse wording prevents comparison, choose insufficient_evidence."
        ),
        "criteria": {
            "cosmetic": "The wording differs but preserves identity meaning.",
            "substantive": "An explicit difference changes identity meaning.",
            "insufficient_evidence": "There is not enough explicit meaning to compare.",
        },
    },
}


class AdvisoryError(ValueError):
    """Fail-closed local validation error."""


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


if digest(QUESTIONS) != PROMPT_SHA256:
    raise RuntimeError("Frozen JEV advisory prompt hash mismatch")


def read_json(path: Path) -> Any:
    path = confined(path, must_exist=True)
    return json.loads(path.read_text(encoding="utf-8"))


def write_new(path: Path, value: Any) -> None:
    path = confined(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")


def write_atomic(path: Path, value: Any) -> None:
    path = confined(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def confined(path: Path, *, must_exist: bool = False) -> Path:
    boundary = REPORT_ROOT.resolve()
    candidate = Path(path).absolute()
    if ".." in Path(path).parts or candidate == boundary or not candidate.is_relative_to(boundary):
        raise AdvisoryError("Advisory file path must stay below audit-reports/jev-advisory")
    for component in (candidate, *candidate.parents):
        if component == boundary:
            break
        if component.exists() and (component.is_symlink() or getattr(component, "is_junction", lambda: False)()):
            raise AdvisoryError("Advisory output cannot contain links or junctions")
    resolved = candidate.resolve(strict=must_exist)
    if resolved == boundary or not resolved.is_relative_to(boundary):
        raise AdvisoryError("Advisory file path escaped its root")
    return resolved


def clean_text(value: Any, *, maximum: int = 500) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise AdvisoryError("Public identity fields must be strings or null")
    value = " ".join(value.split())
    if len(value) > maximum:
        raise AdvisoryError("Public identity field exceeds its length limit")
    return value or None


def validate_public_side(value: Any) -> dict:
    if not isinstance(value, dict) or not set(value).issubset(PUBLIC_FIELDS) or "market" in value:
        raise AdvisoryError("Identity side contains a private or unknown field")
    if set(value) != IDENTITY_FIELDS:
        raise AdvisoryError("Identity side must declare the complete public-field allowlist")
    return {field: clean_text(value[field]) for field in sorted(IDENTITY_FIELDS)}


def sanitize_case(raw: Any) -> dict:
    expected = {
        "case_ref",
        "reference",
        "source",
        "market",
        "source_url",
        "reference_public_sha256",
        "source_public_sha256",
        "deterministic",
    }
    if not isinstance(raw, dict) or set(raw) != expected:
        raise AdvisoryError("Review case contains a private or unknown field")
    case_ref = clean_text(raw["case_ref"], maximum=200)
    if not case_ref:
        raise AdvisoryError("Local case reference is required")
    market = clean_text(raw["market"], maximum=8)
    if market not in {"PL", "DE"}:
        raise AdvisoryError("Market must be PL or DE")
    source_url = clean_text(raw["source_url"], maximum=1000)
    if not source_url or not source_url.startswith("https://"):
        raise AdvisoryError("Source URL must be public HTTPS")
    hashes = {}
    for key in ("reference_public_sha256", "source_public_sha256"):
        value = raw[key]
        if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
            raise AdvisoryError(f"{key} must be a lowercase SHA-256")
        hashes[key] = value
    deterministic = raw["deterministic"]
    if not isinstance(deterministic, dict) or set(deterministic) != {"state", "reasons", "authoritative"}:
        raise AdvisoryError("Deterministic review state has an unexpected shape")
    if deterministic["state"] not in DETERMINISTIC_STATES or deterministic["authoritative"] is not True:
        raise AdvisoryError("Deterministic review must be explicit and authoritative")
    reasons = deterministic["reasons"]
    if not isinstance(reasons, list) or any(not isinstance(reason, str) or not reason for reason in reasons):
        raise AdvisoryError("Deterministic reasons must be non-empty strings")
    reference, source = validate_public_side(raw["reference"]), validate_public_side(raw["source"])
    if hashes["reference_public_sha256"] != digest(reference) or hashes["source_public_sha256"] != digest(source):
        raise AdvisoryError("Public identity hash mismatch")
    outbound_state = {"market": market, "reference": reference, "candidate": source}
    local_input = {
        "case_ref": case_ref,
        "market": market,
        "reference": reference,
        "source": source,
        "source_url": source_url,
        **hashes,
        "deterministic": {"state": deterministic["state"], "reasons": reasons, "authoritative": True},
    }
    return {
        "local_case_hash": digest({"case_ref": case_ref, "input": local_input}),
        "product_family_hash": digest(
            {"market": market, "brand": reference["brand"], "name": reference["product_name"]}
        ),
        "input_sha256": digest(local_input),
        "reference_public_sha256": hashes["reference_public_sha256"],
        "source_public_sha256": hashes["source_public_sha256"],
        "source_url": source_url,
        "deterministic_review": local_input["deterministic"],
        "state": outbound_state,
        "state_sha256": digest(outbound_state),
    }


def load_input(path: Path) -> dict:
    document = read_json(path)
    if not isinstance(document, dict) or set(document) != {"schema_version", "cohort_id", "cases"}:
        raise AdvisoryError("Unknown advisory input schema")
    if document["schema_version"] != 1 or not isinstance(document["cohort_id"], str):
        raise AdvisoryError("Invalid advisory input envelope")
    if not isinstance(document["cases"], list) or not document["cases"]:
        raise AdvisoryError("Advisory input requires at least one case")
    cases = [sanitize_case(case) for case in document["cases"]]
    hashes = [case["local_case_hash"] for case in cases]
    if len(set(hashes)) != len(hashes):
        raise AdvisoryError("Duplicate advisory case hash")
    return {"schema_version": 1, "cohort_id": document["cohort_id"], "cases": cases}


def prepare(input_path: Path, output: Path) -> Path:
    output = confined(output)
    if output.exists():
        raise AdvisoryError("Prepared advisory run must use a new directory")
    prepared = load_input(input_path)
    manifest = {
        "schema_version": 1,
        "contract": "JEVSourceReviewAdvisoryV1",
        "created_at": datetime.now(UTC).isoformat(),
        "cohort_id": prepared["cohort_id"],
        "advisory_only": True,
        "requested_model_id": MODEL,
        "prompt_id": PROMPT_ID,
        "prompt_sha256": PROMPT_SHA256,
        "questions": QUESTIONS,
        "case_count": len(prepared["cases"]),
        "cases": prepared["cases"],
    }
    manifest["manifest_sha256"] = digest({key: value for key, value in manifest.items() if key != "manifest_sha256"})
    output.mkdir(parents=True)
    write_new(output / "manifest.json", manifest)
    return output / "manifest.json"


def load_manifest(path: Path) -> dict:
    manifest = read_json(path)
    if manifest.get("manifest_sha256") != digest(
        {key: value for key, value in manifest.items() if key != "manifest_sha256"}
    ):
        raise AdvisoryError("Manifest hash mismatch")
    if (
        manifest.get("contract") != "JEVSourceReviewAdvisoryV1"
        or manifest.get("advisory_only") is not True
        or manifest.get("requested_model_id") != MODEL
        or manifest.get("prompt_id") != PROMPT_ID
        or manifest.get("prompt_sha256") != PROMPT_SHA256
        or manifest.get("questions") != QUESTIONS
    ):
        raise AdvisoryError("Manifest model, prompt, or advisory contract drifted")
    if manifest.get("case_count") != len(manifest.get("cases", [])):
        raise AdvisoryError("Manifest case count mismatch")
    for case in manifest["cases"]:
        if case["state_sha256"] != digest(case["state"]):
            raise AdvisoryError("Manifest state hash mismatch")
    return manifest


def validate_response(document: Any) -> dict:
    if not isinstance(document, dict) or document.get("model") != MODEL:
        raise AdvisoryError("Unexpected or missing returned model ID")
    answers = document.get("answers")
    if not isinstance(answers, dict) or set(answers) != set(QUESTIONS):
        raise AdvisoryError("Provider answers do not match frozen questions")
    clean = {}
    for question_id, allowed in OPTIONS.items():
        answer = answers[question_id]
        probabilities = answer.get("probabilities") if isinstance(answer, dict) else None
        confidence = answer.get("confidence") if isinstance(answer, dict) else None
        if not isinstance(answer, dict) or answer.get("type") != "choice" or answer.get("choice") not in allowed:
            raise AdvisoryError(f"Invalid {question_id} answer")
        if not isinstance(probabilities, dict) or set(probabilities) != allowed:
            raise AdvisoryError(f"Invalid {question_id} probability keys")
        values = list(probabilities.values())
        if any(type(value) not in {int, float} or not math.isfinite(value) or value < 0 for value in values):
            raise AdvisoryError(f"Invalid {question_id} probability")
        if not math.isclose(sum(values), 1.0, abs_tol=PROBABILITY_SUM_TOLERANCE):
            raise AdvisoryError(f"Invalid {question_id} probability distribution")
        if type(confidence) not in {int, float} or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise AdvisoryError(f"Invalid {question_id} confidence")
        clean[question_id] = {
            "answer": answer["choice"],
            "probabilities": {key: float(probabilities[key]) for key in sorted(allowed)},
            "confidence": float(confidence),
        }
    usage = document.get("usage")
    if not isinstance(usage, dict) or type(usage.get("input_tokens")) is not int or usage["input_tokens"] < 0:
        raise AdvisoryError("Invalid provider usage")
    return {"returned_model_id": MODEL, "answers": clean, "input_tokens": usage["input_tokens"]}


def retry_delay(response: requests.Response | None, retry: int) -> float:
    if response is not None and response.headers.get("Retry-After"):
        try:
            return min(max(float(response.headers["Retry-After"]), 0), 30)
        except ValueError:
            pass
    return min(2**retry, 8)


def base_result(case: dict, status: str, *, attempts: list[dict] | None = None) -> dict:
    return {
        "schema_version": 1,
        "local_case_hash": case["local_case_hash"],
        "input_sha256": case["input_sha256"],
        "reference_public_sha256": case["reference_public_sha256"],
        "source_public_sha256": case["source_public_sha256"],
        "deterministic_review_state": case["deterministic_review"],
        "prompt_id": PROMPT_ID,
        "prompt_sha256": PROMPT_SHA256,
        "requested_model_id": MODEL,
        "returned_model_id": None,
        "identity": None,
        "explicit_conflict": None,
        "wording_difference": None,
        "elapsed_seconds": 0.0,
        "input_tokens": 0,
        "estimated_cost_usd": 0.0,
        "attempt_count": len(attempts or []),
        "attempts": attempts or [],
        "execution_status": status,
        "timestamp": datetime.now(UTC).isoformat(),
        "advisory_only": True,
    }


def evaluate(
    manifest_path: Path,
    *,
    jev_live: bool = False,
    session: requests.Session | None = None,
    sleep: Any = time.sleep,
) -> Path:
    manifest_path = confined(manifest_path, must_exist=True)
    manifest = load_manifest(manifest_path)
    results_path = manifest_path.parent / "results.json"
    if results_path.exists():
        document = read_json(results_path)
        if (
            document.get("manifest_sha256") != manifest["manifest_sha256"]
            or document.get("prompt_sha256") != PROMPT_SHA256
            or document.get("requested_model_id") != MODEL
        ):
            raise AdvisoryError("Resume requires identical manifest, prompt, and model hashes")
    else:
        document = {
            "schema_version": 1,
            "contract": "JEVSourceReviewAdvisoryV1",
            "manifest_sha256": manifest["manifest_sha256"],
            "prompt_sha256": PROMPT_SHA256,
            "requested_model_id": MODEL,
            "advisory_only": True,
            "started_at": datetime.now(UTC).isoformat(),
            "cases": [],
        }
    existing = {result["local_case_hash"]: result for result in document["cases"]}
    terminal_provider_error = next(
        (
            result["execution_status"]
            for result in document["cases"]
            if result["execution_status"]
            in {"failed_authentication", "failed_request_validation", "failed_unexpected_model"}
        ),
        None,
    )
    for case in manifest["cases"]:
        prior_result = existing.get(case["local_case_hash"])
        if prior_result:
            if prior_result["input_sha256"] != case["input_sha256"]:
                raise AdvisoryError("Resume input hash mismatch")
            continue
        deterministic = case["deterministic_review"]["state"]
        if deterministic != "semantic_ambiguity":
            result = base_result(case, "skipped_deterministic_authority")
        elif terminal_provider_error:
            result = base_result(case, "not_attempted_terminal_provider_error")
            result["execution_error"] = terminal_provider_error
        elif not jev_live:
            result = base_result(case, "offline_disabled")
        elif not os.environ.get("TYPESAFE_API_KEY"):
            result = base_result(case, "failed_missing_credentials")
        else:
            result = call_provider(case, session=session, sleep=sleep)
            if result["execution_status"] in {
                "failed_authentication",
                "failed_request_validation",
                "failed_unexpected_model",
            }:
                terminal_provider_error = result["execution_status"]
        document["cases"].append(result)
        write_atomic(results_path, document)
    document["finished_at"] = datetime.now(UTC).isoformat()
    document["results_sha256"] = digest({key: value for key, value in document.items() if key != "results_sha256"})
    write_atomic(results_path, document)
    return results_path


def call_provider(case: dict, *, session: requests.Session | None, sleep: Any) -> dict:
    client = session or requests.Session()
    attempts = []
    started = time.monotonic()
    try:
        for retry in range(3):
            response = None
            attempt = {"number": retry + 1, "status": None, "error": None}
            attempts.append(attempt)
            try:
                response = client.post(
                    API_URL,
                    headers={
                        "Authorization": f"Bearer {os.environ['TYPESAFE_API_KEY']}",
                        "Content-Type": "application/json",
                    },
                    json={"state": case["state"], "model": MODEL, "questions": QUESTIONS},
                    timeout=(5, 30),
                )
                attempt["status"] = response.status_code
            except (requests.Timeout, requests.ConnectionError) as exc:
                attempt["error"] = type(exc).__name__
                if retry < 2:
                    sleep(retry_delay(None, retry))
                    continue
                return failed_result(case, "failed_transient", attempts, started, type(exc).__name__)
            if response.status_code in {429, 529}:
                if retry < 2:
                    sleep(retry_delay(response, retry))
                    continue
                return failed_result(case, "failed_transient", attempts, started, f"http_{response.status_code}")
            if response.status_code == 401:
                return failed_result(case, "failed_authentication", attempts, started, "http_401")
            if response.status_code == 422:
                return failed_result(case, "failed_request_validation", attempts, started, "http_422")
            if not 200 <= response.status_code < 300:
                return failed_result(case, "failed_provider", attempts, started, f"http_{response.status_code}")
            try:
                raw = response.json()
            except requests.JSONDecodeError:
                return failed_result(case, "failed_invalid_json", attempts, started, "invalid_json")
            try:
                validated = validate_response(raw)
            except AdvisoryError as exc:
                status = "failed_unexpected_model" if "model" in str(exc).lower() else "failed_invalid_response"
                return failed_result(case, status, attempts, started, str(exc))
            result = base_result(case, "completed", attempts=attempts)
            result.update(
                {
                    "returned_model_id": validated["returned_model_id"],
                    "identity": validated["answers"]["identity"],
                    "explicit_conflict": validated["answers"]["variant_conflict"],
                    "wording_difference": validated["answers"]["meaning_change"],
                    "elapsed_seconds": round(time.monotonic() - started, 3),
                    "input_tokens": validated["input_tokens"],
                    "estimated_cost_usd": round(
                        validated["input_tokens"] / 1_000_000 * PRICE_PER_MILLION_INPUT_TOKENS, 8
                    ),
                    "attempt_count": len(attempts),
                }
            )
            return result
    finally:
        if session is None:
            client.close()
    return failed_result(case, "failed_provider", attempts, started, "unreachable")


def failed_result(case: dict, status: str, attempts: list[dict], started: float, error: str) -> dict:
    result = base_result(case, status, attempts=attempts)
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    result["execution_error"] = error
    return result


def report(manifest_path: Path) -> Path:
    manifest_path = confined(manifest_path, must_exist=True)
    manifest = load_manifest(manifest_path)
    results_path = manifest_path.parent / "results.json"
    results = read_json(results_path) if results_path.exists() else {"cases": []}
    if results.get("cases") and results.get("manifest_sha256") != manifest["manifest_sha256"]:
        raise AdvisoryError("Results do not match manifest")
    result_map = {row["local_case_hash"]: row for row in results["cases"]}
    rows = []
    for case in manifest["cases"]:
        result = result_map.get(case["local_case_hash"], base_result(case, "not_run"))
        identity = result.get("identity") or {}
        deterministic = case["deterministic_review"]["state"]
        rows.append(
            {
                "local_case_hash": case["local_case_hash"],
                "market": case["state"]["market"],
                "reference": case["state"]["reference"],
                "source": case["state"]["candidate"],
                "source_url": case["source_url"],
                "deterministic": case["deterministic_review"],
                "identity": identity,
                "explicit_conflict": result.get("explicit_conflict"),
                "wording_difference": result.get("wording_difference"),
                "status": result["execution_status"],
                "error": result.get("execution_error"),
                "disagreement": bool(identity.get("answer") and identity["answer"] != deterministic),
                "high_confidence": max(identity.get("probabilities", {}).values(), default=0) >= 0.95,
                "model": result.get("returned_model_id"),
                "prompt_id": result["prompt_id"],
                "prompt_sha256": result["prompt_sha256"],
                "elapsed_seconds": result["elapsed_seconds"],
                "input_tokens": result["input_tokens"],
                "estimated_cost_usd": result["estimated_cost_usd"],
            }
        )
    payload = (
        json.dumps({"rows": rows}, ensure_ascii=False, allow_nan=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )
    document = TEMPLATE_PATH.read_text(encoding="utf-8").replace("__PAYLOAD__", payload)
    report_path = manifest_path.parent / "report.html"
    report_path.write_text(document, encoding="utf-8", newline="\n")
    return report_path


def init_shadow_labels(manifest_path: Path, output: Path) -> Path:
    manifest_path = confined(manifest_path, must_exist=True)
    output = confined(output)
    manifest = load_manifest(manifest_path)
    results_path = manifest_path.parent / "results.json"
    if not results_path.exists():
        raise AdvisoryError("Shadow labels can be initialized only after advisory inference")
    results = read_json(results_path)
    if results.get("manifest_sha256") != manifest["manifest_sha256"]:
        raise AdvisoryError("Results do not match manifest")
    template = {
        "schema_version": 1,
        "cohort_id": manifest["cohort_id"],
        "manifest_sha256": manifest["manifest_sha256"],
        "results_sha256": results.get("results_sha256"),
        "labels_created_after_inference": True,
        "promotion_target_minimum_cases": 150,
        "entries": [
            {
                "local_case_hash": case["local_case_hash"],
                "product_family_hash": case["product_family_hash"],
                "human_final_label": None,
                "reviewer_effort_reduced": None,
                "reviewed_at": None,
                "review_note": None,
            }
            for case in manifest["cases"]
        ],
    }
    write_new(output, template)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare_parser = subparsers.add_parser("prepare")
    prepare_parser.add_argument("--input", type=Path, required=True)
    prepare_parser.add_argument("--output", type=Path, required=True)
    evaluate_parser = subparsers.add_parser("evaluate")
    evaluate_parser.add_argument("--manifest", type=Path, required=True)
    evaluate_parser.add_argument("--jev-live", action="store_true")
    report_parser = subparsers.add_parser("report")
    report_parser.add_argument("--manifest", type=Path, required=True)
    label_parser = subparsers.add_parser("init-shadow-labels")
    label_parser.add_argument("--manifest", type=Path, required=True)
    label_parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        path = prepare(args.input, args.output)
    elif args.command == "evaluate":
        path = evaluate(args.manifest, jev_live=args.jev_live)
    elif args.command == "report":
        path = report(args.manifest)
    else:
        path = init_shadow_labels(args.manifest, args.output)
    sys.stdout.write(json.dumps({"status": "ok", "path": str(path)}) + "\n")


if __name__ == "__main__":
    main()
