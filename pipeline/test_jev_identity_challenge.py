from __future__ import annotations

import pytest

from pipeline import jev_identity_challenge as challenge


def visible_payload(market: str = "PL") -> dict:
    base = dict.fromkeys(challenge.BASE_FIELDS)
    base.update(product_name="Product", brand="Brand")
    enriched = dict.fromkeys(challenge.SEMANTIC_FIELDS)
    enriched.update(product_name="Product", brand="Brand", manufacturer_owner="Owner")
    return {
        "market": market,
        "reference": dict(base),
        "candidate": dict(base),
        "enrichment": {"reference": dict(enriched), "candidate": dict(enriched)},
    }


def candidate(market: str, label: str, stratum: str, ordinal: int) -> dict:
    ean = f"5900000{ordinal:06d}"
    ground_truth = {"reference_ean": ean, "candidate_ean": ean, "rationale": "Verified same SKU."}
    if label == "INCONSISTENT":
        ground_truth["candidate_ean"] = f"4000000{ordinal:06d}"
        ground_truth["rationale"] = "Verified different SKU with an explicit incompatible flavor."
    if label == "INSUFFICIENT_EVIDENCE":
        ground_truth = {
            "rationale": "The visible semantic packet permits both source-grounded completions.",
            "competing_completions": ["same SKU", "different SKU"],
            "visible_packet_dual_plausible": True,
        }
    return {
        "candidate_id": f"{market}-{label}-{stratum}-{ordinal}",
        "family_id": f"family-{market}-{label}-{stratum}-{ordinal}",
        "market": market,
        "intended_label": label,
        "stratum": stratum,
        "fingerprints": [f"fingerprint-{market}-{label}-{stratum}-{ordinal}"],
        "model_visible_payload": visible_payload(market),
        "hidden_dossier": {
            "ground_truth": ground_truth,
            "sources": [
                {
                    "url": f"https://official.example/{ordinal}",
                    "publisher": "Official brand owner",
                    "domain": "official.example",
                    "role": "official",
                    "captured_at": "2026-09-20T00:00:00Z",
                    "source_sha256": "a" * 64,
                },
                {
                    "url": f"https://retailer.example/{ordinal}",
                    "publisher": "Independent retailer",
                    "domain": "retailer.example",
                    "role": "independent_retailer",
                    "captured_at": "2026-09-20T00:00:00Z",
                    "source_sha256": "b" * 64,
                },
            ],
            "independence_attestation": (
                "Distinct official and retailer publishers independently corroborate this identity."
            ),
            "verified_skus": [ean] if label != "INCONSISTENT" else [ean, ground_truth["candidate_ean"]],
        },
    }


def test_model_visible_payload_rejects_identifiers_and_label_hints():
    payload = visible_payload()
    payload["enrichment"]["reference"]["aliases"] = "https://example.test/product/5901234567890"
    with pytest.raises(challenge.ChallengeError, match="Identifier leakage"):
        challenge.validate_model_visible_payload(payload)
    payload = visible_payload()
    payload["enrichment"]["reference"]["brand"] = "Different brand"
    with pytest.raises(challenge.ChallengeError, match="may not alter"):
        challenge.validate_model_visible_payload(payload)
    payload = visible_payload()
    payload["enrichment"]["reference"]["ean"] = "5901234567890"
    with pytest.raises(challenge.ChallengeError, match="unexpected shape"):
        challenge.validate_model_visible_payload(payload)
    payload = visible_payload()
    payload["reference"]["product_name"] = "Product 5901234567890"
    payload["enrichment"]["reference"]["product_name"] = "Product 5901234567890"
    with pytest.raises(challenge.ChallengeError, match="Identifier leakage"):
        challenge.validate_model_visible_payload(payload)


def test_candidate_rejects_historical_fingerprint_overlap():
    item = candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 1)
    with pytest.raises(challenge.ChallengeError, match="overlaps"):
        challenge.validate_candidate(item, {item["fingerprints"][0]})


