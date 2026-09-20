"""Offline construction and evaluation guards for the JEV identity challenge.

The challenge is a balanced measurement artifact.  It has no ingestion, database,
or source-selection integration and does not call TypeSafe.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import math
import random
import re
import sys
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

LABELS = ("CONSISTENT", "INCONSISTENT", "INSUFFICIENT_EVIDENCE")
MARKETS = ("PL", "DE")
CHALLENGE_ID = "jev-identity-challenge-v1"
AMENDMENT_PROTOCOL_ID = "jev-identity-challenge-v1.1"
SCHEMA_VERSION = 1
MODEL_ID = "jev-1.13.0"
ARM_A_PROMPT_ID = "generic-abstention-v2"
ARM_A_PROMPT_SHA256 = "014135aad814b77554b79680146e5156c11e6f12b0f756127d290b468b846447"
ARM_B_PROMPT_ID = "operational-public-evidence-adjudication-v1"
ARM_B_PROMPT_SHA256 = "1a28022434f0e6fb672be28e5fef756147daf4e5c0d63c83d3b7b7237fbd145a"
ROOT = Path(__file__).resolve().parent.parent
REPORT_ROOT = ROOT / "audit-reports" / CHALLENGE_ID
BASE_FIELDS = ("product_name", "brand", "variant", "package", "quantity")
SEMANTIC_FIELDS = (
    *BASE_FIELDS,
    "manufacturer_owner",
    "aliases",
    "flavor",
    "formulation",
    "preparation",
    "package_count",
    "product_kind",
    "other_identity_attributes",
)
FORBIDDEN_MODEL_KEYS = frozenset(
    {
        "ean",
        "barcode",
        "url",
        "source_url",
        "case_hash",
        "case_id",
        "family_hash",
        "family_id",
        "source_mechanism",
        "publisher",
        "domain",
        "timestamp",
        "captured_at",
        "provenance",
        "evidence_hash",
        "label",
        "intended_label",
        "stratum",
        "reviewer",
        "review",
        "rejected",
    }
)
EAN_VALUE = re.compile(r"(?<!\d)\d{8,14}(?!\d)")
URL_VALUE = re.compile(r"[a-z][a-z0-9+.-]*://", re.IGNORECASE)
SHA256_VALUE = re.compile(r"\b[0-9a-f]{64}\b", re.IGNORECASE)

STRATUM_TARGETS = {
    "CONSISTENT": {
        "manufacturer_consumer_brand": 4,
        "retailer_private_label": 4,
        "capitalization_spacing_diacritics": 3,
        "formal_company_short_brand": 3,
        "wording_evolution": 4,
        "equivalent_product_names": 3,
        "richer_source_naming": 4,
    },
    "INCONSISTENT": {
        "neighboring_variant": 4,
        "flavor": 4,
        "fat_or_formulation": 3,
        "preparation": 3,
        "product_kind": 3,
        "package_or_count": 3,
        "near_name_family_product": 3,
        "plausible_brand_different_ean": 2,
    },
    "INSUFFICIENT_EVIDENCE": {
        "missing_critical_identity": 5,
        "generic_product_name": 5,
        "ambiguous_brand_family": 5,
        "incomplete_package_variant": 5,
        "dual_plausible_masking": 5,
    },
}
RAW_STRATUM_MINIMA = {
    label: {stratum: math.ceil(target * 40 / 25) for stratum, target in strata.items()}
    for label, strata in STRATUM_TARGETS.items()
}

# v1.1 amendment: diversity replaces exact final stratum counts.  The v1
# targets remain intact above as historical protocol evidence and a tie-break.
DIVERSITY_BOUNDS_V11 = {
    "CONSISTENT": {"minimum": 2, "maximum": 6},
    "INCONSISTENT": {"minimum": 2, "maximum": 5},
    "INSUFFICIENT_EVIDENCE": {"minimum": 3, "maximum": 7},
}
INITIAL_REVIEW_QUEUE_PER_CELL_V11 = 30
V11_REPLENISHMENT_BATCH_SIZE = 10


class ChallengeError(ValueError):
    """Fail-closed challenge construction error."""


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_new(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")


def _opaque_review_token(candidate_id: str, dossier_hash: str) -> str:
    """Create a token that exposes neither class, family, nor source provenance."""
    return digest({"challenge": CHALLENGE_ID, "candidate": candidate_id, "dossier": dossier_hash})


def normalized_identity_pair(payload: dict) -> str:
    """Create a hidden overlap fingerprint from the two semantic identity sides."""
    visible = validate_model_visible_payload(payload)
    return "identity_pair:" + digest(
        {
            "market": visible["market"],
            "reference": visible["reference"],
            "candidate": visible["candidate"],
        }
    )


def _tagged_fingerprints(value: Any, *, key: str | None = None) -> set[str]:
    """Extract conservative historical overlap fingerprints from JSON artifacts."""
    found: set[str] = set()
    if isinstance(value, dict):
        if {"market", "reference", "candidate"}.issubset(value):
            default_enrichment = {
                "reference": dict.fromkeys(SEMANTIC_FIELDS),
                "candidate": dict.fromkeys(SEMANTIC_FIELDS),
            }
            with contextlib.suppress(ChallengeError):
                identity_value = {**value, "enrichment": value.get("enrichment", default_enrichment)}
                found.add(normalized_identity_pair(identity_value))
        for nested_key, nested in value.items():
            found.update(_tagged_fingerprints(nested, key=nested_key))
    elif isinstance(value, list):
        for nested in value:
            found.update(_tagged_fingerprints(nested, key=key))
    elif isinstance(value, str) and key:
        lowered = key.lower()
        if lowered in {"ean", "barcode", "source_ean", "reference_ean", "candidate_ean"} and EAN_VALUE.fullmatch(value):
            found.add(f"ean:{value}")
        elif lowered in {"url", "source_url"} and URL_VALUE.match(value):
            found.add(f"url:{value}")
        elif lowered in {"case_hash", "local_case_hash", "case_id"}:
            found.add(f"case:{value}")
        elif lowered in {"family_hash", "product_family_hash", "family_id"}:
            found.add(f"family:{value}")
    return found


def build_exclusion_index(paths: list[Path]) -> dict:
    """Freeze all historical identifiers/pairs that are ineligible for this challenge.

    Input files are read only.  A missing or invalid artifact is fatal rather
    than silently omitting a potential overlap.
    """
    entries: set[str] = set()
    sources = []
    for path in paths:
        path = Path(path)
        if not path.is_file():
            raise ChallengeError(f"Historical exclusion artifact is unavailable: {path}")
        try:
            entries.update(_tagged_fingerprints(read_json(path)))
        except json.JSONDecodeError as error:
            raise ChallengeError(f"Historical exclusion artifact is invalid JSON: {path}") from error
        sources.append({"path": str(path), "sha256": file_digest(path)})
    return {
        "schema_version": SCHEMA_VERSION,
        "challenge_id": CHALLENGE_ID,
        "sources": sources,
        "fingerprints": sorted(entries),
    }


def candidate_fingerprints(candidate: dict, visible: dict) -> set[str]:
    """Derive non-model overlap keys from a candidate's hidden and visible data."""
    result = set(candidate["fingerprints"])
    result.add(f"case:{candidate['candidate_id']}")
    result.add(f"family:{candidate['family_id']}")
    result.add(normalized_identity_pair(visible))
    result.update(_tagged_fingerprints(candidate["hidden_dossier"]))
    return result


def _clean(value: Any, maximum: int = 500) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ChallengeError("Model-visible semantic fields must be strings or null")
    value = " ".join(value.split())
    if len(value) > maximum:
        raise ChallengeError("Model-visible semantic field exceeds its length limit")
    return value or None


