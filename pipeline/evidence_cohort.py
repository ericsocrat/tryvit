"""Frozen sixty-product reconciliation: GET-only collection and dry-run SQL.

This compares retained catalog values with a later OFF observation. Agreement
does not verify package facts; differences may be refresh, identity, extraction,
or source changes. Unknown nutrition basis is never inferred from a category.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import requests

from pipeline import off_client
from pipeline.observations import NUTRIENTS, observation_sql, seal_observation

ROOT = Path(__file__).resolve().parent.parent
COHORT_PATH = ROOT / "data-quality/cohorts/evidence-first-v1.json"
REPORT_ROOT = ROOT / "audit-reports/evidence-cohort"
GROUPS = {
    (market, category)
    for market in ("PL", "DE")
    for category in ("Dairy", "Bread", "Cereals", "Drinks", "Sauces", "Snacks")
}


def load_cohort(path: Path) -> tuple[dict, str]:
    content = path.read_bytes()
    cohort = json.loads(content)
    members = cohort["members"]
    counts = Counter((member["country"], member["category"]) for member in members)
    identities = {(member["country"], member["ean"]) for member in members}
    ids = {member["product_id"] for member in members}
    if (
        len(members) != 60
        or len(identities) != 60
        or len(ids) != 60
        or set(counts) != GROUPS
        or set(counts.values()) != {5}
    ):
        raise ValueError("Cohort must retain sixty unique members, five in every fixed stratum")
    if not {628, 2882}.issubset(ids):
        raise ValueError("Audited skyr records must remain in the fixed cohort")
    for member in members:
        ean = member["ean"]
        if not isinstance(ean, str) or not ean.isascii() or not ean.isdigit() or len(ean) not in (8, 12, 13, 14):
            raise ValueError("Invalid frozen barcode")
    return cohort, hashlib.sha256(content).hexdigest()


class _RecordedResponse:
    def __init__(self, response: requests.Response, attempt: dict):
        self.response = response
        self.attempt = attempt
        self.headers = response.headers
        self.status_code = response.status_code

    def raise_for_status(self):
        self.response.raise_for_status()

    def json(self):
        try:
            return self.response.json()
        except ValueError:
            self.attempt["parse_error"] = "invalid_json"
            raise


class _RecordedSession:
    """Keep dispositions, never whole request headers or upstream error bodies."""

    def __init__(self, session: requests.Session, attempts: list[dict]):
        self.session = session
        self.attempts = attempts

    def get(self, url, **kwargs):
        attempt = {"started_at": datetime.now(UTC).isoformat(), "http_status": None}
        self.attempts.append(attempt)
        start = time.monotonic()
        try:
            response = self.session.get(url, **kwargs)
            attempt["http_status"] = response.status_code
            if response.headers.get("Retry-After"):
                attempt["retry_after"] = response.headers["Retry-After"]
            return _RecordedResponse(response, attempt)
        except (requests.RequestException, TimeoutError, ConnectionError) as exc:
            attempt["error_type"] = type(exc).__name__
            raise
        finally:
            attempt["elapsed_seconds"] = round(time.monotonic() - start, 3)


def fetch_member(member: dict, session: requests.Session) -> tuple[dict, dict | None]:
    url = off_client.OFF_PRODUCT_URL.format(ean=member["ean"])
    attempts: list[dict] = []
    result = {**member, "url": url, "status": "unavailable", "attempts": attempts}
    try:
        data = off_client._get_json(_RecordedSession(session, attempts), url, {})
    except off_client.OffRateLimitDeferredError:
        return {**result, "reason": "provider_retry_after_deferred"}, None
    if data is None:
        last = attempts[-1] if attempts else {}
        reason = last.get("parse_error") or last.get("error_type") or "empty_response"
        if last.get("http_status", 0) and last["http_status"] >= 400:
            reason = f"http_{last['http_status']}"
        return {**result, "reason": reason}, None
    if isinstance(data, dict) and data.get("status") == 0:
        return {**result, "status": "not_found", "reason": "off_product_not_found"}, None
    if not isinstance(data, dict) or data.get("status") != 1 or not isinstance(data.get("product"), dict):
        return {**result, "status": "invalid_response", "reason": "off_product_response_shape_invalid"}, None
    raw = off_client._with_fetch_metadata(data["product"], off_client._utc_now_iso())
    try:
        product = off_client.extract_product_data(raw)
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        return {
            **result,
            "status": "invalid_response",
            "reason": "extractor_rejected_shape",
            "error_type": type(exc).__name__,
        }, None
    if product is None:
        return {**result, "status": "invalid_source_identity", "reason": "source_identity_unrepresentable"}, None
    observation = product["_source_observation"]
    if observation["external_id"] != member["ean"]:
        return {
            **result,
            "status": "source_identity_mismatch",
            "reason": "returned_barcode_differs_from_frozen_member",
        }, product
    return {**result, "status": "fetched", "reason": None}, product


def reconcile(member: dict, reference: dict, product: dict) -> dict:
    observation = product["_source_observation"]
    comparisons = []
    for field in NUTRIENTS:
        stored = reference.get("stored_nutrition", {}).get(field)
        observed = observation["extracted_fields"][field]
        current = observed.get("value")
        if observed["state"] in ("invalid", "conflicting"):
            disposition = "invalid_or_conflicting_source"
        elif current is None:
            disposition = "missing_in_both" if stored is None else "missing_from_source"
        elif stored is None:
            disposition = "new_source_value"
        elif observed.get("qualifier") != "eq":
            disposition = "qualified_source_not_exactly_comparable"
        else:
            try:
                disposition = (
                    "literal_numeric_agreement"
                    if Decimal(str(stored)) == Decimal(str(current))
                    else "literal_numeric_difference"
                )
            except InvalidOperation:
                disposition = "invalid_stored_value"
        comparisons.append(
            {
                "field": field,
                "stored_value": stored,
                "source_value": current,
                "qualifier": observed.get("qualifier"),
                "source_basis": observed.get("basis"),
                "stored_basis": "unrecorded",
                "disposition": disposition,
            }
        )
    identity = {**observation["identity"], "category": observation["extracted_fields"].get("category", {}).get("value")}
    return {
        "product_id": member["product_id"],
        "nutrition": comparisons,
        "identity_differences": [
            {"field": field, "stored": reference.get(field), "source": identity.get(field)}
            for field in ("brand", "product_name", "category")
            if reference.get(field) != identity.get(field)
        ],
        "source_revision": observation["source_revision"],
        "payload_hash": observation["payload_hash"],
        "source_updated_at": observation["source_updated_at"],
        "retrieved_at": observation["retrieved_at"],
        "independent_package_verification": False,
    }


def _write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def verify_saved_run(output: Path, cohort_path: Path = COHORT_PATH) -> dict:
    """Recheck retained bytes and envelope identity without another source read."""
    manifest, digest = load_cohort(cohort_path)
    output = output.resolve()
    receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
    keys = ("product_id", "country", "category", "ean")
    if receipt["cohort_sha256"] != digest or [tuple(m[key] for key in keys) for m in receipt["members"]] != [
        tuple(m[key] for key in keys) for m in manifest["members"]
    ]:
        raise ValueError("Retained run membership differs from frozen cohort")
    if receipt.get("counts") != dict(Counter(m["status"] for m in receipt["members"])):
        raise ValueError("Receipt counts differ from retained outcomes")
    verified = 0
    for member in receipt["members"]:
        if not member.get("observation_file"):
            if member["status"] == "fetched":
                raise ValueError("Fetched outcome has no retained observation")
            continue
        path = (output / member["observation_file"]).resolve()
        if not path.is_relative_to(output):
            raise ValueError("Observation file escaped run directory")
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != member["observation_sha256"]:
            raise ValueError("Observation file hash mismatch")
        record = json.loads(data)
        payload = json.loads(record["payload_canonical"])
        if (
            hashlib.sha256(record["payload_canonical"].encode()).hexdigest() != record["payload_hash"]
            or payload != record["sanitized_payload"]
        ):
            raise ValueError("Canonical observation hash mismatch")
        expected_identity = record["external_id"] == member["ean"] or member["status"] == "source_identity_mismatch"
        if (
            not expected_identity
            or payload["code"] != record["external_id"]
            or payload["extraction"] != record["extracted_fields"]
        ):
            raise ValueError("Retained observation identity or extraction mismatch")
        verified += 1
    return {
        "cohort_sha256": digest,
        "retained_members": len(receipt["members"]),
        "verified_observation_files": verified,
        "counts": receipt.get("counts", {}),
        "network_requests": 0,
    }


def run_cohort(cohort_path: Path, reference_path: Path, output: Path) -> dict:
    cohort, cohort_hash = load_cohort(cohort_path)
    output = output.resolve()
    if not output.is_relative_to(REPORT_ROOT.resolve()) or output == REPORT_ROOT.resolve():
        raise ValueError("Run output must be a new child directory under audit-reports/evidence-cohort")
    reference_document = json.loads(reference_path.read_text(encoding="utf-8"))
    references = {row["product_id"]: row for row in reference_document["members"]}
    if set(references) != {m["product_id"] for m in cohort["members"]}:
        raise ValueError("Reference snapshot membership differs from frozen cohort")
    for member in cohort["members"]:
        if any(references[member["product_id"]].get(key) != member[key] for key in ("country", "category", "ean")):
            raise ValueError("Reference snapshot scope differs from frozen cohort")
    output.mkdir(parents=True, exist_ok=False)
    receipt = {
        "schema_version": 1,
        "cohort_id": cohort["cohort_id"],
        "cohort_sha256": cohort_hash,
        "started_at": datetime.now(UTC).isoformat(),
        "reference_captured_at": reference_document["captured_at"],
        "method": "Frozen source reconciliation; no production writes; no sample replacement",
        "limitations": [
            "OFF is a contributed source, not independent package verification",
            "Stored nutrient basis is unrecorded; numeric agreement is literal only",
            "Unknown source mass/volume basis remains unknown",
            "SQL is a dry-run artifact, not import authorization",
        ],
        "rate_policy": {
            "product_interval_seconds": off_client.PRODUCT_REQUEST_INTERVAL,
            "search_interval_seconds": off_client.SEARCH_REQUEST_INTERVAL,
            "documentation": "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/",
        },
        "members": [],
        "reconciliation": [],
    }
    # Existing client retries/rate limiter remain authoritative. Suppress raw
    # exception logging; the recorder retains only typed endpoint dispositions.
    previous_level = off_client.logger.level
    off_client.logger.setLevel(logging.ERROR)
    consecutive_external_failures = 0
    stop_reason = None
    statements = ["-- DRY RUN ONLY. Frozen cohort; never execute against production without separate release review."]
    try:
        with off_client._session() as session:
            for member in cohort["members"]:
                if stop_reason:
                    receipt["members"].append(
                        {**member, "status": "not_attempted", "reason": stop_reason, "attempts": []}
                    )
                    continue
                outcome, product = fetch_member(member, session)
                receipt["members"].append(outcome)
                consecutive_external_failures = (
                    consecutive_external_failures + 1 if outcome["status"] == "unavailable" else 0
                )
                if outcome.get("reason") == "provider_retry_after_deferred" or consecutive_external_failures >= 3:
                    stop_reason = "external_service_circuit_open_after_retained_failures"
                if product is not None:
                    # Routing retains the frozen market/category. Source-derived
                    # category remains separately recorded in extracted_fields.
                    source = product["_source_observation"]
                    source["identity"] = {**source["identity"], "category": member["category"]}
                    product["_source_observation"] = seal_observation(source)
                    name = f"{member['country']}-{member['product_id']}-{member['ean']}.observation.json"
                    _write_json(output / name, product["_source_observation"])
                    outcome["observation_file"] = name
                    outcome["observation_sha256"] = hashlib.sha256((output / name).read_bytes()).hexdigest()
                    receipt["reconciliation"].append(reconcile(member, references[member["product_id"]], product))
                    if outcome["status"] == "fetched":
                        statements.append(observation_sql(member["category"], [product], member["country"]))
                _write_json(output / "receipt.json", receipt)
                sys.stdout.write(
                    f"{len(receipt['members'])}/60 {member['country']} {member['product_id']}: {outcome['status']}\n"
                )
                sys.stdout.flush()
    finally:
        off_client.logger.setLevel(previous_level)
    receipt["finished_at"] = datetime.now(UTC).isoformat()
    receipt["counts"] = dict(Counter(row["status"] for row in receipt["members"]))
    receipt["numeric_dispositions"] = dict(
        Counter(field["disposition"] for row in receipt["reconciliation"] for field in row["nutrition"])
    )
    receipt["unknown_basis_fields"] = sum(
        field["source_basis"] == "unknown" for row in receipt["reconciliation"] for field in row["nutrition"]
    )
    if hashlib.sha256(cohort_path.read_bytes()).hexdigest() != cohort_hash:
        raise ValueError("Cohort changed during collection")
    _write_json(output / "receipt.json", receipt)
    (output / "dry-run.sql").write_text("\n".join(statements), encoding="utf-8")
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cohort", type=Path, default=COHORT_PATH)
    parser.add_argument("--reference", type=Path, default=REPORT_ROOT / "production-reference.json")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fetch", action="store_true", help="Explicitly perform GET-only OFF collection")
    parser.add_argument("--verify-saved-run", type=Path, help="Verify existing artifacts without source requests")
    args = parser.parse_args()
    if args.verify_saved_run:
        if args.fetch:
            parser.error("Saved-run verification cannot fetch")
        sys.stdout.write(json.dumps(verify_saved_run(args.verify_saved_run, args.cohort)) + "\n")
        return
    cohort, digest = load_cohort(args.cohort)
    if not args.fetch:
        sys.stdout.write(
            json.dumps({"status": "validated_only", "members": len(cohort["members"]), "cohort_sha256": digest}) + "\n"
        )
        return
    if args.output is None:
        parser.error("--fetch requires a new --output directory")
    result = run_cohort(args.cohort, args.reference, args.output)
    sys.stdout.write(json.dumps({"cohort_sha256": digest, "counts": result["counts"], "production_writes": 0}) + "\n")


if __name__ == "__main__":
    main()
