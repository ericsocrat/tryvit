\set ON_ERROR_STOP on
\set QUIET on
-- C data QA: snapshot canonical projections once, not legacy score assumptions.
-- Session-local only. No catalog/history rows or materialized views are changed.
CREATE TEMP TABLE qa_evidence_products AS
SELECT p.product_id,p.country,evidence_private.product_one(p.product_id,'en') AS model
FROM public.products p WHERE p.is_deprecated IS NOT TRUE;

CREATE FUNCTION pg_temp.qa_field_valid(f jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(jsonb_typeof(f)='object' AND f ?& ARRAY['value','state','unit','basis','preparation_state','qualifier','observation_id']
 AND f->>'state' IN ('recorded','missing','unverified','invalid','conflicting')
 AND f->>'basis' IN ('per_100g','per_100ml','per_serving','unknown')
 AND f->>'preparation_state' IN ('as_sold','prepared','unknown')
 AND f->>'unit' IN ('g','kcal')
 AND (f->>'qualifier' IS NULL OR f->>'qualifier' IN ('eq','lt','lte','gt','gte','approx'))
 AND CASE WHEN f->>'state' IN ('missing','invalid','conflicting') THEN f->'value'='null'::jsonb
          ELSE f->>'value' ~ '^[0-9]+(\.[0-9]+)?$' AND length(f->>'value')<=256 END
 AND CASE WHEN f->>'state'='unverified' THEN f->>'basis'='unknown' AND f->>'observation_id' IS NULL
          WHEN f->>'state'='recorded' THEN f->>'observation_id' IS NOT NULL ELSE true END,false);
$$;

CREATE FUNCTION pg_temp.qa_fields_comparable(model jsonb,names text[],required_basis text DEFAULT 'per_100g')
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT cardinality(names)>0 AND count(*)=cardinality(names) AND COALESCE(bool_and(
   pg_temp.qa_field_valid(f) AND f->>'state'='recorded' AND f->>'qualifier'='eq'
   AND f->>'basis' IN ('per_100g','per_100ml','per_serving')
   AND (required_basis IS NULL OR f->>'basis'=required_basis)
   AND f->>'preparation_state' IN ('as_sold','prepared')
   AND f->>'unit'=CASE WHEN name='calories' THEN 'kcal' ELSE 'g' END),false)
   AND count(DISTINCT f->>'observation_id')=1 AND count(DISTINCT f->>'preparation_state')=1
   AND count(DISTINCT f->>'basis')=1
 FROM unnest(names) name CROSS JOIN LATERAL (SELECT model->'nutrition'->name AS f) field;
$$;

CREATE TEMP VIEW qa_evidence_fields AS
SELECT p.product_id,key AS field,value AS body FROM qa_evidence_products p
CROSS JOIN LATERAL jsonb_each(p.model->'nutrition');
CREATE TEMP VIEW qa_proven_nutrition AS
SELECT product_id,model,
 (model->'nutrition'->'calories'->>'value')::numeric AS calories,
 (model->'nutrition'->'total_fat_g'->>'value')::numeric AS total_fat_g,
 (model->'nutrition'->'saturated_fat_g'->>'value')::numeric AS saturated_fat_g,
 (model->'nutrition'->'trans_fat_g'->>'value')::numeric AS trans_fat_g,
 (model->'nutrition'->'carbs_g'->>'value')::numeric AS carbs_g,
 (model->'nutrition'->'sugars_g'->>'value')::numeric AS sugars_g,
 (model->'nutrition'->'fibre_g'->>'value')::numeric AS fibre_g,
 (model->'nutrition'->'protein_g'->>'value')::numeric AS protein_g,
 (model->'nutrition'->'salt_g'->>'value')::numeric AS salt_g
FROM qa_evidence_products;
CREATE TEMP VIEW qa_score_violations AS
SELECT product_id FROM qa_evidence_products WHERE model IS NULL
 OR model->'score'->>'status' IS DISTINCT FROM 'retired'
 OR model->'score'->'value' IS DISTINCT FROM 'null'::jsonb
 OR model->'score'->>'reason' IS DISTINCT FROM 'unsupported_aggregate';
CREATE TEMP VIEW qa_field_violations AS
SELECT product_id,field FROM qa_evidence_fields WHERE NOT pg_temp.qa_field_valid(body)
 OR body->>'unit' IS DISTINCT FROM CASE WHEN field='calories' THEN 'kcal' ELSE 'g' END;
CREATE TEMP VIEW qa_legacy_missing_violations AS
SELECT f.product_id,f.field FROM qa_evidence_fields f LEFT JOIN public.nutrition_facts nf USING(product_id)
WHERE (to_jsonb(nf)->f.field IS NULL OR to_jsonb(nf)->f.field='null'::jsonb)
 AND f.body->>'observation_id' IS NULL
 AND (f.body->>'state'='unverified' OR f.body->'value' IS DISTINCT FROM 'null'::jsonb);
CREATE TEMP VIEW qa_evidence_count_violations AS
SELECT p.product_id FROM qa_evidence_products p WHERE
 (SELECT count(*) FROM jsonb_object_keys(p.model->'nutrition'))<>9
 OR NOT COALESCE(p.model->'nutrition' ?& ARRAY['calories','total_fat_g','saturated_fat_g','trans_fat_g','carbs_g','sugars_g','fibre_g','protein_g','salt_g'],false)
 OR jsonb_typeof(p.model->'sources') IS DISTINCT FROM 'array'
 OR p.model->'evidence'->>'total_fields' IS DISTINCT FROM '9'
 OR p.model->'evidence'->>'recorded_fields' IS DISTINCT FROM
   (SELECT count(*)::text FROM qa_evidence_fields f WHERE f.product_id=p.product_id AND f.body->>'state'='recorded')
 OR p.model->'evidence'->>'state' IS NULL OR p.model->'evidence'->>'state' NOT IN ('recorded','legacy_unverified','conflicting')
 OR NOT COALESCE(p.model->'evidence'->'reasons' ? 'not_package_verification',false);

CREATE TEMP VIEW qa_source_link_violations AS
SELECT p.product_id FROM qa_evidence_products p
CROSS JOIN LATERAL jsonb_array_elements(p.model->'sources') s
WHERE NOT EXISTS(SELECT 1 FROM public.product_source_observations o
 JOIN public.product_source_records r ON r.id=o.source_record_id
 WHERE o.id::text=s->>'observation_id' AND r.product_id=p.product_id AND o.status='accepted'
 AND r.source_key=s->>'source_key' AND o.source_url=s->>'source_url' AND o.license=s->>'license')
UNION ALL
SELECT f.product_id FROM qa_evidence_fields f WHERE f.body->>'state'='recorded'
 AND NOT EXISTS(SELECT 1 FROM public.product_source_observations o
 JOIN public.product_source_records r ON r.id=o.source_record_id AND r.selected_observation_id=o.id
 CROSS JOIN LATERAL (SELECT CASE f.field WHEN 'calories' THEN 'calories_100g' WHEN 'total_fat_g' THEN 'fat_100g'
  WHEN 'saturated_fat_g' THEN 'saturated_fat_100g' WHEN 'trans_fat_g' THEN 'trans_fat_100g' WHEN 'carbs_g' THEN 'carbs_100g'
  WHEN 'sugars_g' THEN 'sugars_100g' WHEN 'fibre_g' THEN 'fiber_100g' WHEN 'protein_g' THEN 'protein_100g' WHEN 'salt_g' THEN 'salt_100g' END AS key) k
 WHERE o.id::text=f.body->>'observation_id' AND r.product_id=f.product_id AND o.status='accepted'
  AND o.extracted_fields->k.key->>'state'='recorded' AND o.extracted_fields->k.key->>'value'=f.body->>'value'
  AND o.extracted_fields->k.key->>'basis'=f.body->>'basis' AND o.extracted_fields->k.key->>'unit'=f.body->>'unit'
  AND o.extracted_fields->k.key->>'qualifier' IS NOT DISTINCT FROM (f.body->>'qualifier')
  AND o.extracted_fields->k.key->>'preparation_state'=f.body->>'preparation_state');

CREATE TEMP VIEW qa_classification_violations AS
SELECT p.product_id,k.key FROM qa_evidence_products p
CROSS JOIN LATERAL (VALUES ('nova','nova_classification','^[1-4]$'),('nutri_score','nutri_score_label','^[A-E]$')) k(key,source_field,pattern)
CROSS JOIN LATERAL (SELECT p.model->'classifications'->k.key AS c) c
WHERE c.c IS NULL OR NOT(c.c ?& ARRAY['value','source'])
 OR CASE WHEN c.c->>'value' IS NULL THEN c.c->>'source' IS NOT NULL
 ELSE c.c->>'value' !~ k.pattern OR NOT EXISTS(SELECT 1 FROM public.product_source_records r
  JOIN public.product_source_observations o ON o.id=r.selected_observation_id
  WHERE r.product_id=p.product_id AND o.status='accepted' AND r.source_key=c.c->>'source'
   AND o.extracted_fields->k.source_field->>'state'='recorded'
   AND upper(o.extracted_fields->k.source_field->>'value')=c.c->>'value') END;
\set QUIET off