def test_consensus_selection_requires_exact_quotas_and_rejects_disagreement():
    candidates = []
    author, blind = {}, {}
    ordinal = 0
    for market in challenge.MARKETS:
        for label, strata in challenge.STRATUM_TARGETS.items():
            for stratum, target in strata.items():
                for _ in range(target):
                    ordinal += 1
                    item = candidate(market, label, stratum, ordinal)
                    candidates.append(item)
                    author[item["candidate_id"]] = label
                    blind[item["candidate_id"]] = label
    selected, rejected = challenge.consensus_select(candidates, author, blind)
    assert len(selected) == 150
    assert rejected == []
    blind[candidates[0]["candidate_id"]] = "INCONSISTENT"
    with pytest.raises(challenge.ChallengeError, match="Consensus shortage"):
        challenge.consensus_select(candidates, author, blind)
    candidate_id = candidates[0]["candidate_id"]
    rejected = challenge._rejected_entry(
        candidates[0], "reviewer_disagreement", author[candidate_id], blind[candidate_id]
    )
    assert {
        "candidate_id",
        "candidate_sha256",
        "market",
        "intended_class",
        "stratum",
        "construction_author_label",
        "blind_reviewer_label",
        "reason",
        "hidden_dossier_sha256",
        "construction_author_attestation",
        "blind_reviewer_reviewed_at",
    }.issubset(rejected)


def test_metrics_and_ece_are_deterministic():
    labels = [label for label in challenge.LABELS for _ in range(50)]
    metrics = challenge.classification_metrics(labels, labels)
    assert metrics["accuracy"] == 1.0
    assert metrics["dangerous_false_consistent"] == 0
    probabilities = [{label: 1.0 if label == actual else 0.0 for label in challenge.LABELS} for actual in labels]
    assert challenge.top_label_ece(labels, probabilities, [f"case-{index:03d}" for index in range(150)]) == 0.0
    assert challenge.multiclass_brier(labels, probabilities) == 0.0


def test_stratified_bootstrap_uses_paired_label_market_cells():
    cases = [
        {"expected_label": label, "market": market}
        for label in challenge.LABELS
        for market in challenge.MARKETS
        for _ in range(25)
    ]
    labels = [case["expected_label"] for case in cases]
    intervals = challenge.stratified_bootstrap(cases, labels, labels, iterations=100, seed=1)
    assert intervals["macro_f1"] == {"lower": 1.0, "upper": 1.0}
    assert intervals["arm_b_minus_arm_a_macro_f1"] == {"lower": 0.0, "upper": 0.0}


def consensus_input() -> tuple[dict, dict, dict]:
    candidates, author_entries, blind_entries = [], [], []
    ordinal = 0
    for market in challenge.MARKETS:
        for label, strata in challenge.STRATUM_TARGETS.items():
            for stratum, target in strata.items():
                for _ in range(target):
                    ordinal += 1
                    item = candidate(market, label, stratum, ordinal)
                    normalized = challenge.validate_candidate(item, set())
                    candidates.append(item)
                    author_entries.append(
                        {
                            "candidate_id": item["candidate_id"],
                            "label": label,
                            "attestation": "Reviewed full dossier.",
                            "reviewed_at": "2026-09-20T00:00:00Z",
                        }
                    )
                    blind_entries.append(
                        {
                            "review_token": normalized["blind_review_token"],
                            "label": label,
                            "attestation": "Reviewed semantic packet only.",
                            "reviewed_at": "2026-09-20T00:00:00Z",
                        }
                    )
        for label, strata in challenge.STRATUM_TARGETS.items():
            for stratum, target in strata.items():
                for _ in range(challenge.RAW_STRATUM_MINIMA[label][stratum] - target):
                    ordinal += 1
                    item = candidate(market, label, stratum, ordinal)
                    normalized = challenge.validate_candidate(item, set())
                    candidates.append(item)
                    author_entries.append(
                        {
                            "candidate_id": item["candidate_id"],
                            "label": label,
                            "attestation": "Reviewed full dossier.",
                            "reviewed_at": "2026-09-20T00:00:00Z",
                        }
                    )
                    blind_entries.append(
                        {
                            "review_token": normalized["blind_review_token"],
                            "label": label,
                            "attestation": "Reviewed semantic packet only.",
                            "reviewed_at": "2026-09-20T00:00:00Z",
                        }
                    )
    envelope = {"schema_version": 1, "challenge_id": challenge.CHALLENGE_ID, "candidates": candidates}
    author = {"schema_version": 1, "challenge_id": challenge.CHALLENGE_ID, "entries": author_entries}
    blind = {"schema_version": 1, "challenge_id": challenge.CHALLENGE_ID, "entries": blind_entries}
    return envelope, author, blind


