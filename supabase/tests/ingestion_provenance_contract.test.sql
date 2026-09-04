-- pgTAP: ingestion provenance vocabulary and bounded completeness.

BEGIN;
SELECT plan(15);

SELECT has_function(
  'public',
  'field_to_group',
  ARRAY['text'],
  'field_to_group(text) exists'
);

SELECT is(public.field_to_group('calories_100g'), 'nutrition',
  'canonical calories map to nutrition freshness');
SELECT is(public.field_to_group('total_fat_g'), 'nutrition',
  'physical nutrition names remain compatible');
SELECT is(public.field_to_group('allergens'), 'allergens',
  'canonical allergen evidence maps to allergen freshness');
SELECT is(public.field_to_group('ingredients_text'), 'ingredients',
  'canonical ingredient evidence maps to ingredient freshness');
SELECT is(public.field_to_group('prep_method'), 'ingredients',
  'processing evidence maps to ingredient freshness');
SELECT is(public.field_to_group('store_availability'), 'identity',
  'store availability maps to identity freshness');
SELECT is(public.field_to_group('image_nutrition_url'), 'images',
  'nutrition images map to image freshness');
SELECT is(public.field_to_group('score_model_version'), 'scoring',
  'derived score model version maps to scoring freshness');

INSERT INTO public.category_ref (
  category, slug, display_name, sort_order, is_active
)
VALUES (
  'pgtap-ingestion-provenance',
  'pgtap-ingestion-provenance',
  'pgTAP Ingestion Provenance',
  999,
  true
)
ON CONFLICT (category) DO UPDATE
SET slug = EXCLUDED.slug;

INSERT INTO public.products (
  product_id, ean, product_name, brand, category, country,
  unhealthiness_score, nutri_score_label, nova_classification
)
VALUES (
  999966, '5909876543213', 'Ingestion Provenance Fixture', 'Test Brand',
  'pgtap-ingestion-provenance', 'PL', 40, 'B', '2'
)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.product_field_provenance (
  product_id, field_name, source_type, confidence, recorded_at
)
SELECT
  999966,
  field_name,
  'off_api',
  0.60,
  now()
FROM unnest(ARRAY[
  'product_name', 'brand', 'ean', 'category',
  'calories_100g', 'fat_100g', 'saturated_fat_100g',
  'trans_fat_100g', 'carbs_100g', 'sugars_100g',
  'fiber_100g', 'protein_100g', 'salt_100g',
  'ingredients_text', 'allergens', 'nova_classification'
]) AS fields(field_name)
ON CONFLICT (product_id, field_name) DO UPDATE
SET source_type = EXCLUDED.source_type,
    confidence = EXCLUDED.confidence,
    recorded_at = EXCLUDED.recorded_at;

INSERT INTO public.product_field_provenance (
  product_id, field_name, source_type, confidence, recorded_at
)
VALUES (999966, 'score_model_version', 'derived_calculation', 0.70, now())
ON CONFLICT (product_id, field_name) DO UPDATE
SET source_type = EXCLUDED.source_type,
    confidence = EXCLUDED.confidence,
    recorded_at = EXCLUDED.recorded_at;

SELECT has_function(
  'public',
  'compute_provenance_confidence',
  ARRAY['bigint'],
  'compute_provenance_confidence(bigint) exists'
);

SELECT is(
  (
    SELECT data_completeness
    FROM public.compute_provenance_confidence(999966)
  ),
  100::numeric,
  'provenance completeness is capped at 100 percent'
);

SELECT is(
  (
    SELECT overall_confidence
    FROM public.compute_provenance_confidence(999966)
  ),
  0.600::numeric,
  'derived outputs do not inflate overall source confidence'
);

SELECT is(
  (
    SELECT source_diversity
    FROM public.compute_provenance_confidence(999966)
  ),
  1,
  'derived calculations do not count as an independent source'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.compute_provenance_confidence(bigint)',
    'EXECUTE'
  ),
  'service role retains provenance confidence access'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.compute_provenance_confidence(bigint)',
    'EXECUTE'
  ),
  'anonymous callers remain denied provenance confidence access'
);

SELECT * FROM finish();
ROLLBACK;
