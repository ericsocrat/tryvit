"""Plan only: retained source bytes plus separately captured public DB metadata."""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from pipeline import evidence_cohort as cohort
from pipeline.categories import CATEGORY_POLICY_VERSION, resolve_category
from pipeline.observations import EXTRACTOR_VERSION, seal_observation
from pipeline.sql_generator import _sql_text

ROOT = Path(__file__).resolve().parents[2]

RUN = cohort.REPORT_ROOT / "run-20260905T101700Z"
PLAN = cohort.REPORT_ROOT / "production-import-plan-20260908"


def retained():
    proof = cohort.verify_saved_run(RUN)
    receipt = json.loads((RUN / "receipt.json").read_text(encoding="utf-8"))
    records = []
    for member in receipt["members"]:
        record = json.loads(
            cohort._artifact_path(RUN, member["observation_file"], must_exist=True).read_text(encoding="utf-8")
        )
        records.append((member, record))
    return proof, records


def prepare():
    proof, records = retained()
    request = [
        {
            "product_id": m["product_id"],
            "country": m["country"],
            "ean": m["ean"],
            "source_brand": o["identity"]["brand"],
            "source_name": o["identity"]["product_name"],
        }
        for m, o in records
    ]
    request_sql = _sql_text(json.dumps(request, ensure_ascii=False))
    query = f"""WITH cohort AS (SELECT * FROM jsonb_to_recordset({request_sql}::jsonb)
      AS c(product_id bigint,country text,ean text,source_brand text,source_name text))
    SELECT jsonb_build_object('checked_at',now(),'total_products',(SELECT count(*) FROM public.products),
      'active_products',(SELECT count(*) FROM public.products WHERE is_deprecated IS NOT TRUE),
      'batch_count',(SELECT count(*)
          FROM public.ingestion_batches),
          'observation_count',(SELECT count(*)
          FROM public.product_source_observations),
      'members',(SELECT jsonb_agg(jsonb_build_object('product_id',c.product_id,
        'product',(SELECT jsonb_build_object('product_id',p.product_id,'country',p.country,'ean',p.ean,'brand',p.brand,
          'product_name',p.product_name,
          'category',p.category,
          'is_deprecated',p.is_deprecated,
          'source_type',p.source_type,
          'source_url',p.source_url,
          'source_ean',p.source_ean,
          'last_fetched_at',p.last_fetched_at,
          'off_revision',p.off_revision,
          'updated_at',p.updated_at)
          FROM public.products p WHERE p.product_id=c.product_id),
        'market_ean_ids',(SELECT COALESCE(jsonb_agg(p.product_id ORDER BY p.product_id),
          '[]'::jsonb)
          FROM public.products p WHERE p.country=c.country
          AND p.ean=c.ean),
        'source_name_ids',(SELECT COALESCE(jsonb_agg(p.product_id ORDER BY p.product_id),
          '[]'::jsonb)
          FROM public.products p WHERE p.country=c.country

          AND lower(btrim(p.brand))=lower(btrim(c.source_brand))
          AND lower(btrim(p.product_name))=lower(btrim(c.source_name))
          AND p.is_deprecated IS NOT TRUE),
        'other_market_ids',(SELECT COALESCE(jsonb_agg(p.product_id ORDER BY p.product_id),
          '[]'::jsonb)
          FROM public.products p WHERE p.country<>c.country
          AND p.ean=c.ean),
        'provenance',(SELECT COALESCE(jsonb_agg(jsonb_build_object('field',p.field_name,'source',p.source_type,
          'has_verification',p.verified_by IS NOT NULL
          OR p.verified_at IS NOT NULL)),
          '[]'::jsonb)
          FROM public.product_field_provenance p WHERE p.product_id=c.product_id),
        'provenance_sha256',(SELECT encode(sha256(convert_to(
          COALESCE(string_agg(to_jsonb(p)::text,E'\\n' ORDER BY p.field_name),
          ''),
          'UTF8')),
          'hex')
          FROM public.product_field_provenance p WHERE p.product_id=c.product_id),
        'source_mapping',(SELECT jsonb_build_object('product_id',s.product_id,
          'selected_observation_id',s.selected_observation_id,
          'retrieved_at',o.retrieved_at,
          'source_updated_at',o.source_updated_at,
          'source_revision',o.source_revision,
          'payload_hash',o.payload_hash)

          FROM public.product_source_records s LEFT
          JOIN public.product_source_observations o ON o.id=s.selected_observation_id
          WHERE s.source_key='off_api' AND s.external_id=c.ean AND s.country=c.country),
        'nutrition',(SELECT jsonb_build_object('calories_100g',n.calories::text,'fat_100g',n.total_fat_g::text,
          'saturated_fat_100g',n.saturated_fat_g::text,
          'trans_fat_100g',n.trans_fat_g::text,
          'carbs_100g',n.carbs_g::text,
          'sugars_100g',n.sugars_g::text,
          'fiber_100g',n.fibre_g::text,
          'protein_100g',n.protein_g::text,
          'salt_100g',n.salt_g::text)

          FROM public.nutrition_facts n WHERE n.product_id=c.product_id))
          ORDER BY c.product_id) FROM cohort c)) AS state;"""
    PLAN.mkdir(parents=True, exist_ok=True)
    (PLAN / "production-query.sql").write_text(query, encoding="utf-8")
    print(
        json.dumps({"retained": proof, "query_artifact": str(PLAN / "production-query.sql"), "network_refetch": False})
    )