def test_blind_packets_expose_only_an_opaque_token_and_semantic_payload():
    envelope, _, _ = consensus_input()
    candidates = challenge.validate_candidate_pool(envelope, set())
    packets = challenge.blind_review_packets(candidates)
    assert len(packets["packets"]) == 252
    packet = packets["packets"][0]
    assert set(packet) == {"review_token", "model_visible_payload", "model_visible_payload_sha256"}
    assert "CONSISTENT" not in packet["review_token"]
    assert "ean" not in repr(packet).lower()


def test_candidate_pool_requires_overgeneration_before_reviewer_work():
    item = candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 1)
    pool = {"schema_version": 1, "challenge_id": challenge.CHALLENGE_ID, "candidates": [item]}
    with pytest.raises(challenge.ChallengeError, match="at least 40 raw candidates"):
        challenge.validate_candidate_pool(pool, set())


def test_freeze_keeps_labels_out_of_arm_manifests_and_verifies_integrity(tmp_path):
    envelope, author, blind = consensus_input()
    artifacts = challenge.freeze_benchmark(envelope, author, blind, set())
    assert artifacts["freeze_receipt"]["inference_status"] == "NOT_RUN"
    assert len(artifacts["label_ledger"]["entries"]) == 150
    assert artifacts["label_ledger"]["entries"][0]["label_status"] == "MODEL_REVIEWED_CONSENSUS"
    assert "model_reviewed_consensus_label" in artifacts["label_ledger"]["entries"][0]
    arm_text = repr(artifacts["arm_a_manifest"]) + repr(artifacts["arm_b_manifest"])
    assert "expected_label" not in arm_text
    assert "hidden_dossier" not in arm_text
    outbound = challenge.provider_payload(artifacts["arm_b_manifest"]["cases"][0], arm="B_ENRICHED")
    assert set(outbound) == {"market", "reference", "candidate", "enrichment"}
    assert "case_ref" not in outbound
    challenge.write_freeze(tmp_path, artifacts)
    assert challenge.verify_freeze(tmp_path)["case_count"] == 150
    receipt = tmp_path / "freeze-receipt.json"
    assert receipt.exists()
    (tmp_path / "arm-a-minimal-manifest.json").write_text("{}", encoding="utf-8")
    with pytest.raises(challenge.ChallengeError, match="integrity mismatch"):
        challenge.verify_freeze(tmp_path)


def test_same_domain_sources_require_authoritative_exception():
    item = candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 99)
    item["hidden_dossier"]["sources"][1]["domain"] = "official.example"
    with pytest.raises(challenge.ChallengeError, match="distinct independent publishers"):
        challenge.validate_candidate(item, set())


def test_same_publisher_different_domain_is_not_independent():
    item = candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 98)
    item["hidden_dossier"]["sources"][1]["publisher"] = "Official brand owner"
    item["hidden_dossier"]["sources"][1]["domain"] = "shop.official.example"
    with pytest.raises(challenge.ChallengeError, match="distinct independent publishers"):
        challenge.validate_candidate(item, set())
    item["hidden_dossier"]["single_source_exception"] = "Two pages preserve the same publisher record."
    with pytest.raises(challenge.ChallengeError, match="distinct independent publishers"):
        challenge.validate_candidate(item, set())