def _validate_no_identifiers(value: Any, path: str = "payload") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in FORBIDDEN_MODEL_KEYS or key.endswith("_hash"):
                raise ChallengeError(f"Forbidden model-visible field at {path}.{key}")
            _validate_no_identifiers(nested, f"{path}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _validate_no_identifiers(nested, f"{path}[{index}]")
    elif isinstance(value, str) and (EAN_VALUE.search(value) or URL_VALUE.search(value) or SHA256_VALUE.search(value)):
        raise ChallengeError(f"Identifier leakage in {path}")


def validate_model_visible_payload(payload: Any) -> dict:
    """Return a normalized semantic-only payload or fail closed on leakage."""
    if not isinstance(payload, dict) or set(payload) != {"market", "reference", "candidate", "enrichment"}:
        raise ChallengeError("Model-visible payload has an unexpected shape")
    if payload["market"] not in MARKETS:
        raise ChallengeError("Model-visible market is invalid")
    normalized: dict[str, Any] = {"market": payload["market"]}
    for side in ("reference", "candidate"):
        record = payload[side]
        if not isinstance(record, dict) or set(record) != set(BASE_FIELDS):
            raise ChallengeError("Minimal model-visible identity has an unexpected shape")
        normalized[side] = {field: _clean(record[field]) for field in BASE_FIELDS}
    enrichment = payload["enrichment"]
    if not isinstance(enrichment, dict) or set(enrichment) != {"reference", "candidate"}:
        raise ChallengeError("Enrichment has an unexpected shape")
    normalized["enrichment"] = {}
    for side in ("reference", "candidate"):
        record = enrichment[side]
        if not isinstance(record, dict) or set(record) != set(SEMANTIC_FIELDS):
            raise ChallengeError("Enriched model-visible identity has an unexpected shape")
        normalized["enrichment"][side] = {field: _clean(record[field]) for field in SEMANTIC_FIELDS}
        for field in BASE_FIELDS:
            if normalized["enrichment"][side][field] != normalized[side][field]:
                raise ChallengeError("Enrichment may not alter minimal semantic identity fields")
    _validate_no_identifiers(normalized)
    return normalized


def minimal_arm_payload(payload: dict) -> dict:
    visible = validate_model_visible_payload(payload)
    return {"market": visible["market"], "reference": visible["reference"], "candidate": visible["candidate"]}


def enriched_arm_payload(payload: dict) -> dict:
    return validate_model_visible_payload(payload)


def _minimal_with_blank_enrichment(payload: dict) -> dict:
    return {
        **payload,
        "enrichment": {
            side: {field: payload[side].get(field) if field in BASE_FIELDS else None for field in SEMANTIC_FIELDS}
            for side in ("reference", "candidate")
        },
    }


def provider_payload(manifest_case: Any, *, arm: str) -> dict:
    """Return exactly the semantic document eligible for a future JEV request.

    The manifest's local case reference is deliberately discarded here, making
    it mechanically impossible for a normal caller to send local identifiers
    along with the identity comparison.
    """
    if not isinstance(manifest_case, dict) or set(manifest_case) != {
        "case_ref",
        "market",
        "model_visible_payload",
        "model_visible_payload_sha256",
    }:
        raise ChallengeError("Arm manifest case has an unexpected shape")
    payload = manifest_case["model_visible_payload"]
    if arm == "A_MINIMAL":
        if not isinstance(payload, dict) or set(payload) != {"market", "reference", "candidate"}:
            raise ChallengeError("Minimal manifest payload is invalid")
        full_payload = _minimal_with_blank_enrichment(payload)
        validate_model_visible_payload(full_payload)
        if manifest_case["model_visible_payload_sha256"] != digest(payload):
            raise ChallengeError("Minimal model-visible payload hash mismatch")
        return payload
    if arm == "B_ENRICHED":
        normalized = validate_model_visible_payload(payload)
        if manifest_case["model_visible_payload_sha256"] != digest(normalized):
            raise ChallengeError("Enriched model-visible payload hash mismatch")
        return normalized
    raise ChallengeError("Unknown challenge arm")


def validate_candidate(candidate: Any, exclusion_index: set[str]) -> dict:
    required = {
        "candidate_id",
        "family_id",
        "market",
        "intended_label",
        "stratum",
        "fingerprints",
        "model_visible_payload",
        "hidden_dossier",
    }
    derived_keys = {"hidden_dossier_sha256", "model_visible_payload_sha256", "blind_review_token"}
    if not isinstance(candidate, dict):
        raise ChallengeError("Candidate dossier has an unexpected shape")
    supplied_derived: dict[str, Any] = {}
    if set(candidate) == required | derived_keys:
        supplied_derived = {key: candidate[key] for key in derived_keys}
        candidate = {key: candidate[key] for key in required}
    elif set(candidate) != required:
        raise ChallengeError("Candidate dossier has an unexpected shape")
    if not isinstance(candidate["candidate_id"], str) or not candidate["candidate_id"]:
        raise ChallengeError("Candidate ID is invalid")
    if not isinstance(candidate["family_id"], str) or not candidate["family_id"]:
        raise ChallengeError("Candidate family is invalid")
    if candidate["market"] not in MARKETS or candidate["intended_label"] not in LABELS:
        raise ChallengeError("Candidate market or label is invalid")
    if candidate["stratum"] not in STRATUM_TARGETS[candidate["intended_label"]]:
        raise ChallengeError("Candidate stratum is invalid")
    if not isinstance(candidate["fingerprints"], list) or not candidate["fingerprints"]:
        raise ChallengeError("Candidate needs provenance fingerprints")
    if any(not isinstance(value, str) or not value for value in candidate["fingerprints"]):
        raise ChallengeError("Candidate provenance fingerprint is invalid")
    visible = validate_model_visible_payload(candidate["model_visible_payload"])
    fingerprints = candidate_fingerprints(candidate, visible)
    if fingerprints & exclusion_index:
        raise ChallengeError("Candidate overlaps a historical identity")
    if visible["market"] != candidate["market"]:
        raise ChallengeError("Candidate market and model-visible market differ")
    _validate_hidden_dossier(candidate["hidden_dossier"], candidate["intended_label"])
    dossier_sha256 = digest(candidate["hidden_dossier"])
    normalized = {
        **candidate,
        "fingerprints": sorted(fingerprints),
        "model_visible_payload": visible,
        "model_visible_payload_sha256": digest(visible),
        "hidden_dossier_sha256": dossier_sha256,
        "blind_review_token": _opaque_review_token(candidate["candidate_id"], dossier_sha256),
    }
    if supplied_derived and any(supplied_derived[key] != normalized[key] for key in derived_keys):
        raise ChallengeError("Persisted candidate derived evidence does not match its raw dossier")
    return normalized


def _validate_hidden_dossier(dossier: Any, intended_label: str) -> None:
    """Require source independence and a ground-truth basis before review."""
    required = {"ground_truth", "sources", "independence_attestation", "verified_skus"}
    if not isinstance(dossier, dict) or not required.issubset(dossier):
        raise ChallengeError("Candidate hidden dossier is incomplete")
    ground_truth = dossier["ground_truth"]
    if not isinstance(ground_truth, dict) or not isinstance(ground_truth.get("rationale"), str):
        raise ChallengeError("Candidate ground-truth rationale is invalid")
    if intended_label == "CONSISTENT":
        reference_ean = ground_truth.get("reference_ean")
        candidate_ean = ground_truth.get("candidate_ean")
        if not isinstance(reference_ean, str) or reference_ean != candidate_ean:
            raise ChallengeError("Consistent candidate needs the same verified hidden EAN")
    elif intended_label == "INCONSISTENT":
        reference_ean = ground_truth.get("reference_ean")
        candidate_ean = ground_truth.get("candidate_ean")
        if not isinstance(reference_ean, str) or reference_ean == candidate_ean:
            raise ChallengeError("Inconsistent candidate needs distinct verified hidden EANs")
    else:
        completions = ground_truth.get("competing_completions")
        if (
            not isinstance(completions, list)
            or len(completions) < 2
            or ground_truth.get("visible_packet_dual_plausible") is not True
        ):
            raise ChallengeError("Insufficient-evidence candidate needs hidden competing completions")
    verified_skus = dossier["verified_skus"]
    invalid_skus = not isinstance(verified_skus, list) or not verified_skus
    if not invalid_skus:
        invalid_skus = any(not isinstance(item, str) or not item for item in verified_skus)
    if invalid_skus:
        raise ChallengeError("Candidate needs verified hidden EAN/SKU values")
    sources = dossier["sources"]
    if not isinstance(sources, list) or not sources:
        raise ChallengeError("Candidate needs recorded public sources")
    domains, publishers = set(), set()
    for source in sources:
        if not isinstance(source, dict) or set(source) != {
            "url",
            "publisher",
            "domain",
            "role",
            "captured_at",
            "source_sha256",
        }:
            raise ChallengeError("Candidate source record is invalid")
        if source["role"] not in {"official", "independent_retailer", "public_database", "barcode_corroborator"}:
            raise ChallengeError("Candidate source role is invalid")
        if not all(isinstance(source[field], str) and source[field] for field in source):
            raise ChallengeError("Candidate source record is incomplete")
        domains.add(source["domain"].lower())
        publishers.add(source["publisher"].casefold())
    exception = dossier.get("single_source_exception")
    if len(sources) == 1:
        if sources[0]["role"] != "official" or not isinstance(exception, str) or not exception.strip():
            raise ChallengeError("Single authoritative source needs an explicit justification")
    elif len(domains) < 2 or len(publishers) < 2:
        raise ChallengeError("Normal corroboration needs distinct independent publishers and domains")
    elif exception is not None:
        raise ChallengeError("Independent evidence must not carry an exception")
    if not isinstance(dossier["independence_attestation"], str) or not dossier["independence_attestation"].strip():
        raise ChallengeError("Candidate source independence needs an explicit attestation")


def validate_candidate_pool(document: Any, exclusion_index: set[str]) -> list[dict]:
    """Validate raw construction candidates before either reviewer can receive them."""
    if not isinstance(document, dict) or set(document) != {"schema_version", "challenge_id", "candidates"}:
        raise ChallengeError("Candidate pool schema is invalid")
    if document["schema_version"] != SCHEMA_VERSION or document["challenge_id"] != CHALLENGE_ID:
        raise ChallengeError("Candidate pool identity is invalid")
    if not isinstance(document["candidates"], list):
        raise ChallengeError("Candidate pool must contain a list")
    candidates = [validate_candidate(candidate, exclusion_index) for candidate in document["candidates"]]
    ids = [candidate["candidate_id"] for candidate in candidates]
    tokens = [candidate["blind_review_token"] for candidate in candidates]
    if len(ids) != len(set(ids)) or len(tokens) != len(set(tokens)):
        raise ChallengeError("Candidate pool contains duplicate IDs or blind review tokens")
    counts = defaultdict(int)
    stratum_counts = defaultdict(int)
    for candidate in candidates:
        counts[(candidate["market"], candidate["intended_label"])] += 1
        stratum_counts[(candidate["market"], candidate["intended_label"], candidate["stratum"])] += 1
    for market in MARKETS:
        for label in LABELS:
            if counts[(market, label)] < 40:
                raise ChallengeError(f"Candidate pool needs at least 40 raw candidates for {market}/{label}")
            for stratum, minimum in RAW_STRATUM_MINIMA[label].items():
                if stratum_counts[(market, label, stratum)] < minimum:
                    raise ChallengeError(f"Candidate pool undersupplies raw {market}/{label}/{stratum}")
    return candidates


def validate_v11_candidate_pool(document: Any, exclusion_index: set[str]) -> list[dict]:
    """Validate the v1.1 initial-review corpus without applying v1 raw quotas.

    v1 evidence remains immutable.  v1.1 changes only review readiness: every
    market/class cell needs thirty valid unratified candidates and enough
    stratum diversity to make a final 25-case selection possible after review.
    """
    expected = {"schema_version", "protocol_id", "candidates"}
    if not isinstance(document, dict) or set(document) != expected:
        raise ChallengeError("v1.1 candidate pool schema is invalid")
    if document["schema_version"] != SCHEMA_VERSION or document["protocol_id"] != AMENDMENT_PROTOCOL_ID:
        raise ChallengeError("v1.1 candidate pool identity is invalid")
    if not isinstance(document["candidates"], list):
        raise ChallengeError("v1.1 candidates must be a list")
    candidates = [validate_candidate(candidate, exclusion_index) for candidate in document["candidates"]]
    ids = [candidate["candidate_id"] for candidate in candidates]
    tokens = [candidate["blind_review_token"] for candidate in candidates]
    if len(ids) != len(set(ids)) or len(tokens) != len(set(tokens)):
        raise ChallengeError("v1.1 candidate pool contains duplicate IDs or review tokens")
    candidates, _ = v11_safe_pool(candidates)
    counts = defaultdict(int)
    strata = defaultdict(int)
    for candidate in candidates:
        key = (candidate["market"], candidate["intended_label"])
        counts[key] += 1
        strata[(candidate["market"], candidate["intended_label"], candidate["stratum"])] += 1
    for market in MARKETS:
        for label in LABELS:
            key = (market, label)
            if counts[key] < INITIAL_REVIEW_QUEUE_PER_CELL_V11:
                raise ChallengeError(f"v1.1 initial review needs 30 candidates for {market}/{label}")
            floor = DIVERSITY_BOUNDS_V11[label]["minimum"]
            for stratum in STRATUM_TARGETS[label]:
                if strata[(market, label, stratum)] < floor:
                    raise ChallengeError(f"v1.1 candidate pool lacks diversity floor for {market}/{label}/{stratum}")
    return candidates


def _candidate_order_key(candidate: dict) -> str:
    return digest(
        {
            "protocol": AMENDMENT_PROTOCOL_ID,
            "candidate": candidate["candidate_id"],
            "payload": candidate["model_visible_payload_sha256"],
        }
    )


def v11_safe_pool(candidates: list[dict]) -> tuple[list[dict], list[dict]]:
    """Make one deterministic, conflict-free universe for every v1.1 stage."""
    selected: list[dict] = []
    exclusions: list[dict] = []
    used_families: set[str] = set()
    used_skus: set[str] = set()
    for candidate in sorted(candidates, key=_candidate_order_key):
        skus = set(candidate["hidden_dossier"]["verified_skus"])
        reasons = []
        if candidate["family_id"] in used_families:
            reasons.append("v1_1_duplicate_family")
        if skus & used_skus:
            reasons.append("v1_1_duplicate_verified_sku")
        if reasons:
            exclusions.append(
                {
                    "candidate_id": candidate["candidate_id"],
                    "reason": reasons,
                    "family_id": candidate["family_id"],
                    "verified_skus": sorted(skus & used_skus),
                }
            )
            continue
        selected.append(candidate)
        used_families.add(candidate["family_id"])
        used_skus.update(skus)
    return selected, exclusions


def v11_readiness_report(candidates: list[dict]) -> dict:
    """Describe v1.1 review readiness without creating a reviewer packet."""
    safe_candidates, exclusions = v11_safe_pool(candidates)
    counts = defaultdict(int)
    strata = defaultdict(int)
    for candidate in safe_candidates:
        counts[(candidate["market"], candidate["intended_label"])] += 1
        strata[(candidate["market"], candidate["intended_label"], candidate["stratum"])] += 1
    cells = []
    ready = True
    for market in MARKETS:
        for label in LABELS:
            required = INITIAL_REVIEW_QUEUE_PER_CELL_V11
            valid = counts[(market, label)]
            floor = DIVERSITY_BOUNDS_V11[label]["minimum"]
            diversity = {stratum: strata[(market, label, stratum)] for stratum in STRATUM_TARGETS[label]}
            floor_ready = all(value >= floor for value in diversity.values())
            cells.append(
                {
                    "market": market,
                    "intended_class": label,
                    "valid_unratified": valid,
                    "initial_review_required": required,
                    "shortage": max(0, required - valid),
                    "diversity_floor": floor,
                    "stratum_coverage": diversity,
                    "diversity_floor_satisfied": floor_ready,
                }
            )
            ready = ready and valid >= required and floor_ready
    return {
        "schema_version": SCHEMA_VERSION,
        "protocol_id": AMENDMENT_PROTOCOL_ID,
        "candidate_count": len(candidates),
        "safe_candidate_count": len(safe_candidates),
        "collision_family_exclusions": exclusions,
        "initial_review_queue_total": INITIAL_REVIEW_QUEUE_PER_CELL_V11 * len(MARKETS) * len(LABELS),
        "cells": cells,
        "initial_blind_review_ready": ready,
        "blind_review": "NOT_RUN",
        "benchmark_freeze": "NOT_RUN",
    }


def _v11_order_cell(candidates: list[dict], label: str) -> list[dict]:
    """Freeze a full order before any reviewer information exists."""
    remaining = sorted(candidates, key=_candidate_order_key)
    ordered: list[dict] = []
    counts: dict[str, int] = defaultdict(int)
    for stratum in STRATUM_TARGETS[label]:
        floor = DIVERSITY_BOUNDS_V11[label]["minimum"]
        for candidate in list(remaining):
            if counts[stratum] >= floor:
                break
            if candidate["stratum"] == stratum:
                ordered.append(candidate)
                remaining.remove(candidate)
                counts[stratum] += 1
    while remaining:
        remaining.sort(
            key=lambda item: (
                abs((counts[item["stratum"]] + 1) - STRATUM_TARGETS[label][item["stratum"]]),
                counts[item["stratum"]],
                _candidate_order_key(item),
            )
        )
        choice = remaining.pop(0)
        ordered.append(choice)
        counts[choice["stratum"]] += 1
    return ordered


def v11_create_queue_manifest(candidates: list[dict]) -> dict:
    """Create the immutable internal pre-review ordering and initial releases."""
    report = v11_readiness_report(candidates)
    if not report["initial_blind_review_ready"]:
        raise ChallengeError("v1.1 initial blind-review readiness is not satisfied")
    safe_candidates, exclusions = v11_safe_pool(candidates)
    cells = []
    for market in MARKETS:
        for label in LABELS:
            pool = [item for item in safe_candidates if item["market"] == market and item["intended_label"] == label]
            ordered = _v11_order_cell(pool, label)
            ids = [item["candidate_id"] for item in ordered]
            cells.append(
                {
                    "market": market,
                    "intended_class": label,
                    "ordered_candidate_ids": ids,
                    "ordered_queue_sha256": digest(ids),
                    "release_ranges": [{"start": 0, "end": INITIAL_REVIEW_QUEUE_PER_CELL_V11}],
                    "reviewed_candidate_ids": [],
                    "consensus_candidate_ids": [],
                    "exported_end": 0,
                }
            )
    return _v11_seal_queue({
        "schema_version": SCHEMA_VERSION,
        "protocol_id": AMENDMENT_PROTOCOL_ID,
        "safe_pool_sha256": digest(safe_candidates),
        "collision_family_exclusions": exclusions,
        "cells": cells,
        "blind_review": "NOT_RUN",
        "benchmark_freeze": "NOT_RUN",
        "review_records": {"author": {}, "blind": {}},
    })


def _v11_seal_queue(queue: dict) -> dict:
    queue["state_sha256"] = digest({key: value for key, value in queue.items() if key != "state_sha256"})
    return queue


def validate_v11_queue_manifest(queue: Any, candidates: list[dict]) -> None:
    """Reconstruct the pre-review order; validate every released/exported prefix."""
    for candidate in candidates:
        validate_candidate(candidate, set())  # Historical index is enforced at the CLI pool boundary.
    expected = v11_create_queue_manifest(candidates)
    if not isinstance(queue, dict) or set(queue) != set(expected):
        raise ChallengeError("v1.1 queue schema is invalid")
    if queue["state_sha256"] != digest({key: value for key, value in queue.items() if key != "state_sha256"}):
        raise ChallengeError("v1.1 queue state hash mismatch")
    for key in ("schema_version", "protocol_id", "safe_pool_sha256", "collision_family_exclusions", "benchmark_freeze"):
        if queue[key] != expected[key]:
            raise ChallengeError(f"v1.1 queue {key} mismatch")
    if not isinstance(queue["cells"], list) or len(queue["cells"]) != 6:
        raise ChallengeError("v1.1 queue requires exactly six cells")
    released_ids = set()
    for cell, original in zip(queue["cells"], expected["cells"], strict=True):
        if not isinstance(cell, dict) or set(cell) != set(original):
            raise ChallengeError("v1.1 queue cell schema is invalid")
        for key in ("market", "intended_class", "ordered_candidate_ids", "ordered_queue_sha256"):
            if cell[key] != original[key]:
                raise ChallengeError(f"v1.1 queue {key} mismatch")
        ranges = cell["release_ranges"]
        if not isinstance(ranges, list) or not ranges or ranges[0] != {"start": 0, "end": 30}:
            raise ChallengeError("v1.1 queue initial release must be [0,30)")
        end = 0
        endpoints = {0}
        for index, interval in enumerate(ranges):
            if (
                not isinstance(interval, dict) or set(interval) != {"start", "end"}
                or type(interval["start"]) is not int or type(interval["end"]) is not int
                or interval["start"] != end or interval["end"] <= end
                or interval["end"] > len(cell["ordered_candidate_ids"])
                or (index and interval["end"] != min(end + V11_REPLENISHMENT_BATCH_SIZE,
                                                     len(cell["ordered_candidate_ids"])))
            ):
                raise ChallengeError("v1.1 queue release range is invalid or replayed")
            end = interval["end"]
            endpoints.add(end)
        if type(cell["exported_end"]) is not int or cell["exported_end"] not in endpoints:
            raise ChallengeError("v1.1 queue exported prefix is invalid")
        ids = cell["ordered_candidate_ids"][:end]
        released_ids.update(ids)
        for key in ("reviewed_candidate_ids", "consensus_candidate_ids"):
            value = cell[key]
            if not isinstance(value, list) or value != [cid for cid in ids if cid in value]:
                raise ChallengeError("v1.1 queue review state is invalid")
    records = queue["review_records"]
    if not isinstance(records, dict) or set(records) != {"author", "blind"}:
        raise ChallengeError("v1.1 queue review records are invalid")
    for ledger in records.values():
        _v11_check_reviews(ledger, released_ids, require_complete=False)
    by_id = {item["candidate_id"]: item for item in candidates}
    for cell in queue["cells"]:
        ids = cell["ordered_candidate_ids"][:cell["exported_end"]]
        reviewed = [cid for cid in ids if cid in records["author"] and cid in records["blind"]]
        consensus = [cid for cid in reviewed if records["author"][cid]["label"]
                     == records["blind"][cid]["label"] == by_id[cid]["intended_label"]]
        if cell["reviewed_candidate_ids"] != reviewed or cell["consensus_candidate_ids"] != consensus:
            raise ChallengeError("v1.1 queue review/consensus state mismatch")
        previous_end = cell["release_ranges"][-1]["start"]
        if not set(cell["ordered_candidate_ids"][:previous_end]) <= set(reviewed):
            raise ChallengeError("v1.1 queue extended before reviews completed")
    expected_review = "NOT_RUN" if not records["blind"] else "REVIEWED"
    if queue["blind_review"] != expected_review:
        raise ChallengeError("v1.1 queue blind review state mismatch")


def _v11_check_reviews(ledger: Any, released: set[str], *, require_complete: bool = True) -> None:
    if not isinstance(ledger, dict) or not set(ledger) <= released:
        raise ChallengeError("v1.1 review ledger includes unreleased candidates")
    if require_complete and set(ledger) != released:
        raise ChallengeError("v1.1 incomplete released reviews")
    for entry in ledger.values():
        if not isinstance(entry, dict) or entry.get("label") not in LABELS:
            raise ChallengeError("v1.1 review label is invalid")
        if not isinstance(entry.get("attestation"), str) or not entry["attestation"].strip():
            raise ChallengeError("v1.1 review requires attestation")
        try:
            timestamp = datetime.fromisoformat(entry["reviewed_at"].replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                raise ValueError("timezone required")
        except (KeyError, AttributeError, TypeError, ValueError) as exc:
            raise ChallengeError("v1.1 review requires valid timestamp") from exc


def _v11_reviewed_state(queue: dict, candidates: list[dict], author: dict, blind: dict) -> dict:
    validate_v11_queue_manifest(queue, candidates)
    released = {cid for cell in queue["cells"]
                for cid in cell["ordered_candidate_ids"][:cell["release_ranges"][-1]["end"]]}
    if any(cell["exported_end"] != cell["release_ranges"][-1]["end"] for cell in queue["cells"]):
        raise ChallengeError("v1.1 released packets have not been exported")
    for role, ledger in (("author", author), ("blind", blind)):
        _v11_check_reviews(ledger, released)
        for cid, entry in queue["review_records"][role].items():
            if ledger.get(cid) != entry:
                raise ChallengeError("v1.1 prior review was modified")
    result = deepcopy(queue)
    result["review_records"] = {"author": deepcopy(author), "blind": deepcopy(blind)}
    by_id = {item["candidate_id"]: item for item in candidates}
    for cell in result["cells"]:
        ids = cell["ordered_candidate_ids"][:cell["exported_end"]]
        cell["reviewed_candidate_ids"] = ids
        cell["consensus_candidate_ids"] = [cid for cid in ids if author[cid]["label"]
                                           == blind[cid]["label"] == by_id[cid]["intended_label"]]
    result["blind_review"] = "REVIEWED"
    return _v11_seal_queue(result)


def v11_blind_review_export(queue_manifest: dict, candidates: list[dict]) -> list[dict]:
    """Consume unexported released prefixes; caller must persist the updated state."""
    validate_v11_queue_manifest(queue_manifest, candidates)
    candidate_by_id = {item["candidate_id"]: item for item in candidates}
    packets = []
    for cell in queue_manifest["cells"]:
        for release in cell["release_ranges"]:
            start = max(cell["exported_end"], release["start"])
            for candidate_id in cell["ordered_candidate_ids"][start : release["end"]]:
                candidate = candidate_by_id[candidate_id]
                packets.append(
                    {
                        "review_token": candidate["blind_review_token"],
                        "model_visible_payload": candidate["model_visible_payload"],
                        "model_visible_payload_sha256": candidate["model_visible_payload_sha256"],
                    }
                )
        cell["exported_end"] = cell["release_ranges"][-1]["end"]
    for packet in packets:
        visible = validate_model_visible_payload(packet["model_visible_payload"])
        if digest(visible) != packet["model_visible_payload_sha256"]:
            raise ChallengeError("v1.1 reviewer payload hash mismatch")
    _v11_seal_queue(queue_manifest)
    return sorted(packets, key=lambda packet: packet["review_token"])


def blind_review_packets(candidates: list[dict]) -> dict:
    """Return the only packet a blind reviewer may receive.

    The opaque token is intentionally not the local candidate id.  No intended
    label, stratum, dossier fact, prompt, or provenance value crosses this seam.
    """
    return {
        "schema_version": SCHEMA_VERSION,
        "challenge_id": CHALLENGE_ID,
        "packets": [
            {
                "review_token": candidate["blind_review_token"],
                "model_visible_payload": candidate["model_visible_payload"],
                "model_visible_payload_sha256": candidate["model_visible_payload_sha256"],
            }
            for candidate in sorted(candidates, key=lambda item: item["blind_review_token"])
        ],
    }


def _validate_author_ledger(document: Any, candidates: list[dict]) -> dict[str, str]:
    if not isinstance(document, dict) or set(document) != {"schema_version", "challenge_id", "entries"}:
        raise ChallengeError("Construction-author ledger schema is invalid")
    if document["schema_version"] != SCHEMA_VERSION or document["challenge_id"] != CHALLENGE_ID:
        raise ChallengeError("Construction-author ledger identity is invalid")
    known = {candidate["candidate_id"] for candidate in candidates}
    labels: dict[str, str] = {}
    for entry in document["entries"]:
        if not isinstance(entry, dict) or set(entry) != {"candidate_id", "label", "attestation", "reviewed_at"}:
            raise ChallengeError("Construction-author ledger entry is invalid")
        candidate_id, label = entry["candidate_id"], entry["label"]
        if candidate_id not in known or candidate_id in labels or label not in LABELS:
            raise ChallengeError("Construction-author ledger has unknown, duplicate, or invalid label")
        if not isinstance(entry["attestation"], str) or not entry["attestation"]:
            raise ChallengeError("Construction-author attestation is required")
        if not isinstance(entry["reviewed_at"], str) or not entry["reviewed_at"]:
            raise ChallengeError("Construction-author review timestamp is required")
        labels[candidate_id] = entry
    return labels


def _validate_blind_ledger(document: Any, candidates: list[dict]) -> dict[str, str]:
    if not isinstance(document, dict) or set(document) != {"schema_version", "challenge_id", "entries"}:
        raise ChallengeError("Blind-review ledger schema is invalid")
    if document["schema_version"] != SCHEMA_VERSION or document["challenge_id"] != CHALLENGE_ID:
        raise ChallengeError("Blind-review ledger identity is invalid")
    token_to_id = {candidate["blind_review_token"]: candidate["candidate_id"] for candidate in candidates}
    labels: dict[str, str] = {}
    for entry in document["entries"]:
        if not isinstance(entry, dict) or set(entry) != {"review_token", "label", "attestation", "reviewed_at"}:
            raise ChallengeError("Blind-review ledger entry is invalid")
        token, label = entry["review_token"], entry["label"]
        if token not in token_to_id or token in labels or label not in LABELS:
            raise ChallengeError("Blind-review ledger has unknown, duplicate, or invalid label")
        if not isinstance(entry["attestation"], str) or not entry["attestation"]:
            raise ChallengeError("Blind-review attestation is required")
        if not isinstance(entry["reviewed_at"], str) or not entry["reviewed_at"]:
            raise ChallengeError("Blind-review timestamp is required")
        labels[token_to_id[token]] = entry
    return labels


def consensus_select(
    candidates: list[dict], author_labels: dict[str, Any], blind_labels: dict[str, Any]
) -> tuple[list[dict], list[dict]]:
    """Select exact consensus quotas deterministically; retain all rejections."""
    approved: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    rejected: list[dict] = []
    families: set[str] = set()
    for candidate in candidates:
        candidate_id = candidate["candidate_id"]
        author_record, blind_record = author_labels.get(candidate_id), blind_labels.get(candidate_id)
        author = author_record.get("label") if isinstance(author_record, dict) else author_record
        blind = blind_record.get("label") if isinstance(blind_record, dict) else blind_record
        reason = None
        if author not in LABELS or blind not in LABELS:
            reason = "incomplete_review"
        elif author != blind:
            reason = "reviewer_disagreement"
        elif author != candidate["intended_label"]:
            reason = "construction_label_mismatch"
        elif candidate["family_id"] in families:
            reason = "duplicate_family"
        if reason:
            rejected.append(_rejected_entry(candidate, reason, author_record, blind_record))
            continue
        families.add(candidate["family_id"])
        approved[(candidate["market"], candidate["intended_label"], candidate["stratum"])].append(candidate)
    selected: list[dict] = []
    for market in MARKETS:
        for label in LABELS:
            for stratum, target in STRATUM_TARGETS[label].items():
                bucket = sorted(approved[(market, label, stratum)], key=lambda item: digest(item["candidate_id"]))
                if len(bucket) < target:
                    raise ChallengeError(
                        f"Consensus shortage for {market}/{label}/{stratum}: need {target}, have {len(bucket)}"
                    )
                selected.extend(bucket[:target])
                for candidate in bucket[target:]:
                    rejected.append(
                        _rejected_entry(
                            candidate,
                            "deterministic_quota_overflow",
                            author_labels.get(candidate["candidate_id"]),
                            blind_labels.get(candidate["candidate_id"]),
                        )
                    )
    if len(selected) != 150:
        raise ChallengeError("Consensus selection did not produce exactly 150 cases")
    return selected, rejected


def _rejected_entry(candidate: dict, reason: str, author_record: Any, blind_record: Any) -> dict:
    author = (
        author_record
        if isinstance(author_record, dict)
        else {"label": author_record, "attestation": None, "reviewed_at": None}
    )
    blind = (
        blind_record
        if isinstance(blind_record, dict)
        else {"label": blind_record, "attestation": None, "reviewed_at": None}
    )
    dossier_sha256 = candidate.get("hidden_dossier_sha256", digest(candidate["hidden_dossier"]))
    payload_sha256 = candidate.get("model_visible_payload_sha256", digest(candidate["model_visible_payload"]))
    return {
        "candidate_id": candidate["candidate_id"],
        "candidate_sha256": digest(candidate),
        "market": candidate["market"],
        "intended_class": candidate["intended_label"],
        "stratum": candidate["stratum"],
        "reason": reason,
        "construction_author_label": author.get("label"),
        "blind_reviewer_label": blind.get("label"),
        "hidden_dossier_sha256": dossier_sha256,
        "model_visible_payload_sha256": payload_sha256,
        "construction_author_attestation": author.get("attestation"),
        "construction_author_reviewed_at": author.get("reviewed_at"),
        "blind_reviewer_attestation": blind.get("attestation"),
        "blind_reviewer_reviewed_at": blind.get("reviewed_at"),
    }


def _assert_selected_balance(selected: list[dict]) -> None:
    counts = defaultdict(int)
    for candidate in selected:
        counts[(candidate["market"], candidate["intended_label"])] += 1
    expected = {(market, label): 25 for market in MARKETS for label in LABELS}
    if dict(counts) != expected:
        raise ChallengeError("Selected benchmark does not have exact 25-case market/class cells")


def _assert_matched_missingness(selected: list[dict]) -> None:
    """Prevent missing fields themselves becoming a class cue.

    The count of null fields is identical for each class over the entire
    semantic packet.  This intentionally forces naturally incomplete
    consistent/inconsistent candidates into the final selection.
    """
    profiles: dict[str, dict[str, int]] = {label: defaultdict(int) for label in LABELS}
    for candidate in selected:
        visible = candidate["model_visible_payload"]
        for side in ("reference", "candidate"):
            for field in SEMANTIC_FIELDS:
                if visible["enrichment"][side][field] is None:
                    profiles[candidate["intended_label"]][f"{side}.{field}"] += 1
    baseline = dict(profiles[LABELS[0]])
    if any(dict(profiles[label]) != baseline for label in LABELS[1:]):
        raise ChallengeError("Final benchmark missingness is not matched across classes")


def _assert_unique_verified_skus(selected: list[dict]) -> None:
    seen: dict[str, str] = {}
    for candidate in selected:
        for sku in candidate["hidden_dossier"]["verified_skus"]:
            if sku in seen:
                raise ChallengeError(f"Final benchmark reuses verified EAN/SKU across cases: {sku}")
            seen[sku] = candidate["candidate_id"]


def _v11_consensus_candidates(candidates: list[dict], author: dict[str, Any], blind: dict[str, Any]) -> list[dict]:
    return [
        candidate
        for candidate in candidates
        if author.get(candidate["candidate_id"], {}).get("label")
        == blind.get(candidate["candidate_id"], {}).get("label")
        == candidate["intended_label"]
    ]


def _v11_exact_cell_selection(candidates: list[dict], label: str) -> list[dict]:
    """Enumerate feasible stratum counts and choose the globally best profile."""
    strata = list(STRATUM_TARGETS[label])
    by_stratum = {
        stratum: sorted([item for item in candidates if item["stratum"] == stratum], key=_candidate_order_key)
        for stratum in strata
    }
    bounds = DIVERSITY_BOUNDS_V11[label]
    best: tuple[tuple[Any, ...], list[dict]] | None = None

    def visit(index: int, remaining: int, counts: list[int]) -> None:
        nonlocal best
        if index == len(strata):
            if remaining:
                return
            chosen = [
                item for stratum, count in zip(strata, counts, strict=True) for item in by_stratum[stratum][:count]
            ]
            score = (
                sum(
                    abs(count - STRATUM_TARGETS[label][stratum]) for stratum, count in zip(strata, counts, strict=True)
                ),
                tuple(_candidate_order_key(item) for item in chosen),
            )
            if best is None or score < best[0]:
                best = (score, chosen)
            return
        stratum = strata[index]
        lower = bounds["minimum"]
        upper = min(bounds["maximum"], len(by_stratum[stratum]), remaining)
        for count in range(lower, upper + 1):
            visit(index + 1, remaining - count, [*counts, count])

    visit(0, 25, [])
    if best is None:
        raise ChallengeError(f"v1.1 consensus lacks a feasible exact 25-case profile for {label}")
    return best[1]


def v11_select_consensus(candidates: list[dict], author: dict[str, Any], blind: dict[str, Any]) -> list[dict]:
    """Select exactly 150 reviewed consensus cases under v1.1 constraints."""
    safe_candidates, _ = v11_safe_pool(candidates)
    approved = _v11_consensus_candidates(safe_candidates, author, blind)
    selected = []
    for market in MARKETS:
        for label in LABELS:
            cell = [item for item in approved if item["market"] == market and item["intended_label"] == label]
            selected.extend(_v11_exact_cell_selection(cell, label))
    if len(selected) != 150:
        raise ChallengeError("v1.1 consensus did not select exactly 150 cases")
    _assert_selected_balance(selected)
    _assert_unique_verified_skus(selected)
    return selected


def v11_replenish(queue_manifest: dict, candidates: list[dict], author: dict[str, Any], blind: dict[str, Any]) -> dict:
    """Append only the next frozen queue range when consensus cannot freeze."""
    queue_manifest = _v11_reviewed_state(queue_manifest, candidates, author, blind)
    candidate_by_id = {item["candidate_id"]: item for item in candidates}
    released_ids = {
        candidate_id
        for cell in queue_manifest["cells"]
        for release in cell["release_ranges"]
        for candidate_id in cell["ordered_candidate_ids"][release["start"] : release["end"]]
    }
    released = [candidate_by_id[candidate_id] for candidate_id in released_ids]
    try:
        v11_select_consensus(released, author, blind)
        return queue_manifest
    except ChallengeError:
        pass
    updated_cells = []
    exhausted = True
    for cell in queue_manifest["cells"]:
        next_start = max(release["end"] for release in cell["release_ranges"])
        next_end = min(next_start + V11_REPLENISHMENT_BATCH_SIZE, len(cell["ordered_candidate_ids"]))
        releases = list(cell["release_ranges"])
        if next_start < next_end:
            releases.append({"start": next_start, "end": next_end})
            exhausted = False
        updated_cells.append({**cell, "release_ranges": releases})
    if exhausted:
        raise ChallengeError("v1.1 replenishment queue is exhausted before feasible consensus")
    return _v11_seal_queue({**queue_manifest, "cells": updated_cells})


def _v11_validate_review_ledger(document: Any, candidates: list[dict], *, blind: bool) -> dict[str, dict]:
    if not isinstance(document, dict) or set(document) != {"schema_version", "protocol_id", "entries"}:
        raise ChallengeError("v1.1 review ledger schema is invalid")
    if document["schema_version"] != SCHEMA_VERSION or document["protocol_id"] != AMENDMENT_PROTOCOL_ID:
        raise ChallengeError("v1.1 review ledger identity is invalid")
    token_to_id = {candidate["blind_review_token"]: candidate["candidate_id"] for candidate in candidates}
    known = set(token_to_id.values())
    entries: dict[str, dict] = {}
    for entry in document["entries"]:
        expected = (
            {"review_token", "label", "attestation", "reviewed_at"}
            if blind
            else {"candidate_id", "label", "attestation", "reviewed_at"}
        )
        if not isinstance(entry, dict) or set(entry) != expected or entry["label"] not in LABELS:
            raise ChallengeError("v1.1 review ledger entry is invalid")
        candidate_id = token_to_id.get(entry["review_token"]) if blind else entry["candidate_id"]
        if candidate_id not in known or candidate_id in entries:
            raise ChallengeError("v1.1 review ledger contains unknown or duplicate candidate")
        if (
            not isinstance(entry["attestation"], str)
            or not entry["attestation"]
            or not isinstance(entry["reviewed_at"], str)
            or not entry["reviewed_at"]
        ):
            raise ChallengeError("v1.1 review ledger requires attestation and timestamp")
        entries[candidate_id] = entry
    return entries


def v11_freeze_benchmark(
    queue_manifest: dict, candidates: list[dict], author: dict[str, dict], blind: dict[str, dict]
) -> dict:
    """Create v1.1 inference manifests only after exactly 150 consensus cases."""
    queue_manifest = _v11_reviewed_state(queue_manifest, candidates, author, blind)
    released_ids = {
        candidate_id
        for cell in queue_manifest["cells"]
        for release in cell["release_ranges"]
        for candidate_id in cell["ordered_candidate_ids"][release["start"] : release["end"]]
    }
    released = [candidate for candidate in candidates if candidate["candidate_id"] in released_ids]
    selected = v11_select_consensus(released, author, blind)
    if len(selected) != 150:
        raise ChallengeError("v1.1 inference manifests require exactly 150 MODEL_REVIEWED_CONSENSUS cases")
    selected.sort(key=_candidate_order_key)
    labels = []
    arm_a = []
    arm_b = []
    for ordinal, candidate in enumerate(selected, start=1):
        case_ref = f"v11-challenge-case-{ordinal:03d}"
        labels.append(
            {
                "case_ref": case_ref,
                "model_reviewed_consensus_label": candidate["intended_label"],
                "market": candidate["market"],
                "label_status": "MODEL_REVIEWED_CONSENSUS",
                "hidden_dossier_sha256": candidate["hidden_dossier_sha256"],
                "candidate_id": candidate["candidate_id"],
                "family_id": candidate["family_id"],
                "stratum": candidate["stratum"],
                "verified_skus": candidate["hidden_dossier"]["verified_skus"],
            }
        )
        arm_a.append(
            {
                "case_ref": case_ref,
                "market": candidate["market"],
                "model_visible_payload": minimal_arm_payload(candidate["model_visible_payload"]),
                "model_visible_payload_sha256": digest(minimal_arm_payload(candidate["model_visible_payload"])),
            }
        )
        arm_b.append(
            {
                "case_ref": case_ref,
                "market": candidate["market"],
                "model_visible_payload": enriched_arm_payload(candidate["model_visible_payload"]),
                "model_visible_payload_sha256": digest(enriched_arm_payload(candidate["model_visible_payload"])),
            }
        )
    _assert_selected_balance(selected)
    _assert_unique_verified_skus(selected)
    manifests = {}
    for key, arm, prompt, prompt_hash, cases in (
        ("arm_a", "A_MINIMAL", ARM_A_PROMPT_ID, ARM_A_PROMPT_SHA256, arm_a),
        ("arm_b", "B_ENRICHED", ARM_B_PROMPT_ID, ARM_B_PROMPT_SHA256, arm_b),
    ):
        for case in cases:
            provider_payload(case, arm=arm)
        manifests[key] = {
            "schema_version": SCHEMA_VERSION, "protocol_id": AMENDMENT_PROTOCOL_ID,
            "challenge_id": CHALLENGE_ID, "arm": arm, "requested_model_id": MODEL_ID,
            "prompt_id": prompt, "prompt_sha256": prompt_hash, "case_count": 150, "cases": cases,
        }
    receipt = {
        "protocol_id": AMENDMENT_PROTOCOL_ID, "inference_status": "NOT_RUN", "case_count": 150,
        "balance": {market: dict.fromkeys(LABELS, 25) for market in MARKETS},
        "queue_manifest_sha256": digest(queue_manifest), "label_ledger_sha256": digest(labels),
        "arm_a_manifest_sha256": digest(manifests["arm_a"]),
        "arm_b_manifest_sha256": digest(manifests["arm_b"]),
    }
    receipt["receipt_sha256"] = digest(receipt)
    return {
        "schema_version": SCHEMA_VERSION,
        "protocol_id": AMENDMENT_PROTOCOL_ID,
        "status": "FROZEN_MODEL_REVIEWED_CONSENSUS",
        "label_ledger": labels,
        "inference_manifests": manifests,
        "queue_manifest": queue_manifest,
        "freeze_receipt": receipt,
    }


def verify_v11_freeze(artifact: Any, candidates: list[dict]) -> dict:
    """Verify bindings AND semantics; a rehashed mutation cannot bypass the pins."""
    keys = {"schema_version", "protocol_id", "status", "label_ledger", "inference_manifests",
            "queue_manifest", "freeze_receipt"}
    if not isinstance(artifact, dict) or set(artifact) != keys:
        raise ChallengeError("v1.1 freeze schema is invalid")
    queue = artifact["queue_manifest"]
    validate_v11_queue_manifest(queue, candidates)
    records = queue["review_records"]
    expected = v11_freeze_benchmark(queue, candidates, records["author"], records["blind"])
    # Independently revalidate outbound documents even when their stored hashes agree.
    for key, arm in (("arm_a", "A_MINIMAL"), ("arm_b", "B_ENRICHED")):
        manifest = artifact["inference_manifests"].get(key)
        if not isinstance(manifest, dict) or not isinstance(manifest.get("cases"), list):
            raise ChallengeError("v1.1 arm manifest is invalid")
        for case in manifest["cases"]:
            provider_payload(case, arm=arm)
    if artifact != expected:
        raise ChallengeError("v1.1 freeze binding, balance, diversity or model/prompt pin mismatch")
    return deepcopy(artifact["freeze_receipt"])


def v11_verified_provider_payloads(artifact: dict, candidates: list[dict], *, arm: str) -> list[dict]:
    """Sole v1.1 runner adapter: verify the entire freeze before exposing any request."""
    verify_v11_freeze(artifact, candidates)
    key = {"A_MINIMAL": "arm_a", "B_ENRICHED": "arm_b"}.get(arm)
    if key is None:
        raise ChallengeError("Unknown challenge arm")
    return [provider_payload(case, arm=arm) for case in artifact["inference_manifests"][key]["cases"]]


def _v11_claim_transition(queue_path: Path, queue: dict) -> None:
    """Exclusive durable claim prevents applying the same persisted parent twice.

    A crash after the claim fails closed: retain it for recovery, never replay a
    batch automatically. New states are always written to a new path.
    """
    write_new(queue_path.with_name(queue_path.name + ".consumed"), {"state_sha256": queue["state_sha256"]})


def freeze_benchmark(
    candidate_pool: Any,
    author_ledger: Any,
    blind_ledger: Any,
    exclusion_index: set[str],
) -> dict:
    """Produce immutable local artifacts after author/blind consensus only.

    This creates no provider request and deliberately keeps labels out of both
    model manifests.  Callers must persist each returned artifact with
    `write_new`, never overwrite an earlier freeze.
    """
    candidates = validate_candidate_pool(candidate_pool, exclusion_index)
    author_labels = _validate_author_ledger(author_ledger, candidates)
    blind_labels = _validate_blind_ledger(blind_ledger, candidates)
    selected, rejected = consensus_select(candidates, author_labels, blind_labels)
    _assert_selected_balance(selected)
    _assert_matched_missingness(selected)
    _assert_unique_verified_skus(selected)
    selected_by_id = {candidate["candidate_id"]: candidate for candidate in selected}
    label_entries = []
    hidden_dossiers = []
    arm_a_cases = []
    arm_b_cases = []
    for ordinal, candidate in enumerate(sorted(selected, key=lambda item: digest(item["candidate_id"])), start=1):
        case_ref = f"challenge-case-{ordinal:03d}"
        # This opaque ref is local only. It never enters the provider payload.
        label_entries.append(
            {
                "case_ref": case_ref,
                "model_reviewed_consensus_label": candidate["intended_label"],
                "market": candidate["market"],
                "hidden_dossier_sha256": candidate["hidden_dossier_sha256"],
                "label_status": "MODEL_REVIEWED_CONSENSUS",
                "construction_author_label": author_labels[candidate["candidate_id"]]["label"],
                "blind_reviewer_label": blind_labels[candidate["candidate_id"]]["label"],
                "consensus": True,
            }
        )
        hidden_dossiers.append(
            {
                "case_ref": case_ref,
                "candidate_id": candidate["candidate_id"],
                "family_id": candidate["family_id"],
                "intended_label": candidate["intended_label"],
                "stratum": candidate["stratum"],
                "fingerprints": candidate["fingerprints"],
                "hidden_dossier": candidate["hidden_dossier"],
                "hidden_dossier_sha256": candidate["hidden_dossier_sha256"],
                "model_visible_payload_sha256": candidate["model_visible_payload_sha256"],
            }
        )
        arm_a_cases.append(
            {
                "case_ref": case_ref,
                "market": candidate["market"],
                "model_visible_payload": minimal_arm_payload(candidate["model_visible_payload"]),
                "model_visible_payload_sha256": digest(minimal_arm_payload(candidate["model_visible_payload"])),
            }
        )
        arm_b_cases.append(
            {
                "case_ref": case_ref,
                "market": candidate["market"],
                "model_visible_payload": enriched_arm_payload(candidate["model_visible_payload"]),
                "model_visible_payload_sha256": candidate["model_visible_payload_sha256"],
            }
        )
    if len(selected_by_id) != 150:
        raise ChallengeError("Selected cases must have unique local IDs")
    result = {
        "hidden_dossiers": {
            "schema_version": SCHEMA_VERSION,
            "challenge_id": CHALLENGE_ID,
            "entries": hidden_dossiers,
        },
        "label_ledger": {
            "schema_version": SCHEMA_VERSION,
            "challenge_id": CHALLENGE_ID,
            "balanced_challenge_notice": (
                "This is a balanced identity challenge benchmark, not an estimate of live TryVit class prevalence "
                "or expected production accuracy."
            ),
            "entries": label_entries,
        },
        "rejected_candidate_audit": {
            "schema_version": SCHEMA_VERSION,
            "challenge_id": CHALLENGE_ID,
            "entries": rejected,
        },
        "arm_a_manifest": {
            "schema_version": SCHEMA_VERSION,
            "challenge_id": CHALLENGE_ID,
            "arm": "A_MINIMAL",
            "requested_model_id": MODEL_ID,
            "prompt_id": ARM_A_PROMPT_ID,
            "prompt_sha256": ARM_A_PROMPT_SHA256,
            "cases": arm_a_cases,
        },
        "arm_b_manifest": {
            "schema_version": SCHEMA_VERSION,
            "challenge_id": CHALLENGE_ID,
            "arm": "B_ENRICHED",
            "requested_model_id": MODEL_ID,
            "prompt_id": ARM_B_PROMPT_ID,
            "prompt_sha256": ARM_B_PROMPT_SHA256,
            "cases": arm_b_cases,
        },
    }
    result["freeze_receipt"] = {
        "schema_version": SCHEMA_VERSION,
        "challenge_id": CHALLENGE_ID,
        "case_count": 150,
        "label_ledger_sha256": digest(result["label_ledger"]),
        "hidden_dossiers_sha256": digest(result["hidden_dossiers"]),
        "rejected_candidate_audit_sha256": digest(result["rejected_candidate_audit"]),
        "arm_a_manifest_sha256": digest(result["arm_a_manifest"]),
        "arm_b_manifest_sha256": digest(result["arm_b_manifest"]),
        "exclusion_index_sha256": digest(sorted(exclusion_index)),
        "review_protocol": "construction_author_and_blind_reviewer_consensus",
        "inference_status": "NOT_RUN",
    }
    return result


def write_freeze(output_dir: Path, artifacts: dict) -> dict[str, Path]:
    """Persist all frozen artifacts once, with a receipt that binds their hashes."""
    output_dir = Path(output_dir)
    names = {
        "hidden_dossiers": "hidden-construction-dossiers.json",
        "label_ledger": "consensus-label-ledger.json",
        "rejected_candidate_audit": "rejected-candidate-audit.json",
        "arm_a_manifest": "arm-a-minimal-manifest.json",
        "arm_b_manifest": "arm-b-enriched-manifest.json",
        "freeze_receipt": "freeze-receipt.json",
    }
    paths = {name: output_dir / filename for name, filename in names.items()}
    if any(path.exists() for path in paths.values()):
        raise ChallengeError("Frozen challenge artifacts already exist and cannot be overwritten")
    for name, path in paths.items():
        write_new(path, artifacts[name])
    return paths


def verify_freeze(output_dir: Path) -> dict:
    """Validate an immutable freeze receipt before future provider work is allowed."""
    output_dir = Path(output_dir)
    receipt = read_json(output_dir / "freeze-receipt.json")
    expected = {
        "label_ledger_sha256": ("consensus-label-ledger.json",),
        "hidden_dossiers_sha256": ("hidden-construction-dossiers.json",),
        "rejected_candidate_audit_sha256": ("rejected-candidate-audit.json",),
        "arm_a_manifest_sha256": ("arm-a-minimal-manifest.json",),
        "arm_b_manifest_sha256": ("arm-b-enriched-manifest.json",),
    }
    if not isinstance(receipt, dict) or receipt.get("challenge_id") != CHALLENGE_ID:
        raise ChallengeError("Freeze receipt is invalid")
    for key, (filename,) in expected.items():
        actual = digest(read_json(output_dir / filename))
        if receipt.get(key) != actual:
            raise ChallengeError(f"Frozen artifact integrity mismatch: {filename}")
    labels = read_json(output_dir / "consensus-label-ledger.json")
    if len(labels.get("entries", [])) != 150:
        raise ChallengeError("Frozen label ledger must contain exactly 150 cases")
    _assert_selected_balance(
        [
            {"market": entry["market"], "intended_label": entry["model_reviewed_consensus_label"]}
            for entry in labels["entries"]
        ]
    )
    for filename in ("arm-a-minimal-manifest.json", "arm-b-enriched-manifest.json"):
        manifest = read_json(output_dir / filename)
        if filename.startswith("arm-a"):
            expected_arm, expected_prompt, expected_hash = "A_MINIMAL", ARM_A_PROMPT_ID, ARM_A_PROMPT_SHA256
        else:
            expected_arm, expected_prompt, expected_hash = "B_ENRICHED", ARM_B_PROMPT_ID, ARM_B_PROMPT_SHA256
        if (
            manifest.get("challenge_id") != CHALLENGE_ID
            or manifest.get("arm") != expected_arm
            or manifest.get("requested_model_id") != MODEL_ID
            or manifest.get("prompt_id") != expected_prompt
            or manifest.get("prompt_sha256") != expected_hash
        ):
            raise ChallengeError(f"Frozen arm configuration is invalid: {filename}")
        if len(manifest.get("cases", [])) != 150:
            raise ChallengeError(f"Frozen arm manifest case count is invalid: {filename}")
        arm = "A_MINIMAL" if filename.startswith("arm-a") else "B_ENRICHED"
        for case in manifest["cases"]:
            provider_payload(case, arm=arm)
    return receipt


def classification_metrics(labels: list[str], predictions: list[str]) -> dict:
    if len(labels) != len(predictions):
        raise ChallengeError("Metric labels and predictions differ in length")
    confusion = {actual: dict.fromkeys(LABELS, 0) for actual in LABELS}
    for actual, predicted in zip(labels, predictions, strict=True):
        if actual not in LABELS or predicted not in LABELS:
            raise ChallengeError("Unknown metric label")
        confusion[actual][predicted] += 1
    per_class = {}
    for label in LABELS:
        tp = confusion[label][label]
        fp = sum(confusion[actual][label] for actual in LABELS if actual != label)
        fn = sum(confusion[label][predicted] for predicted in LABELS if predicted != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"precision": precision, "recall": recall, "f1": f1}
    return {
        "accuracy": sum(confusion[label][label] for label in LABELS) / len(labels) if labels else 0.0,
        "macro_f1": sum(values["f1"] for values in per_class.values()) / len(LABELS),
        "per_class": per_class,
        "confusion": confusion,
        "dangerous_false_consistent": confusion["INCONSISTENT"]["CONSISTENT"],
        "unnecessary_rejection": (
            confusion["CONSISTENT"]["INCONSISTENT"] + confusion["CONSISTENT"]["INSUFFICIENT_EVIDENCE"]
        ),
    }


def top_label_ece(labels: list[str], probabilities: list[dict[str, float]], case_refs: list[str]) -> float:
    lengths_match = len(labels) == len(probabilities) == len(case_refs) == 150
    if not lengths_match or len(set(case_refs)) != 150:
        raise ChallengeError("ECE requires exactly 150 aligned challenge cases")
    rows = []
    for label, values, case_ref in zip(labels, probabilities, case_refs, strict=True):
        if set(values) != set(LABELS):
            raise ChallengeError("Probability keys do not match labels")
        prediction = max(LABELS, key=lambda item: (values[item], item))
        rows.append((max(values.values()), prediction == label, case_ref))
    rows.sort(key=lambda item: (item[0], item[2]))
    total = 0.0
    for offset in range(0, 150, 15):
        bucket = rows[offset : offset + 15]
        mean_confidence = sum(item[0] for item in bucket) / 15
        mean_accuracy = sum(item[1] for item in bucket) / 15
        total += abs(mean_confidence - mean_accuracy) / 10
    return total


def multiclass_brier(labels: list[str], probabilities: list[dict[str, float]]) -> float:
    if len(labels) != len(probabilities) or not labels:
        raise ChallengeError("Brier score requires aligned non-empty values")
    total = 0.0
    for actual, values in zip(labels, probabilities, strict=True):
        if actual not in LABELS or set(values) != set(LABELS):
            raise ChallengeError("Brier score labels are invalid")
        total += sum((values[label] - float(label == actual)) ** 2 for label in LABELS)
    return total / len(labels)


def stratified_bootstrap(
    cases: list[dict], arm_a: list[str], arm_b: list[str], iterations: int = 10_000, seed: int = 20260920
) -> dict:
    """Return descriptive paired percentile intervals over six class/market cells."""
    if len(cases) != 150 or len(arm_a) != 150 or len(arm_b) != 150:
        raise ChallengeError("Bootstrap requires 150 aligned challenge cases")
    buckets: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, case in enumerate(cases):
        label, market = case.get("expected_label"), case.get("market")
        if label not in LABELS or market not in MARKETS:
            raise ChallengeError("Bootstrap case label or market is invalid")
        buckets[(label, market)].append(index)
    if any(len(bucket) != 25 for bucket in buckets.values()) or len(buckets) != 6:
        raise ChallengeError("Bootstrap requires 25 cases in every label/market cell")
    rng = random.Random(seed)  # noqa: S311 - deterministic bootstrap resampling is intentional.
    distributions: dict[str, list[float]] = defaultdict(list)
    for _ in range(iterations):
        sampled = [rng.choice(bucket) for bucket in buckets.values() for _ in range(len(bucket))]
        actual = [cases[index]["expected_label"] for index in sampled]
        metrics_a = classification_metrics(actual, [arm_a[index] for index in sampled])
        metrics_b = classification_metrics(actual, [arm_b[index] for index in sampled])
        distributions["overall_accuracy"].append(metrics_b["accuracy"])
        distributions["macro_f1"].append(metrics_b["macro_f1"])
        distributions["consistent_precision"].append(metrics_b["per_class"]["CONSISTENT"]["precision"])
        distributions["consistent_recall"].append(metrics_b["per_class"]["CONSISTENT"]["recall"])
        distributions["inconsistent_recall"].append(metrics_b["per_class"]["INCONSISTENT"]["recall"])
        distributions["insufficient_recall"].append(metrics_b["per_class"]["INSUFFICIENT_EVIDENCE"]["recall"])
        distributions["arm_b_minus_arm_a_macro_f1"].append(metrics_b["macro_f1"] - metrics_a["macro_f1"])
    intervals = {}
    for name, values in distributions.items():
        values.sort()
        lower_index = math.floor((len(values) - 1) * 0.025)
        upper_index = math.ceil((len(values) - 1) * 0.975)
        intervals[name] = {"lower": values[lower_index], "upper": values[upper_index]}
    return intervals


def _validate_probabilities(value: Any) -> dict[str, float]:
    if not isinstance(value, dict) or set(value) != set(LABELS):
        raise ChallengeError("Provider probability vector does not match challenge labels")
    probabilities = {}
    for label, probability in value.items():
        if not isinstance(probability, (int, float)) or not math.isfinite(probability) or not 0 <= probability <= 1:
            raise ChallengeError("Provider probability is invalid")
        probabilities[label] = float(probability)
    if abs(sum(probabilities.values()) - 1) > 0.011:
        raise ChallengeError("Provider probability distribution is invalid")
    return probabilities


def validate_arm_results(document: Any, manifest: dict) -> list[dict]:
    """Validate a later arm result file without altering provider values."""
    required = {"schema_version", "challenge_id", "arm", "manifest_sha256", "results"}
    if not isinstance(document, dict) or set(document) != required:
        raise ChallengeError("Arm result document schema is invalid")
    if (
        document["schema_version"] != SCHEMA_VERSION
        or document["challenge_id"] != CHALLENGE_ID
        or document["arm"] != manifest.get("arm")
        or document["manifest_sha256"] != digest(manifest)
        or not isinstance(document["results"], list)
    ):
        raise ChallengeError("Arm result document does not bind the frozen manifest")
    expected = {case["case_ref"] for case in manifest["cases"]}
    results: dict[str, dict] = {}
    for result in document["results"]:
        fields = {
            "case_ref",
            "execution_status",
            "identity_answer",
            "identity_probabilities",
            "elapsed_seconds",
            "attempt_count",
            "estimated_cost_usd",
        }
        if not isinstance(result, dict) or set(result) != fields or result.get("case_ref") not in expected:
            raise ChallengeError("Arm result entry is invalid")
        if result["case_ref"] in results or result["execution_status"] not in {"completed", "failed"}:
            raise ChallengeError("Arm result has duplicate case or invalid status")
        if not isinstance(result["elapsed_seconds"], (int, float)) or result["elapsed_seconds"] < 0:
            raise ChallengeError("Arm result elapsed time is invalid")
        if not isinstance(result["attempt_count"], int) or not 1 <= result["attempt_count"] <= 3:
            raise ChallengeError("Arm result attempt count is invalid")
        if not isinstance(result["estimated_cost_usd"], (int, float)) or result["estimated_cost_usd"] < 0:
            raise ChallengeError("Arm result estimated cost is invalid")
        if result["execution_status"] == "completed":
            if result["identity_answer"] not in LABELS:
                raise ChallengeError("Completed arm result has an unknown identity answer")
            _validate_probabilities(result["identity_probabilities"])
        elif result["identity_answer"] is not None or result["identity_probabilities"] is not None:
            raise ChallengeError("Failed arm result must not invent an identity answer")
        results[result["case_ref"]] = result
    if set(results) != expected:
        raise ChallengeError("Arm result document does not cover every frozen case")
    return [results[case["case_ref"]] for case in manifest["cases"]]


def comparison_report(arm_a_document: Any, arm_b_document: Any, output_dir: Path) -> dict:
    """Create a metrics document only after two complete, immutable arm runs."""
    receipt = verify_freeze(output_dir)
    output_dir = Path(output_dir)
    arm_a_manifest = read_json(output_dir / "arm-a-minimal-manifest.json")
    arm_b_manifest = read_json(output_dir / "arm-b-enriched-manifest.json")
    labels = read_json(output_dir / "consensus-label-ledger.json")["entries"]
    expected = [entry["model_reviewed_consensus_label"] for entry in labels]
    markets = [entry["market"] for entry in labels]
    results_a = validate_arm_results(arm_a_document, arm_a_manifest)
    results_b = validate_arm_results(arm_b_document, arm_b_manifest)
    complete_a = [result for result in results_a if result["execution_status"] == "completed"]
    complete_b = [result for result in results_b if result["execution_status"] == "completed"]
    if len(complete_a) != 150 or len(complete_b) != 150:
        raise ChallengeError("Challenge metrics require all 150 frozen cases to complete in both arms")
    predictions_a = [result["identity_answer"] for result in results_a]
    predictions_b = [result["identity_answer"] for result in results_b]
    probabilities_a = [result["identity_probabilities"] for result in results_a]
    probabilities_b = [result["identity_probabilities"] for result in results_b]
    metrics_a = classification_metrics(expected, predictions_a)
    metrics_b = classification_metrics(expected, predictions_b)
    confidence_failures = sum(
        expected[index] == "INCONSISTENT"
        and predictions_b[index] == "CONSISTENT"
        and probabilities_b[index]["CONSISTENT"] >= 0.95
        for index in range(150)
    )
    cases = [
        {"expected_label": expected[index], "market": markets[index], "case_ref": labels[index]["case_ref"]}
        for index in range(150)
    ]
    p95_latency = sorted(result["elapsed_seconds"] for result in results_b)[math.ceil(150 * 0.95) - 1]
    completion_b = len(complete_b) / 150
    delta = metrics_b["macro_f1"] - metrics_a["macro_f1"]
    gates = {
        "valid_completion_100_percent": completion_b == 1.0,
        "zero_dangerous_false_consistent": metrics_b["dangerous_false_consistent"] == 0,
        "inconsistent_recall_at_least_96_percent": metrics_b["per_class"]["INCONSISTENT"]["recall"] >= 0.96,
        "consistent_precision_at_least_95_percent": metrics_b["per_class"]["CONSISTENT"]["precision"] >= 0.95,
        "consistent_recall_at_least_90_percent": metrics_b["per_class"]["CONSISTENT"]["recall"] >= 0.90,
        "insufficient_recall_at_least_80_percent": metrics_b["per_class"]["INSUFFICIENT_EVIDENCE"]["recall"] >= 0.80,
        "macro_f1_at_least_0_88": metrics_b["macro_f1"] >= 0.88,
        "macro_f1_delta_at_least_0_05": delta >= 0.05,
        "no_more_dangerous_errors_than_arm_a": (
            metrics_b["dangerous_false_consistent"] <= metrics_a["dangerous_false_consistent"]
        ),
        "ece_at_most_0_10": top_label_ece(expected, probabilities_b, [entry["case_ref"] for entry in labels]) <= 0.10,
        "brier_at_most_0_25": multiclass_brier(expected, probabilities_b) <= 0.25,
        "cost_at_most_0_10": sum(result["estimated_cost_usd"] for result in results_b) <= 0.10,
        "p95_latency_at_most_5_seconds": p95_latency <= 5.0,
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "challenge_id": CHALLENGE_ID,
        "balanced_challenge_notice": (
            "This is a balanced identity challenge benchmark, not an estimate of live TryVit class prevalence "
            "or expected production accuracy."
        ),
        "operational_cohort_metrics_included": False,
        "freeze_receipt_sha256": digest(receipt),
        "arm_a": {
            "metrics": metrics_a,
            "ece": top_label_ece(expected, probabilities_a, [entry["case_ref"] for entry in labels]),
            "brier": multiclass_brier(expected, probabilities_a),
        },
        "arm_b": {
            "metrics": metrics_b,
            "ece": top_label_ece(expected, probabilities_b, [entry["case_ref"] for entry in labels]),
            "brier": multiclass_brier(expected, probabilities_b),
            "completion_rate": completion_b,
            "high_confidence_dangerous_false_consistent": confidence_failures,
            "p95_latency_seconds": p95_latency,
            "estimated_cost_usd": sum(result["estimated_cost_usd"] for result in results_b),
        },
        "macro_f1_delta_arm_b_minus_arm_a": delta,
        "bootstrap_95_percent_ci": stratified_bootstrap(cases, predictions_a, predictions_b),
        "promotion_gates": gates,
        "all_promotion_gates_pass": all(gates.values()),
    }


def _read_exclusion_index(path: Path) -> set[str]:
    document = read_json(path)
    if not isinstance(document, dict) or document.get("challenge_id") != CHALLENGE_ID:
        raise ChallengeError("Exclusion index is invalid")
    fingerprints = document.get("fingerprints")
    if not isinstance(fingerprints, list) or any(not isinstance(item, str) for item in fingerprints):
        raise ChallengeError("Exclusion index fingerprints are invalid")
    return set(fingerprints)


def _cli_path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def main(argv: list[str] | None = None) -> int:
    """Offline artifact utility. It deliberately has no provider or database command."""
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    index_parser = commands.add_parser("build-exclusion-index")
    index_parser.add_argument("--source", action="append", type=_cli_path, required=True)
    index_parser.add_argument("--output", type=_cli_path, required=True)
    packet_parser = commands.add_parser("blind-review-packets")
    packet_parser.add_argument("--candidate-pool", type=_cli_path, required=True)
    packet_parser.add_argument("--exclusion-index", type=_cli_path, required=True)
    packet_parser.add_argument("--output", type=_cli_path, required=True)
    freeze_parser = commands.add_parser("freeze")
    freeze_parser.add_argument("--candidate-pool", type=_cli_path, required=True)
    freeze_parser.add_argument("--author-ledger", type=_cli_path, required=True)
    freeze_parser.add_argument("--blind-ledger", type=_cli_path, required=True)
    freeze_parser.add_argument("--exclusion-index", type=_cli_path, required=True)
    freeze_parser.add_argument("--output-dir", type=_cli_path, required=True)
    verify_parser = commands.add_parser("verify-freeze")
    verify_parser.add_argument("--output-dir", type=_cli_path, required=True)
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("--output-dir", type=_cli_path, required=True)
    compare_parser.add_argument("--arm-a-results", type=_cli_path, required=True)
    compare_parser.add_argument("--arm-b-results", type=_cli_path, required=True)
    compare_parser.add_argument("--output", type=_cli_path, required=True)
    v11_prepare = commands.add_parser("v1-1-prepare-review")
    v11_prepare.add_argument("--candidate-pool", type=_cli_path, required=True)
    v11_prepare.add_argument("--exclusion-index", type=_cli_path, required=True)
    v11_prepare.add_argument("--queue-output", type=_cli_path, required=True)
    v11_prepare.add_argument("--reviewer-output", type=_cli_path, required=True)
    v11_replenish_parser = commands.add_parser("v1-1-replenish")
    v11_replenish_parser.add_argument("--candidate-pool", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--exclusion-index", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--queue-manifest", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--author-ledger", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--blind-ledger", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--output", type=_cli_path, required=True)
    v11_replenish_parser.add_argument("--reviewer-output", type=_cli_path, required=True)
    v11_freeze_parser = commands.add_parser("v1-1-freeze")
    v11_freeze_parser.add_argument("--candidate-pool", type=_cli_path, required=True)
    v11_freeze_parser.add_argument("--exclusion-index", type=_cli_path, required=True)
    v11_freeze_parser.add_argument("--queue-manifest", type=_cli_path, required=True)
    v11_freeze_parser.add_argument("--author-ledger", type=_cli_path, required=True)
    v11_freeze_parser.add_argument("--blind-ledger", type=_cli_path, required=True)
    v11_freeze_parser.add_argument("--output", type=_cli_path, required=True)
    v11_verify = commands.add_parser("verify-v1-1-freeze")
    v11_verify.add_argument("--candidate-pool", type=_cli_path, required=True)
    v11_verify.add_argument("--exclusion-index", type=_cli_path, required=True)
    v11_verify.add_argument("--freeze", type=_cli_path, required=True)
    args = parser.parse_args(argv)
    if args.command == "build-exclusion-index":
        document = build_exclusion_index(args.source)
        write_new(args.output, document)
        result: Any = {"status": "ok", "path": str(args.output), "sha256": digest(document)}
    elif args.command == "blind-review-packets":
        exclusion_index = _read_exclusion_index(args.exclusion_index)
        candidates = validate_candidate_pool(read_json(args.candidate_pool), exclusion_index)
        packets = blind_review_packets(candidates)
        write_new(args.output, packets)
        result = {"status": "ok", "path": str(args.output), "sha256": digest(packets), "case_count": len(candidates)}
    elif args.command == "freeze":
        artifacts = freeze_benchmark(
            read_json(args.candidate_pool),
            read_json(args.author_ledger),
            read_json(args.blind_ledger),
            _read_exclusion_index(args.exclusion_index),
        )
        paths = write_freeze(args.output_dir, artifacts)
        result = {"status": "ok", "paths": {name: str(path) for name, path in paths.items()}}
    elif args.command in {"v1-1-prepare-review", "v1-1-replenish", "v1-1-freeze", "verify-v1-1-freeze"}:
        candidates = validate_v11_candidate_pool(
            read_json(args.candidate_pool), _read_exclusion_index(args.exclusion_index)
        )
        if args.command == "verify-v1-1-freeze":
            receipt = verify_v11_freeze(read_json(args.freeze), candidates)
            result = {"status": "ok", "freeze_receipt_sha256": digest(receipt)}
        elif args.command == "v1-1-prepare-review":
            queue = v11_create_queue_manifest(candidates)
            reviewer_export = v11_blind_review_export(queue, candidates)
            write_new(args.queue_output, queue)
            write_new(args.reviewer_output, reviewer_export)
            result = {"status": "ok", "queue_sha256": digest(queue), "review_packet_count": len(reviewer_export)}
        else:
            queue = read_json(args.queue_manifest)
            author = _v11_validate_review_ledger(read_json(args.author_ledger), candidates, blind=False)
            blind = _v11_validate_review_ledger(read_json(args.blind_ledger), candidates, blind=True)
            artifact = (
                v11_replenish(queue, candidates, author, blind)
                if args.command == "v1-1-replenish"
                else v11_freeze_benchmark(queue, candidates, author, blind)
            )
            if args.command == "v1-1-replenish":
                reviewer_export = v11_blind_review_export(artifact, candidates)
                if not reviewer_export:
                    raise ChallengeError("v1.1 consensus ready; freeze instead of exporting a duplicate batch")
                if args.reviewer_output.exists():
                    raise ChallengeError("v1.1 reviewer output already exists")
            else:
                verify_v11_freeze(artifact, candidates)
            if args.output.exists():
                raise ChallengeError("v1.1 transition output already exists")
            _v11_claim_transition(args.queue_manifest, queue)
            write_new(args.output, artifact)
            if args.command == "v1-1-replenish":
                write_new(args.reviewer_output, reviewer_export)
            result = {"status": "ok", "sha256": digest(artifact)}
    else:
        if args.command == "verify-freeze":
            receipt = verify_freeze(args.output_dir)
            result = {"status": "ok", "freeze_receipt_sha256": digest(receipt)}
        else:
            report = comparison_report(read_json(args.arm_a_results), read_json(args.arm_b_results), args.output_dir)
            write_new(args.output, report)
            result = {"status": "ok", "path": str(args.output), "sha256": digest(report)}
    sys.stdout.write(json.dumps(result, ensure_ascii=False, allow_nan=False) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