def report():
    proof, records = retained()
    state = json.loads((PLAN / "production-state.json").read_text(encoding="utf-8"))
    production = {m["product_id"]: m for m in state["members"]}
    rows = []
    for member, observation in records:
        db = production[member["product_id"]]
        product = db["product"]
        category = observation["extracted_fields"]["category"]
        resolved = resolve_category(observation["sanitized_payload"].get("categories_tags", []))
        reasons = []
        if product is None or db["market_ean_ids"] != [member["product_id"]]:
            reasons.append("frozen_market_id_not_unique_current_identity")
        if db["source_name_ids"] not in ([], [member["product_id"]]):
            reasons.append("source_name_maps_to_other_id")
        if product:
            if product["is_deprecated"]:
                reasons.append("explicitly_deprecated")
            if (product["country"], product["ean"]) != (member["country"], member["ean"]):
                reasons.append("frozen_identity_changed")
            if any(
                (product[k] or "").strip().lower() != (observation["identity"][k] or "").strip().lower()
                for k in ("brand", "product_name")
            ):
                reasons.append("identity_text_change_requires_review")
            if product["last_fetched_at"] and datetime.fromisoformat(
                product["last_fetched_at"].replace("Z", "+00:00")
            ) > datetime.fromisoformat(observation["retrieved_at"].replace("Z", "+00:00")):
                reasons.append("existing_projection_fetched_later")
            if (
                product["off_revision"]
                and observation["source_revision"]
                and product["off_revision"] > observation["source_revision"]
            ):
                reasons.append("existing_projection_revision_newer")
        if resolved != member["category"] or category.get("value") != member["category"]:
            reasons.append("category_requires_policy_review")
        if resolved != category.get("value"):
            reasons.append("retained_category_differs_from_policy_v1_1")
        if observation.get("validation_findings"):
            reasons.append("retained_validation_findings")
        if any(p["source"] != "off_api" and p["field"] in observation["extracted_fields"] for p in db["provenance"]):
            reasons.append("independent_provenance_conflict")
        if any(p["has_verification"] for p in db["provenance"]):
            reasons.append("existing_verification_requires_preservation")
        if db["source_mapping"]:
            reasons.append("existing_source_mapping_requires_order_review")
        changes = []
        for field, value in observation["extracted_fields"].items():
            if field in (db["nutrition"] or {}):
                after = (
                    value.get("value") if value.get("state") == "recorded" and value.get("qualifier") == "eq" else None
                )
                changes.append(
                    {
                        "field": field,
                        "before": db["nutrition"][field],
                        "projected_after": after,
                        "basis": value.get("basis"),
                        "qualifier": value.get("qualifier"),
                        "state": value.get("state"),
                    }
                )
        rows.append(
            {
                "product_id": member["product_id"],
                "country": member["country"],
                "category": member["category"],
                "ean": member["ean"],
                "eligible_unchanged_retained_record": not reasons,
                "hold_reasons": reasons,
                "retained_category": category.get("value"),
                "current_policy_category": resolved,
                "retained_policy": category.get("policy_version"),
                "retrieved_at": observation["retrieved_at"],
                "source_updated_at": observation["source_updated_at"],
                "payload_hash": observation["payload_hash"],
                "record_sha256": member["observation_sha256"],
                "before_product": product,
                "source_mapping": db["source_mapping"],
                "other_market_ids": db["other_market_ids"],
                "market_ean_ids": db["market_ean_ids"],
                "source_name_ids": db["source_name_ids"],
                "provenance": db["provenance"],
                "provenance_sha256": db["provenance_sha256"],
                "nutrient_projection": changes,
            }
        )
    eligible = sorted((r for r in rows if r["eligible_unchanged_retained_record"]), key=lambda r: r["product_id"])
    result = {
        "method": "retained-observation-import-plan-no-refetch-no-apply",
        "created_at": datetime.now(UTC).isoformat(),
        "production_checked_at": state["checked_at"],
        "cohort": proof,
        "category_policy": CATEGORY_POLICY_VERSION,
        "production_counts": {
            k: state[k] for k in ("total_products", "active_products", "batch_count", "observation_count")
        },
        "eligible_count": len(eligible),
        "smallest_candidate_id": eligible[0]["product_id"] if eligible else None,
        "hold_counts": dict(Counter(reason for r in rows for reason in r["hold_reasons"])),
        "members": rows,
    }
    path = PLAN / "plan.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                k: result[k]
                for k in (
                    "cohort",
                    "category_policy",
                    "production_counts",
                    "eligible_count",
                    "smallest_candidate_id",
                    "hold_counts",
                )
            },
            ensure_ascii=False,
        )
    )
    print(json.dumps({"plan_artifact": str(path)}))