def test_single_authoritative_source_exception_is_allowed_only_with_justification():
    item = candidate("DE", "CONSISTENT", "manufacturer_consumer_brand", 97)
    item["hidden_dossier"]["sources"] = item["hidden_dossier"]["sources"][:1]
    item["hidden_dossier"]["single_source_exception"] = (
        "The official manufacturer SKU page is the only public authority."
    )
    assert challenge.validate_candidate(item, set())["candidate_id"] == item["candidate_id"]


def test_insufficient_candidate_requires_hidden_dual_plausibility_attestation():
    item = candidate("DE", "INSUFFICIENT_EVIDENCE", "generic_product_name", 99)
    del item["hidden_dossier"]["ground_truth"]["visible_packet_dual_plausible"]
    with pytest.raises(challenge.ChallengeError, match="competing completions"):
        challenge.validate_candidate(item, set())


def test_final_selection_rejects_reused_verified_sku_across_different_families():
    first = challenge.validate_candidate(candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 201), set())
    second = candidate("DE", "CONSISTENT", "manufacturer_consumer_brand", 202)
    second["hidden_dossier"]["verified_skus"] = first["hidden_dossier"]["verified_skus"]
    second = challenge.validate_candidate(second, set())
    with pytest.raises(challenge.ChallengeError, match="reuses verified EAN/SKU"):
        challenge._assert_unique_verified_skus([first, second])


def test_final_selection_rejects_reference_sku_reused_as_candidate_sku():
    first = challenge.validate_candidate(candidate("PL", "INCONSISTENT", "flavor", 203), set())
    second = candidate("DE", "INCONSISTENT", "flavor", 204)
    second["hidden_dossier"]["verified_skus"] = ["different-sku", first["hidden_dossier"]["verified_skus"][0]]
    second = challenge.validate_candidate(second, set())
    with pytest.raises(challenge.ChallengeError, match="reuses verified EAN/SKU"):
        challenge._assert_unique_verified_skus([first, second])


def test_ece_is_invariant_to_ledger_order_when_case_refs_are_preserved():
    labels = [label for label in challenge.LABELS for _ in range(50)]
    probabilities = [{"CONSISTENT": 0.6, "INCONSISTENT": 0.2, "INSUFFICIENT_EVIDENCE": 0.2} for _ in labels]
    refs = [f"case-{index:03d}" for index in range(150)]
    original = challenge.top_label_ece(labels, probabilities, refs)
    order = list(reversed(range(150)))
    shuffled = challenge.top_label_ece(
        [labels[index] for index in order], [probabilities[index] for index in order], [refs[index] for index in order]
    )
    assert shuffled == original


def test_result_validator_binds_manifest_and_rejects_invalid_probability():
    envelope, author, blind = consensus_input()
    artifacts = challenge.freeze_benchmark(envelope, author, blind, set())
    manifest = artifacts["arm_a_manifest"]
    results = []
    for case in manifest["cases"]:
        results.append(
            {
                "case_ref": case["case_ref"],
                "execution_status": "completed",
                "identity_answer": "CONSISTENT",
                "identity_probabilities": {"CONSISTENT": 1.0, "INCONSISTENT": 0.0, "INSUFFICIENT_EVIDENCE": 0.0},
                "elapsed_seconds": 0.1,
                "attempt_count": 1,
                "estimated_cost_usd": 0.0,
            }
        )
    document = {
        "schema_version": 1,
        "challenge_id": challenge.CHALLENGE_ID,
        "arm": "A_MINIMAL",
        "manifest_sha256": challenge.digest(manifest),
        "results": results,
    }
    assert len(challenge.validate_arm_results(document, manifest)) == 150
    document["results"][0]["identity_probabilities"]["CONSISTENT"] = 0.8
    with pytest.raises(challenge.ChallengeError, match="distribution"):
        challenge.validate_arm_results(document, manifest)


