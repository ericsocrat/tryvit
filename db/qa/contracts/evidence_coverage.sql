-- Informational only: observations of coverage and screening heuristics do not
-- create verified products, impose minimum populations or certify nutrition.
SELECT jsonb_build_object('scope','informational_no_population_requirement',
 'activeProducts',(SELECT count(*) FROM qa_evidence_products),
 'legacyVerifiedLabels',(SELECT count(*) FROM public.products WHERE is_deprecated IS NOT TRUE AND confidence='verified'),
 'legacyHighConfidenceRows',(SELECT count(*) FROM public.v_product_confidence WHERE confidence_band='high'),
 'legacyConfidenceBands',(SELECT count(DISTINCT confidence_band) FROM public.v_product_confidence),
 'unknownBasisFields',(SELECT count(*) FROM qa_evidence_fields WHERE body->>'basis'='unknown'),
 'recordedFields',(SELECT count(*) FROM qa_evidence_fields WHERE body->>'state'='recorded'),
 'missingFields',(SELECT count(*) FROM qa_evidence_fields WHERE body->>'state'='missing'),
 'comparablePer100gEnergy',(SELECT count(*) FROM qa_evidence_products WHERE pg_temp.qa_fields_comparable(model,ARRAY['calories'])),
 'categoriesBelowFiveProducts',(SELECT count(*) FROM (SELECT category FROM public.products WHERE is_deprecated IS NOT TRUE GROUP BY category HAVING count(*)<5) q),
 'productsWithoutIngredientRows',(SELECT count(*) FROM public.products p WHERE p.is_deprecated IS NOT TRUE AND NOT EXISTS(SELECT 1 FROM public.product_ingredient i WHERE i.product_id=p.product_id)),
 'fuzzyBrandVariantGroups',(SELECT count(*) FROM (SELECT normalize_brand(brand) FROM public.products WHERE is_deprecated IS NOT TRUE AND brand IS NOT NULL GROUP BY normalize_brand(brand) HAVING count(DISTINCT brand)>1) variants),
 'historicalNutritionScreening',jsonb_build_object(
 'energyApproximationOutliers',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories','protein_g','carbs_g','total_fat_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.calories IS NOT NULL AND nf.calories::numeric > 50
  AND nf.protein_g IS NOT NULL AND nf.carbs_g IS NOT NULL AND nf.total_fat_g IS NOT NULL
  AND p.category NOT IN ('Alcohol', 'Drinks', 'Condiments', 'Sauces')
  AND ABS(
      nf.calories::numeric
      - (nf.protein_g::numeric * 4 + nf.carbs_g::numeric * 4 + nf.total_fat_g::numeric * 9)
  ) > nf.calories::numeric * 0.20),
 'highProteinHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['protein_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.protein_g::numeric >= 50
  AND p.category NOT IN ('Nuts, Seeds & Legumes', 'Seafood & Fish', 'Meat')
  AND p.product_name NOT ILIKE '%protein%'
  AND p.product_name NOT ILIKE '%whey%'),
 'highSaltHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['salt_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.salt_g IS NOT NULL
  AND nf.salt_g::numeric >= 30),
 'highSugarHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['sugars_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.sugars_g IS NOT NULL
  AND nf.sugars_g::numeric >= 80
  AND p.category NOT IN ('Sweets', 'Drinks', 'Condiments', 'Sauces', 'Baby')
  AND p.product_name NOT ILIKE '%cukier%'
  AND p.product_name NOT ILIKE '%sugar%'
  AND p.product_name NOT ILIKE '%sirup%'
  AND p.product_name NOT ILIKE '%syrup%'
  AND p.product_name NOT ILIKE '%honey%'
  AND p.product_name NOT ILIKE '%miod%'),
 'possibleEnergyUnitHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p  ON p.product_id  = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories','protein_g','carbs_g','total_fat_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.calories IS NOT NULL AND nf.calories::numeric > 400
  AND nf.protein_g IS NOT NULL AND nf.carbs_g IS NOT NULL AND nf.total_fat_g IS NOT NULL
  AND (nf.protein_g::numeric * 4 + nf.carbs_g::numeric * 4 + nf.total_fat_g::numeric * 9) > 20
  AND ABS(
      nf.calories::numeric
      - (nf.protein_g::numeric * 4 + nf.carbs_g::numeric * 4 + nf.total_fat_g::numeric * 9) * 4.184
  ) < (nf.protein_g::numeric * 4 + nf.carbs_g::numeric * 4 + nf.total_fat_g::numeric * 9) * 4.184 * 0.15),
 'categorySaltHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p ON p.product_id = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['salt_g']) AND p.is_deprecated IS NOT TRUE
  AND nf.salt_g IS NOT NULL
  AND nf.salt_g::numeric > 10
  AND p.category NOT IN ('Sauces', 'Condiments', 'Seafood & Fish', 'Instant & Frozen', 'Spreads & Dips', 'Spices & Seasonings')),
 'categoryEnergyHeuristic',(SELECT COUNT(*)
FROM qa_proven_nutrition nf
JOIN products p ON p.product_id = nf.product_id
WHERE pg_temp.qa_fields_comparable(nf.model,ARRAY['calories']) AND p.is_deprecated IS NOT TRUE
  AND nf.calories IS NOT NULL
  AND nf.calories::numeric > 700
  AND p.category NOT IN (
    'Nuts, Seeds & Legumes',
    'Plant-Based & Alternatives',
    'Condiments',
    'Dairy',
    'Oils & Vinegars',
    'Baby'  -- ghee/clarified butter is correct at ~900 kcal
  ))));