def pilot():
    proof, records = retained()
    plan = json.loads((PLAN / "plan.json").read_text(encoding="utf-8"))
    candidates = sorted(
        (r for r in plan["members"] if r["eligible_unchanged_retained_record"]), key=lambda r: r["product_id"]
    )
    if not candidates:
        raise ValueError("No unchanged retained candidate is eligible")
    selected = candidates[0]
    member, original = next((m, o) for m, o in records if m["product_id"] == selected["product_id"])
    record = seal_observation(original)
    if record["payload_hash"] != original["payload_hash"]:
        raise ValueError("Current sealing would alter retained evidence")
    digest = hashlib.sha256(json.dumps([record], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    batch = {
        "source_key": "off_api",
        "country": member["country"],
        "extractor_version": EXTRACTOR_VERSION,
        "idempotency_key": f"{member['country']}:{digest}",
        "scope": {"category": member["category"], "kind": "partial_upsert"},
    }
    record_sql = _sql_text(json.dumps(record, ensure_ascii=False)) + "::jsonb"
    batch_sql = _sql_text(json.dumps(batch, ensure_ascii=False)) + "::jsonb"
    before = selected["before_product"]
    product_expr = "jsonb_build_object(" + ",".join(_sql_text(k) + ",p." + k for k in before) + ")"
    nutrition = {r["field"]: r["before"] for r in selected["nutrient_projection"]}
    columns = {
        "calories_100g": "calories",
        "fat_100g": "total_fat_g",
        "saturated_fat_100g": "saturated_fat_g",
        "trans_fat_100g": "trans_fat_g",
        "carbs_100g": "carbs_g",
        "sugars_100g": "sugars_g",
        "fiber_100g": "fibre_g",
        "protein_100g": "protein_g",
        "salt_100g": "salt_g",
    }
    nutrient_expr = (
        "jsonb_build_object(" + ",".join(_sql_text(k) + ",n." + v + "::text" for k, v in columns.items()) + ")"
    )
    tag = "$retained_pilot$"
    while tag in record_sql or tag in batch_sql:
        tag = tag[:-1] + "x$"
    sql = f"""-- PROPOSED MUTATION, not a dry-run. Requires reviewed 21-table recovery and operator authorization.
-- No OFF refetch. Retained cohort SHA256: {proof["cohort_sha256"]}
-- Retained observation SHA256: {member["observation_sha256"]}
-- Retrieved: {record["retrieved_at"]}; source last modified: {record["source_updated_at"]}.
-- This is NOT a migration, staging-first attestation, or production execution receipt.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO {tag}
DECLARE result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended({_sql_text(member["country"] + ":" + member["ean"])},0));
  PERFORM 1 FROM public.products WHERE product_id={member["product_id"]} FOR UPDATE;
  IF (SELECT {product_expr} FROM public.products p WHERE p.product_id={member["product_id"]})
     IS DISTINCT FROM {_sql_text(json.dumps(before, ensure_ascii=False))}::jsonb THEN
    RAISE EXCEPTION 'pilot_product_before_image_changed';
  END IF;
  IF (SELECT {nutrient_expr} FROM public.nutrition_facts n WHERE n.product_id={member["product_id"]})
     IS DISTINCT FROM {_sql_text(json.dumps(nutrition, ensure_ascii=False))}::jsonb THEN
    RAISE EXCEPTION 'pilot_nutrition_before_image_changed';
  END IF;
  IF (SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(p)::text,E'\\n' ORDER BY p.field_name),
          ''),
          'UTF8')),
          'hex')
      FROM public.product_field_provenance p WHERE p.product_id={member["product_id"]})
     IS DISTINCT FROM {_sql_text(selected["provenance_sha256"])} THEN
    RAISE EXCEPTION 'pilot_provenance_before_image_changed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.product_source_records WHERE source_key='off_api'
    AND country={_sql_text(member["country"])} AND external_id={_sql_text(member["ean"])}) THEN
    RAISE EXCEPTION 'pilot_source_mapping_changed';
  END IF;
  result := public.ingestion_apply_observation({batch_sql},{record_sql});
  IF result->>'status' IS DISTINCT FROM 'accepted'
          OR (result->>'product_id')::bigint IS DISTINCT FROM {member["product_id"]} THEN
    RAISE EXCEPTION 'pilot_did_not_accept_exact_existing_product';
  END IF;
  IF NOT EXISTS(SELECT 1
          FROM public.product_source_records s
          JOIN public.product_source_observations o ON o.id=s.selected_observation_id
    WHERE s.source_key='off_api'
          AND s.country={_sql_text(member["country"])}
          AND s.external_id={_sql_text(member["ean"])}
    AND s.product_id={member["product_id"]} AND o.payload_hash={_sql_text(record["payload_hash"])}
    AND o.retrieved_at={_sql_text(record["retrieved_at"])}::timestamptz) THEN
    RAISE EXCEPTION 'pilot_selected_evidence_mismatch';
  END IF;
END {tag};
COMMIT;
"""
    path = PLAN / f"pilot-{member['product_id']}.sql"
    path.write_text(sql, encoding="utf-8")
    print(
        json.dumps(
            {
                "sql_artifact": str(path),
                "sha256": hashlib.sha256(sql.encode()).hexdigest(),
                "product_id": member["product_id"],
                "country": member["country"],
                "record_unchanged": True,
                "executed": False,
                "recovery_19_tables": "REQUIRED_NOT_YET_PROVEN",
            }
        )
    )


if __name__ == "__main__":
    if sys.argv[1:] == ["prepare"]:
        prepare()
    elif sys.argv[1:] == ["report"]:
        report()
    elif sys.argv[1:] == ["pilot"]:
        pilot()
    else:
        raise SystemExit("Use prepare or report; this tool cannot import or fetch OFF")
