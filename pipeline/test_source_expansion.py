from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from pipeline.source_expansion import (
    acquire_selection,
    bind_production_review,
    build_release_manifest,
    classify_source,
    load_selection,
)


def selection() -> dict:
    members = []
    for index in range(150):
        members.append(
            {
                "productId": index + 1,
                "productName": "Test chips",
                "brand": "Test brand",
                "country": "PL",
                "category": "Chips",
                "ean": f"5901234{index:06d}",
                "currentSourceStatus": "unlinked",
                "selectionRationale": {"categoryRank": index + 1},
            }
        )
    return {
        "schemaVersion": 1,
        "profile": "source-expansion-selection-v1",
        "sourceHead": "a" * 40,
        "selectedCount": 150,
        "members": members,
    }


def raw(ean: str = "5901234000000") -> dict:
    return {
        "code": ean,
        "product_name": "Test chips",
        "brands": "Test brand",
        "categories_tags": ["en:chips"],
        "nutrition_data_per": "100g",
        "nutrition_data_per_unit": "g",
        "rev": 2,
        "last_modified_t": 1_700_000_000,
        "_tryvit_fetched_at": "2026-09-19T18:00:00Z",
        "nutriments": {"energy-kcal_100g": 500, "fat_100g": 20, "sugars_100g": 2, "carbohydrates_100g": 50},
        "ingredients": [{"id": "en:potato", "text": "Potato"}],
        "allergens_tags": [],
        "traces_tags": [],
    }


def test_exact_identity_is_accepted_and_explicit_basis_is_retained() -> None:
    member = selection()["members"][0]
    status, reasons, record = classify_source(member, raw(member["ean"]))
    assert status == "SOURCE_MATCH_ACCEPTED"
    assert reasons == []
    assert record is not None
    assert record["extracted_fields"]["calories_100g"]["basis"] == "per_100g"


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"code": "5900000000000"}, "source_ean_mismatch"),
        ({"product_name": "Different product"}, "source_product_name_differs_from_catalog"),
        ({"brands": "Different brand"}, "source_brand_differs_from_catalog"),
        ({"categories_tags": ["en:beverages"]}, "source_category_differs_from_catalog"),
        ({"rev": None}, "invalid_source_revision"),
    ],
)
def test_identity_or_ingestion_preflight_mismatch_is_held(change: dict, reason: str) -> None:
    member = selection()["members"][0]
    candidate = raw(member["ean"])
    candidate.update(change)
    status, reasons, _record = classify_source(member, candidate)
    assert status == "SOURCE_MATCH_HELD"
    assert reason in reasons


def test_selection_digest_and_resume_are_fail_closed(tmp_path: Path) -> None:
    manifest = selection()
    selection_path = tmp_path / "selection.json"
    selection_path.write_text(json.dumps(manifest), encoding="utf-8")
    digest = hashlib.sha256(selection_path.read_bytes()).hexdigest()
    assert load_selection(selection_path, digest)["selectedCount"] == 150
    with pytest.raises(ValueError, match="digest"):
        load_selection(selection_path, "0" * 64)

    calls: list[str] = []

    def not_found(ean: str) -> dict:
        calls.append(ean)
        return {
            "disposition": "not_found",
            "product": None,
            "http_status": 200,
            "read_disposition": "source_status_not_found",
        }

    output = tmp_path / "run"
    first = acquire_selection(selection_path, digest, output, fetcher=not_found)
    assert first["counts"]["SOURCE_NOT_FOUND"] == 150
    assert len(calls) == 150
    second = acquire_selection(selection_path, digest, output, resume=True, fetcher=not_found)
    assert second == first
    assert len(calls) == 150


def test_release_manifest_binds_selection_receipt_and_record_hashes(tmp_path: Path) -> None:
    manifest = selection()
    selection_path = tmp_path / "selection.json"
    selection_path.write_text(json.dumps(manifest), encoding="utf-8")
    selection_digest = hashlib.sha256(selection_path.read_bytes()).hexdigest()
    output = tmp_path / "run"

    def found(ean: str) -> dict:
        return {"disposition": "found", "product": raw(ean), "http_status": 200, "read_disposition": "ok"}

    acquire_selection(selection_path, selection_digest, output, fetcher=found)
    receipt = output / "receipt.json"
    receipt_digest = hashlib.sha256(receipt.read_bytes()).hexdigest()
    acquisition_path = output / "acquisition.json"
    acquisition = build_release_manifest(
        selection_path,
        selection_digest,
        receipt,
        receipt_digest,
        acquisition_path,
    )
    assert len(acquisition["entries"]) == 150
    assert acquisition["held"] == []
    assert len(acquisition["manifestSha256"]) == 64
    review = {
        "schemaVersion": 1,
        "profile": "source-expansion-production-identity-review-v1",
        "checkedAt": "2026-09-19T20:00:00Z",
        "activeProducts": 2434,
        "selectedSourcesBefore": 55,
        "members": [
            {"productId": entry["productId"], "holdReasons": []}
            for entry in acquisition["entries"]
        ],
    }
    review_path = output / "review.json"
    review_path.write_text(json.dumps(review), encoding="utf-8")
    review_digest = hashlib.sha256(review_path.read_bytes()).hexdigest()
    release_path = output / "release.json"
    release = bind_production_review(
        acquisition_path,
        hashlib.sha256(acquisition_path.read_bytes()).hexdigest(),
        review_path,
        review_digest,
        release_path,
    )
    assert release["profile"] == "source-expansion-cohort-v1"
    assert release["productionIdentityReviewSha256"] == review_digest
    with pytest.raises(ValueError, match="receipt digest"):
        build_release_manifest(selection_path, selection_digest, receipt, "0" * 64, tmp_path / "bad.json")
    first_record = output / acquisition["entries"][0]["recordFile"]
    first_record.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="artifact hash"):
        build_release_manifest(selection_path, selection_digest, receipt, receipt_digest, tmp_path / "bad.json")
