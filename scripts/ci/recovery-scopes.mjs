/** Exact reviewed table sets shared by capture and release verification. */
export const CATALOG_TABLES = Object.freeze([
  'allergen_ref','category_ref','concern_tier_ref','country_ref','data_sources',
  'freshness_policies','ingredient_ref','language_ref','nutri_score_ref',
  'nutrition_facts','product_allergen_info','product_field_provenance',
  'product_images','product_ingredient','products',
]);
export const CONSUMER_TABLES = Object.freeze([...CATALOG_TABLES,
  'formula_source_hashes','scoring_model_versions']);
