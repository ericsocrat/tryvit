"""Bounded, resumable OFF acquisition for a frozen source-expansion cohort."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Callable
from pathlib import Path

from pipeline.observations import NUTRIENTS
from pipeline.off_client import extract_product_data, fetch_product_by_ean_result

SELECTION_PROFILE = "source-expansion-selection-v1"
ACQUISITION_PROFILE = "source-expansion-acquisition-v1"
RELEASE_PROFILE = "source-expansion-cohort-v1"
STATUSES = frozenset(
    {
        "SOURCE_MATCH_ACCEPTED",
        "SOURCE_MATCH_HELD",
        "SOURCE_NOT_FOUND",
        "SOURCE_FETCH_FAILED",
    }
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _write_exclusive(path: Path, value: object) -> str:
    data = canonical_json(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as handle:
            handle.write(data)
            handle.flush()
    except FileExistsError:
        if path.read_bytes() != data:
            raise ValueError(f"Existing artifact changed: {path.name}") from None
    return sha256_bytes(data)


def load_selection(path: Path, confirmed_sha256: str) -> dict:
    data = path.read_bytes()
    if sha256_bytes(data) != confirmed_sha256:
        raise ValueError("Exact frozen selection digest is required")
    manifest = json.loads(data)
    members = manifest.get("members")
    if (
        manifest.get("schemaVersion") != 1
        or manifest.get("profile") != SELECTION_PROFILE
        or not isinstance(manifest.get("sourceHead"), str)
        or len(manifest["sourceHead"]) != 40
        or manifest.get("selectedCount") != 150
        or not isinstance(members, list)
        or len(members) != 150
    ):
        raise ValueError("Invalid source-expansion selection manifest")
    ids = [member.get("productId") for member in members]
    if len(set(ids)) != len(ids) or any(not isinstance(value, int) or value < 1 for value in ids):
        raise ValueError("Selection product identities are invalid")
    for member in members:
        if (
            member.get("country") != "PL"
            or member.get("currentSourceStatus") != "unlinked"
            or not str(member.get("ean", "")).isdigit()
            or not 8 <= len(str(member["ean"])) <= 14
            or not all(
                isinstance(member.get(key), str) and member[key].strip()
                for key in ("brand", "productName", "category")
            )
        ):
            raise ValueError("Selection member is not a strong PL identity")
    return manifest


def _record_preflight(record: dict) -> list[str]:
    reasons: list[str] = []
    if record.get("validation_findings"):
        reasons.append("source_validation_findings")
    if not isinstance(record.get("source_revision"), int) or record["source_revision"] < 1:
        reasons.append("invalid_source_revision")
    if not record.get("retrieved_at"):
        reasons.append("missing_retrieval_time")
    fields = record.get("extracted_fields", {})
    values: dict[str, float] = {}
    for name, field in fields.items():
        if name not in NUTRIENTS:
            continue
        if field.get("state") != "recorded":
            continue
        try:
            number = float(field["value"])
        except (KeyError, TypeError, ValueError):
            reasons.append(f"invalid_recorded_value:{name}")
            continue
        values[name] = number
        if number < 0 or number >= 1000:
            reasons.append(f"implausible_nutrient_quantity:{name}")
        if name != "calories_100g" and field.get("basis") == "per_100g" and number > 100:
            reasons.append(f"implausible_per_100g_quantity:{name}")
    if values.get("saturated_fat_100g", 0) > values.get("fat_100g", float("inf")):
        reasons.append("inconsistent_saturated_fat")
    if values.get("sugars_100g", 0) > values.get("carbs_100g", float("inf")):
        reasons.append("inconsistent_sugars")
    canonical = record.get("payload_canonical")
    if not isinstance(canonical, str) or sha256_bytes(canonical.encode()) != record.get("payload_hash"):
        reasons.append("payload_hash_mismatch")
    else:
        try:
            if json.loads(canonical) != record.get("sanitized_payload"):
                reasons.append("payload_canonical_mismatch")
        except json.JSONDecodeError:
            reasons.append("payload_canonical_invalid")
    return reasons


def classify_source(member: dict, raw_product: dict) -> tuple[str, list[str], dict | None]:
    reasons: list[str] = []
    ean = str(member["ean"])
    if str(raw_product.get("code", "")).strip() != ean:
        reasons.append("source_ean_mismatch")
    product = extract_product_data(raw_product)
    if product is None:
        return "SOURCE_MATCH_HELD", sorted({*reasons, "source_identity_unrepresentable"}), None
    record = product["_source_observation"]
    expected = {
        "ean": ean,
        "brand": member["brand"].strip(),
        "product_name": member["productName"].strip(),
        "category": member["category"].strip(),
    }
    actual = {key: str(record["identity"].get(key, "")).strip() for key in expected}
    for key in ("ean", "brand", "product_name", "category"):
        if actual[key] != expected[key]:
            reasons.append(f"source_{key}_differs_from_catalog")
    reasons.extend(_record_preflight(record))
    return (
        "SOURCE_MATCH_ACCEPTED" if not reasons else "SOURCE_MATCH_HELD",
        sorted(set(reasons)),
        record,
    )


def acquire_selection(
    selection_path: Path,
    confirmed_sha256: str,
    output_directory: Path,
    *,
    resume: bool = False,
    fetcher: Callable[[str], dict] = fetch_product_by_ean_result,
    on_progress: Callable[[int, int], None] | None = None,
) -> dict:
    selection = load_selection(selection_path, confirmed_sha256)
    if output_directory.exists() and not resume:
        raise ValueError("Output directory already exists; use explicit resume")
    output_directory.mkdir(parents=True, exist_ok=resume)
    binding = {
        "schemaVersion": 1,
        "profile": RELEASE_PROFILE,
        "selectionSha256": confirmed_sha256,
        "selectionSourceHead": selection["sourceHead"],
        "selectedCount": selection["selectedCount"],
    }
    _write_exclusive(output_directory / "binding.json", binding)
    results: list[dict] = []
    for index, member in enumerate(selection["members"], start=1):
        product_id = member["productId"]
        member_path = output_directory / f"member-{product_id}.json"
        if member_path.exists():
            saved = json.loads(member_path.read_text(encoding="utf-8"))
            if (
                saved.get("productId") != product_id
                or saved.get("ean") != member["ean"]
                or saved.get("status") not in STATUSES
            ):
                raise ValueError("Existing member result is invalid")
            results.append(saved)
            continue
        fetched = fetcher(str(member["ean"]))
        disposition = fetched.get("disposition")
        result = {
            "productId": product_id,
            "ean": member["ean"],
            "country": member["country"],
            "category": member["category"],
            "productName": member["productName"],
            "brand": member["brand"],
            "selectionRationale": member["selectionRationale"],
        }
        if disposition == "not_found":
            result.update(status="SOURCE_NOT_FOUND", reasons=["off_exact_ean_not_found"])
        elif disposition != "found" or not isinstance(fetched.get("product"), dict):
            result.update(
                status="SOURCE_FETCH_FAILED",
                reasons=[str(fetched.get("read_disposition") or "off_fetch_failed")],
                httpStatus=fetched.get("http_status"),
            )
        else:
            status, reasons, record = classify_source(member, fetched["product"])
            result.update(status=status, reasons=reasons)
            if record is not None:
                record_name = f"PL-{product_id}-{member['ean']}.observation.json"
                record_sha = _write_exclusive(output_directory / record_name, record)
                basis = sorted(
                    {
                        field.get("basis", "unknown")
                        for field in record["extracted_fields"].values()
                        if field.get("state") == "recorded" and "basis" in field
                    }
                )
                result.update(
                    recordFile=record_name,
                    recordSha256=record_sha,
                    payloadHash=record["payload_hash"],
                    extractorVersion=record["sanitized_payload"]["extractor_version"],
                    nutritionBasis=basis,
                    sourceUpdatedAt=record.get("source_updated_at"),
                    retrievedAt=record.get("retrieved_at"),
                    ingredientsExplicit=record.get("ingredients_state") == "reported",
                    allergenEvidenceExplicit=record.get("allergens_state") == "reported",
                )
        _write_exclusive(member_path, result)
        results.append(result)
        if on_progress is not None and (index % 10 == 0 or index == len(selection["members"])):
            on_progress(index, len(selection["members"]))
    counts = Counter(result["status"] for result in results)
    receipt = {
        **binding,
        "result": "COMPLETE",
        "sourceRequests": len(selection["members"]),
        "counts": {status: counts.get(status, 0) for status in sorted(STATUSES)},
        "members": sorted(results, key=lambda item: item["productId"]),
    }
    _write_exclusive(output_directory / "receipt.json", receipt)
    return receipt


def build_release_manifest(
    selection_path: Path,
    selection_sha256: str,
    acquisition_receipt_path: Path,
    acquisition_receipt_sha256: str,
    output_path: Path,
) -> dict:
    selection = load_selection(selection_path, selection_sha256)
    receipt_bytes = acquisition_receipt_path.read_bytes()
    if sha256_bytes(receipt_bytes) != acquisition_receipt_sha256:
        raise ValueError("Exact acquisition receipt digest is required")
    receipt = json.loads(receipt_bytes)
    if (
        receipt.get("profile") != RELEASE_PROFILE
        or receipt.get("selectionSha256") != selection_sha256
        or receipt.get("selectionSourceHead") != selection["sourceHead"]
        or receipt.get("result") != "COMPLETE"
        or len(receipt.get("members", [])) != 150
    ):
        raise ValueError("Acquisition receipt is not bound to the frozen selection")
    selected = {member["productId"]: member for member in selection["members"]}
    root = acquisition_receipt_path.parent
    entries = []
    held = []
    not_found = []
    failed = []
    for result in receipt["members"]:
        member = selected.get(result.get("productId"))
        if member is None or result.get("ean") != member["ean"]:
            raise ValueError("Acquisition member is outside the frozen selection")
        status = result.get("status")
        if status in {"SOURCE_MATCH_ACCEPTED", "SOURCE_MATCH_HELD"}:
            record_file = result.get("recordFile")
            if not isinstance(record_file, str) or Path(record_file).name != record_file:
                raise ValueError("Observation artifact path is invalid")
            record_path = root / record_file
            record_bytes = record_path.read_bytes()
            if sha256_bytes(record_bytes) != result.get("recordSha256"):
                raise ValueError("Observation artifact hash changed")
            record = json.loads(record_bytes)
            if record.get("payload_hash") != result.get("payloadHash") or _record_preflight(record):
                raise ValueError("Observation artifact no longer passes preflight")
        if status == "SOURCE_MATCH_ACCEPTED":
            if result.get("reasons"):
                raise ValueError("Accepted source match contains hold reasons")
            expected_identity = {
                "ean": member["ean"],
                "brand": member["brand"].strip(),
                "product_name": member["productName"].strip(),
                "category": member["category"].strip(),
            }
            if record.get("identity") != expected_identity:
                raise ValueError("Accepted source identity changed")
            entries.append(
                {
                    "productId": member["productId"],
                    "country": member["country"],
                    "externalId": member["ean"],
                    "recordFile": record_file,
                    "recordSha256": result["recordSha256"],
                    "payloadHash": result["payloadHash"],
                    "sourceRevision": record["source_revision"],
                    "retrievedAt": record["retrieved_at"],
                    "sourceUpdatedAt": record.get("source_updated_at"),
                    "beforeAttributes": {
                        "brand": member["brand"],
                        "product_name": member["productName"],
                        "category": member["category"],
                    },
                    "afterAttributes": {
                        "brand": record["identity"]["brand"],
                        "product_name": record["identity"]["product_name"],
                        "category": record["identity"]["category"],
                    },
                    "batchProfile": "source-expansion-v1",
                    "selectionRationale": member["selectionRationale"],
                    "extractorVersion": result["extractorVersion"],
                    "nutritionBasis": result["nutritionBasis"],
                    "ingredientsExplicit": result["ingredientsExplicit"],
                    "allergenEvidenceExplicit": result["allergenEvidenceExplicit"],
                }
            )
        elif status == "SOURCE_MATCH_HELD":
            held.append(
                {
                    "productId": member["productId"],
                    "reasons": result["reasons"],
                    "recordFile": result["recordFile"],
                    "recordSha256": result["recordSha256"],
                    "payloadHash": result["payloadHash"],
                }
            )
        elif status == "SOURCE_NOT_FOUND":
            not_found.append({"productId": member["productId"], "reasons": result["reasons"]})
        elif status == "SOURCE_FETCH_FAILED":
            failed.append({"productId": member["productId"], "reasons": result["reasons"]})
        else:
            raise ValueError("Unknown acquisition disposition")
    body = {
        "schemaVersion": 1,
        "profile": ACQUISITION_PROFILE,
        "selectionSourceHead": selection["sourceHead"],
        "selectionSha256": selection_sha256,
        "acquisitionReceiptSha256": acquisition_receipt_sha256,
        "selectedCount": 150,
        "entries": sorted(entries, key=lambda item: item["productId"]),
        "held": sorted(held, key=lambda item: item["productId"]),
        "notFound": sorted(not_found, key=lambda item: item["productId"]),
        "fetchFailed": sorted(failed, key=lambda item: item["productId"]),
    }
    manifest = {**body, "manifestSha256": sha256_bytes(canonical_json(body))}
    _write_exclusive(output_path, manifest)
    return manifest


def bind_production_review(
    acquisition_manifest_path: Path,
    acquisition_manifest_sha256: str,
    production_review_path: Path,
    production_review_sha256: str,
    output_path: Path,
) -> dict:
    acquisition_bytes = acquisition_manifest_path.read_bytes()
    if sha256_bytes(acquisition_bytes) != acquisition_manifest_sha256:
        raise ValueError("Exact acquisition manifest digest is required")
    acquisition = json.loads(acquisition_bytes)
    if (
        acquisition.get("schemaVersion") != 1
        or acquisition.get("profile") != ACQUISITION_PROFILE
        or acquisition.get("manifestSha256")
        != sha256_bytes(canonical_json({k: v for k, v in acquisition.items() if k != "manifestSha256"}))
    ):
        raise ValueError("Acquisition manifest is invalid")
    review_bytes = production_review_path.read_bytes()
    if sha256_bytes(review_bytes) != production_review_sha256:
        raise ValueError("Exact production identity review digest is required")
    review = json.loads(review_bytes)
    expected_ids = [entry["productId"] for entry in acquisition["entries"]]
    review_members = review.get("members", [])
    if not isinstance(review_members, list) or any(
        not isinstance(entry, dict)
        or set(entry) != {"productId", "holdReasons"}
        or not isinstance(entry["productId"], int)
        or not isinstance(entry["holdReasons"], list)
        or any(not isinstance(reason, str) or not reason for reason in entry["holdReasons"])
        for entry in review_members
    ):
        raise ValueError("Production identity review member verdict is invalid")
    reviewed_ids = [entry["productId"] for entry in review_members]
    if (
        review.get("schemaVersion") != 1
        or review.get("profile") != "source-expansion-production-identity-review-v1"
        or reviewed_ids != expected_ids
        or any(entry["holdReasons"] for entry in review_members)
    ):
        raise ValueError("Production identity review does not approve the exact accepted cohort")
    body = {
        **{k: v for k, v in acquisition.items() if k not in {"profile", "manifestSha256"}},
        "profile": RELEASE_PROFILE,
        "acquisitionManifestSha256": acquisition_manifest_sha256,
        "productionIdentityReviewSha256": production_review_sha256,
        "productionCheckedAt": review["checkedAt"],
        "activeProductsAtReview": review["activeProducts"],
        "selectedSourcesBefore": review["selectedSourcesBefore"],
    }
    manifest = {**body, "manifestSha256": sha256_bytes(canonical_json(body))}
    _write_exclusive(output_path, manifest)
    return manifest