def test_v11_readiness_uses_30_per_cell_and_diversity_floors():
    envelope, _, _ = consensus_input()
    v11 = {"schema_version": 1, "protocol_id": challenge.AMENDMENT_PROTOCOL_ID, "candidates": envelope["candidates"]}
    candidates = challenge.validate_v11_candidate_pool(v11, set())
    report = challenge.v11_readiness_report(candidates)
    assert report["initial_blind_review_ready"] is True
    queue = challenge.v11_initial_review_queue(candidates)
    assert len(queue["queues"]) == 6
    assert all(len(cell["packets"]) == 30 for cell in queue["queues"])
    assert all("candidate_id" not in packet for cell in queue["queues"] for packet in cell["packets"])


def test_v11_rejects_cell_below_initial_review_size():
    envelope, _, _ = consensus_input()
    retained = [
        candidate
        for candidate in envelope["candidates"]
        if not (candidate["market"] == "PL" and candidate["intended_label"] == "CONSISTENT")
    ]
    retained.extend(candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 1000 + index) for index in range(29))
    v11 = {"schema_version": 1, "protocol_id": challenge.AMENDMENT_PROTOCOL_ID, "candidates": retained}
    with pytest.raises(challenge.ChallengeError, match="needs 30 candidates"):
        challenge.validate_v11_candidate_pool(v11, set())


def test_v11_consensus_selection_uses_diversity_bounds_and_exact_balance():
    envelope, author_document, blind_document = consensus_input()
    candidates = challenge.validate_candidate_pool(envelope, set())
    author = challenge._validate_author_ledger(author_document, candidates)
    blind = challenge._validate_blind_ledger(blind_document, candidates)
    selected = challenge.v11_select_consensus(candidates, author, blind)
    assert len(selected) == 150
    for market in challenge.MARKETS:
        for label in challenge.LABELS:
            cell = [item for item in selected if item["market"] == market and item["intended_label"] == label]
            assert len(cell) == 25
            bounds = challenge.DIVERSITY_BOUNDS_V11[label]
            for stratum in challenge.STRATUM_TARGETS[label]:
                count = sum(item["stratum"] == stratum for item in cell)
                assert bounds["minimum"] <= count <= bounds["maximum"]


def test_persisted_candidate_derived_evidence_is_recomputed_and_verified():
    raw = candidate("PL", "CONSISTENT", "manufacturer_consumer_brand", 2001)
    persisted = challenge.validate_candidate(raw, set())
    assert challenge.validate_candidate(persisted, set())["candidate_id"] == raw["candidate_id"]
    persisted["blind_review_token"] = persisted["blind_review_token"][::-1]
    with pytest.raises(challenge.ChallengeError, match="derived evidence"):
        challenge.validate_candidate(persisted, set())


def test_v11_initial_queue_excludes_duplicate_sku_alternatives():
    envelope, _, _ = consensus_input()
    candidates = challenge.validate_candidate_pool(envelope, set())
    duplicate = dict(candidates[0])
    duplicate["candidate_id"] = "duplicate-sku-alternative"
    duplicate["family_id"] = "different-family"
    duplicate["fingerprints"] = ["different-fingerprint"]
    duplicate["hidden_dossier"] = dict(duplicate["hidden_dossier"])
    duplicate["hidden_dossier"]["verified_skus"] = candidates[0]["hidden_dossier"]["verified_skus"]
    for key in ("hidden_dossier_sha256", "model_visible_payload_sha256", "blind_review_token"):
        del duplicate[key]
    duplicate = challenge.validate_candidate(duplicate, set())
    queue = challenge.v11_initial_review_queue([*candidates, duplicate])
    assert queue["collision_exclusions"]
    all_tokens = {packet["review_token"] for cell in queue["queues"] for packet in cell["packets"]}
    assert not ({candidates[0]["blind_review_token"], duplicate["blind_review_token"]} <= all_tokens)
