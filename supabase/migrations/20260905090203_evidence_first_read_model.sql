-- Migration: Evidence-first v2 read contract. No rescore or historical data rewrite.
-- Rollback: retain additive APIs/tables; roll back only to a compatible reader.
BEGIN;

-- Restore the service-only diagnostic boundary accidentally broadened by
-- 20260904172653. Owner-executed public wrappers retain their existing access.
REVOKE ALL ON FUNCTION public.compute_provenance_confidence(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compute_provenance_confidence(bigint) TO service_role;

CREATE SCHEMA IF NOT EXISTS evidence_private;
REVOKE ALL ON SCHEMA evidence_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA evidence_private TO authenticated, service_role;

-- Alias normalization only; raw source tags remain immutable. Unknown tags
-- remain visible, never converted to an absence declaration.
CREATE OR REPLACE FUNCTION evidence_private.allergen_key(p_tag text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE regexp_replace(lower(btrim(p_tag)),'^en:','')
    WHEN 'none' THEN NULL
    WHEN '' THEN NULL
    WHEN 'nuts' THEN 'tree-nuts'
    WHEN 'sesame-seeds' THEN 'sesame'
    WHEN 'sulphur-dioxide-and-sulphites' THEN 'sulphites'
    WHEN 'lupine' THEN 'lupin'
    ELSE regexp_replace(lower(btrim(p_tag)),'^en:','') END;
$$;
REVOKE ALL ON FUNCTION evidence_private.allergen_key(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.allergen_key(text) TO service_role;

-- Internal projection. Only the guarded batch routine below is client-callable.
CREATE OR REPLACE FUNCTION evidence_private.product_one(p_id bigint, p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  p public.products%ROWTYPE;
  n public.nutrition_facts%ROWTYPE;
  f record;
  v_source jsonb;
  v_fields jsonb := '{}'::jsonb;
  v_field jsonb;
  v_state text;
  v_value text;
  v_id uuid;
  v_sources jsonb;
  v_ingredients jsonb;
  v_contains jsonb;
  v_traces jsonb;
  v_recorded integer := 0;
  v_image jsonb;
  v_grade text;
  v_grade_version text;
  v_grade_source text;
  v_nova text;
  v_nova_source text;
  v_has_conflict boolean;
  v_field_conflict boolean := false;
BEGIN
  SELECT * INTO p FROM public.products WHERE product_id=p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO n FROM public.nutrition_facts WHERE product_id=p_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'observation_id',o.id,'source_key',r.source_key,'source_url',o.source_url,
    'license',o.license,'retrieved_at',o.retrieved_at,'source_updated_at',o.source_updated_at
  ) ORDER BY r.source_key,r.id),'[]'::jsonb) INTO v_sources
  FROM public.product_source_records r JOIN public.product_source_observations o
    ON o.source_record_id=r.id
  WHERE r.product_id=p_id AND o.status='accepted' AND (
    o.id=r.selected_observation_id OR EXISTS(SELECT 1 FROM public.product_source_assertions a WHERE a.source_record_id=r.id AND a.observation_id=o.id)
    OR EXISTS(SELECT 1 FROM public.product_field_provenance fp WHERE fp.product_id=p_id AND fp.observation_id=o.id));

  FOR f IN SELECT * FROM (VALUES
    ('calories','calories_100g',n.calories,'kcal'),
    ('total_fat_g','fat_100g',n.total_fat_g,'g'),
    ('saturated_fat_g','saturated_fat_100g',n.saturated_fat_g,'g'),
    ('trans_fat_g','trans_fat_100g',n.trans_fat_g,'g'),
    ('carbs_g','carbs_100g',n.carbs_g,'g'),
    ('sugars_g','sugars_100g',n.sugars_g,'g'),
    ('fibre_g','fiber_100g',n.fibre_g,'g'),
    ('protein_g','protein_100g',n.protein_g,'g'),
    ('salt_g','salt_100g',n.salt_g,'g')
  ) AS fields(key,source_field,legacy_value,unit) LOOP
    v_id := NULL; v_field := NULL;
    SELECT o.id,o.extracted_fields->f.source_field INTO v_id,v_field
    FROM public.product_field_provenance fp
    JOIN public.product_source_observations o ON o.id=fp.observation_id
    JOIN public.product_source_records r ON r.id=o.source_record_id
      AND r.selected_observation_id=o.id AND r.product_id=fp.product_id
    WHERE fp.product_id=p_id AND fp.field_name=f.source_field AND o.status='accepted'
      AND fp.source_type=r.source_key
      AND fp.evidence_state=o.extracted_fields->f.source_field->>'state'
      AND fp.basis=o.extracted_fields->f.source_field->>'basis'
      AND fp.unit=o.extracted_fields->f.source_field->>'unit'
      AND fp.qualifier IS NOT DISTINCT FROM (o.extracted_fields->f.source_field->>'qualifier')
      AND fp.preparation_state=o.extracted_fields->f.source_field->>'preparation_state';
    IF v_id IS NOT NULL AND v_field IS NOT NULL THEN
      v_state := COALESCE(v_field->>'state','missing');
      v_value := CASE WHEN v_state='recorded' THEN v_field->>'value' ELSE NULL END;
      IF v_state='recorded' AND (v_value IS NULL OR v_value !~ '^[0-9]+(\.[0-9]+)?$' OR length(v_value)>256) THEN
        v_state := 'invalid'; v_value := NULL;
      END IF;
      IF v_state='recorded' THEN v_recorded := v_recorded+1; END IF;
      v_field := jsonb_build_object('value',v_value,'unit',COALESCE(v_field->>'unit',f.unit),
        'basis',COALESCE(v_field->>'basis','unknown'),'preparation_state',COALESCE(v_field->>'preparation_state','unknown'),
        'state',v_state,'qualifier',v_field->>'qualifier','observation_id',v_id);
    ELSIF EXISTS(SELECT 1 FROM public.product_field_provenance fp
      WHERE fp.product_id=p_id AND fp.field_name=f.source_field AND fp.observation_id IS NOT NULL) THEN
      -- An older provenance writer can change source_type while retaining the
      -- observation pointer. Never publish the former source as current proof.
      v_field_conflict := true;
      v_field := jsonb_build_object('value',NULL,'unit',f.unit,'basis','unknown',
        'preparation_state','unknown','state','conflicting','qualifier',NULL,'observation_id',NULL);
    ELSE
      -- Legacy numbers remain inspectable, but neither their basis nor source
      -- verification is manufactured during schema migration.
      v_field := jsonb_build_object('value',f.legacy_value::text,'unit',f.unit,
        'basis','unknown','preparation_state','unknown',
        'state',CASE WHEN f.legacy_value IS NULL THEN 'missing' ELSE 'unverified' END,
        'qualifier',NULL,'observation_id',NULL);
    END IF;
    v_fields := v_fields || jsonb_build_object(f.key,v_field);
  END LOOP;

  -- Preserve independent and legacy positive assertions, marking their origin.
  -- A legacy junction has no source ownership and cannot be silently deleted.
  WITH assertions AS (
    SELECT COALESCE(NULLIF(a.assertion->>'text',''),NULLIF(a.assertion->>'id','')) AS name,
      CASE WHEN r.selected_observation_id=a.observation_id THEN 'recorded' ELSE 'unverified' END AS state,a.observation_id
    FROM public.product_source_assertions a JOIN public.product_source_records r
      ON r.id=a.source_record_id
    WHERE r.product_id=p_id AND a.kind='ingredient'
    UNION ALL
    SELECT ir.name_en,'unverified',NULL::uuid
    FROM public.product_ingredient pi JOIN public.ingredient_ref ir USING(ingredient_id)
    WHERE pi.product_id=p_id
  ), selected AS (
    SELECT DISTINCT ON (lower(name)) name,state,observation_id
    FROM assertions WHERE NULLIF(btrim(name),'') IS NOT NULL
    ORDER BY lower(name),CASE WHEN state='recorded' THEN 0 ELSE 1 END,observation_id
  ) SELECT COALESCE(jsonb_agg(jsonb_build_object('name',name,'state',state,'observation_id',observation_id)
    ORDER BY name),'[]'::jsonb) INTO v_ingredients FROM selected;

  WITH assertions AS (
    SELECT evidence_private.allergen_key(a.assertion->>'tag') AS name,a.kind,
      CASE WHEN r.selected_observation_id=a.observation_id THEN 'recorded' ELSE 'unverified' END AS state,a.observation_id
    FROM public.product_source_assertions a JOIN public.product_source_records r
      ON r.id=a.source_record_id
    WHERE r.product_id=p_id AND a.kind IN ('contains','traces')
    UNION ALL
    SELECT evidence_private.allergen_key(ai.tag),CASE WHEN ai.type='contains' THEN 'contains' ELSE 'traces' END,
      'unverified',NULL::uuid FROM public.product_allergen_info ai WHERE ai.product_id=p_id
  ), selected AS (
    SELECT DISTINCT ON (kind,lower(name)) name,kind,state,observation_id
    FROM assertions WHERE NULLIF(btrim(name),'') IS NOT NULL
    ORDER BY kind,lower(name),CASE WHEN state='recorded' THEN 0 ELSE 1 END,observation_id
  ) SELECT
    COALESCE(jsonb_agg(jsonb_build_object('name',name,'state',state,'observation_id',observation_id)
      ORDER BY name) FILTER(WHERE kind='contains'),'[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('name',name,'state',state,'observation_id',observation_id)
      ORDER BY name) FILTER(WHERE kind='traces'),'[]'::jsonb)
    INTO v_contains,v_traces FROM selected;

  SELECT jsonb_build_object('url',i.url,'source',CASE WHEN i.source='off_api' THEN 'Open Food Facts · CC BY-SA' ELSE i.source END,'alt',COALESCE(i.alt_text,p.product_name)) INTO v_image
  FROM public.product_images i WHERE i.product_id=p_id
    AND i.url ~ '^https://(images\.openfoodfacts\.org/|[a-z0-9]+\.supabase\.co/storage/v1/object/public/)'
  ORDER BY i.is_primary DESC,i.image_id LIMIT 1;
  IF v_image IS NULL THEN
    -- New immutable observations already retain the source's front-image
    -- pointer. Do not require a second, lossy image import to expose it.
    SELECT jsonb_build_object('url',o.sanitized_payload->>'image_front_url',
      'source','Open Food Facts · CC BY-SA','alt',p.product_name) INTO v_image
    FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
    WHERE r.product_id=p_id AND o.status='accepted'
      AND o.sanitized_payload->>'image_front_url' ~ '^https://images\.openfoodfacts\.org/[^?#[:space:]]+$'
    ORDER BY o.retrieved_at DESC,o.id LIMIT 1;
  END IF;

  SELECT upper(o.extracted_fields->'nutri_score_label'->>'value'),
    o.extracted_fields->'nutri_score_label'->>'version',r.source_key
  INTO v_grade,v_grade_version,v_grade_source
  FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
  WHERE r.product_id=p_id AND o.status='accepted'
    AND o.extracted_fields->'nutri_score_label'->>'state'='recorded'
  ORDER BY o.retrieved_at DESC,o.id LIMIT 1;
  IF v_grade IS NULL OR v_grade !~ '^[A-E]$' THEN v_grade:=NULL; v_grade_source:=NULL; v_grade_version:=NULL; END IF;
  SELECT o.extracted_fields->'nova_classification'->>'value',r.source_key INTO v_nova,v_nova_source
  FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
  WHERE r.product_id=p_id AND o.status='accepted'
    AND o.extracted_fields->'nova_classification'->>'state'='recorded'
  ORDER BY o.retrieved_at DESC,o.id LIMIT 1;
  IF v_nova IS NULL OR v_nova !~ '^[1-4]$' THEN v_nova:=NULL; v_nova_source:=NULL; END IF;

  SELECT v_field_conflict OR EXISTS(SELECT 1 FROM public.product_source_records r
    JOIN public.product_source_observations o ON o.source_record_id=r.id
    WHERE r.product_id=p_id AND o.status='quarantined'
      AND COALESCE(o.retrieved_at,o.received_at) >= COALESCE((SELECT s.retrieved_at FROM public.product_source_observations s
        WHERE s.id=r.selected_observation_id),'-infinity'::timestamptz)) INTO v_has_conflict;

  RETURN jsonb_build_object(
    -- Legacy translations are not bound to a source revision. Preserve them in
    -- storage, but do not use a possibly stale translation as current identity.
    'product_id',p.product_id,'product_name',p.product_name,
    'product_name_original',p.product_name,'brand',p.brand,'country',p.country,'category',p.category,
    'ean',p.ean,'is_deprecated',COALESCE(p.is_deprecated,false),'image',v_image,'nutrition',v_fields,
    'ingredients',jsonb_build_object('state',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(v_ingredients) a WHERE a->>'state'='recorded') THEN 'recorded' WHEN jsonb_array_length(v_ingredients)>0 THEN 'unverified' ELSE 'missing' END,'items',v_ingredients),
    'allergens',jsonb_build_object('state',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(v_contains||v_traces) a WHERE a->>'state'='recorded') THEN 'recorded' WHEN jsonb_array_length(v_contains||v_traces)>0 THEN 'unverified' ELSE 'missing' END,'contains',v_contains,'traces',v_traces),
    -- Positive suitability requires a separate explicit evidence contract;
    -- unknown ingredient metadata is never promoted to vegan/vegetarian yes.
    'suitability',jsonb_build_object('vegan','unknown','vegetarian','unknown'),
    'classifications',jsonb_build_object('nutri_score',jsonb_build_object('value',v_grade,'source',v_grade_source,'version',v_grade_version),
      'nova',jsonb_build_object('value',v_nova,'source',v_nova_source)),
    'sources',v_sources,'evidence',jsonb_build_object('state',CASE WHEN v_has_conflict THEN 'conflicting' WHEN jsonb_array_length(v_sources)>0 THEN 'recorded' ELSE 'legacy_unverified' END,
      'recorded_fields',v_recorded,'total_fields',9,'reasons',to_jsonb(array_remove(ARRAY[
        CASE WHEN v_recorded<9 THEN 'incomplete_nutrient_provenance' END,
        CASE WHEN v_has_conflict THEN 'unresolved_source_observation' END,
        'not_package_verification'],NULL))),
    'score',jsonb_build_object('status','retired','value',NULL,'model_version',p.score_model_version,'reason','unsupported_aggregate')
  );
END $$;
REVOKE ALL ON FUNCTION evidence_private.product_one(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.product_one(bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION evidence_private.product_batch(p_product_ids bigint[],p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_products jsonb; v_missing jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_product_ids IS NULL OR cardinality(p_product_ids)>100 OR EXISTS(SELECT 1 FROM unnest(p_product_ids) id WHERE id IS NULL OR id<=0 OR id>9007199254740991) THEN
    RETURN jsonb_build_object('error','Invalid product selection');
  END IF;
  IF p_language IS NOT NULL AND p_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported language'); END IF;
  WITH requested AS (SELECT id,min(position) AS position FROM unnest(p_product_ids) WITH ORDINALITY AS requested(id,position) GROUP BY id),
  projected AS (SELECT id,position,evidence_private.product_one(id,COALESCE(p_language,'en')) AS product FROM requested)
  SELECT COALESCE(jsonb_agg(product ORDER BY position) FILTER(WHERE product IS NOT NULL),'[]'::jsonb),
    COALESCE(jsonb_agg(id ORDER BY position) FILTER(WHERE product IS NULL),'[]'::jsonb)
    INTO v_products,v_missing FROM projected;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1','products',v_products,'missing_ids',v_missing);
END $$;
REVOKE ALL ON FUNCTION evidence_private.product_batch(bigint[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.product_batch(bigint[],text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.api_product_read_model(p_product_ids bigint[],p_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.product_batch(p_product_ids,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_product_read_model(bigint[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_product_read_model(bigint[],text) TO authenticated,service_role;
COMMENT ON FUNCTION public.api_product_read_model(bigint[],text) IS
  'Authenticated evidence-first v2 batch read. Returns source facts and uncertainty; never a universal health score. Max100 IDs; preserves selection order; does not write history.';

-- BEGIN BOUNDED OPERATOR SQL REPAIRS
-- Whole-database lint exposed pre-existing executable errors in service-only
-- diagnostics. Replace only the proven fragments of their existing definitions;
-- CREATE OR REPLACE preserves function identity, ownership and existing ACLs.
-- No score weights, thresholds, existing snapshots or user rows are rewritten.
DO $operator_sql_repairs$
DECLARE
  repair record;
  definition text;
BEGIN
  FOR repair IN SELECT * FROM (VALUES
    ('public.admin_scoring_versions()', 'row_to_jsonb(v)', 'to_jsonb(v)'),
    ('public.admin_score_drift_report(numeric)', 'row_to_jsonb(d)', 'to_jsonb(d)'),
    ('public.governance_drift_check()',
      'FROM scoring_model_versions WHERE status = ''active''',
      'FROM public.scoring_model_versions smv WHERE smv.status = ''active'''),
    ('public.report_slow_queries(double precision)',
      'n.nspname = ''pg_catalog'' AND c.relname = ''pg_stat_statements''',
      'n.nspname = ''extensions'' AND c.relname = ''pg_stat_statements'''),
    ('public.report_slow_queries(double precision)',
      'FROM pg_stat_statements s', 'FROM extensions.pg_stat_statements s'),
    ('public.snapshot_query_performance()',
      'n.nspname = ''pg_catalog'' AND c.relname = ''pg_stat_statements''',
      'n.nspname = ''extensions'' AND c.relname = ''pg_stat_statements'''),
    ('public.snapshot_query_performance()',
      'FROM pg_stat_statements s', 'FROM extensions.pg_stat_statements s'),
    ('public.snapshot_query_performance()',
      $old$FROM extensions.pg_stat_statements s
    WHERE s.calls > 10$old$,
      $new$FROM (
        -- The view is keyed by database/user/query/toplevel, while historical
        -- snapshots are keyed by date/query. Preserve every current-DB sample
        -- using a call-weighted mean instead of an arbitrary duplicate row.
        SELECT s0.queryid, min(s0.query COLLATE "C") AS query,
               sum(s0.calls)::bigint AS calls,
               sum(s0.total_exec_time) / NULLIF(sum(s0.calls), 0)::double precision AS mean_exec_time,
               max(s0.max_exec_time) AS max_exec_time,
               sum(s0.shared_blks_hit) AS shared_blks_hit,
               sum(s0.shared_blks_read) AS shared_blks_read
        FROM extensions.pg_stat_statements s0
        WHERE s0.dbid = (SELECT d.oid FROM pg_catalog.pg_database d WHERE d.datname = current_database())
          AND s0.queryid IS NOT NULL
        GROUP BY s0.queryid
    ) s
    WHERE s.calls > 10$new$),
    ('public.validate_product_for_country(bigint,text)',
      $old$format('Confidence %.2f below minimum %.2f',
                v_confidence.overall_confidence, v_policy.min_confidence_for_publish)$old$,
      $new$format('Confidence %s below minimum %s',
                round(v_confidence.overall_confidence, 2), round(v_policy.min_confidence_for_publish, 2))$new$),
    ('public.validate_product_for_country(bigint,text)',
      'v_product.allergens IS NULL',
      'NOT EXISTS (SELECT 1 FROM public.product_allergen_info pai WHERE pai.product_id = p_product_id)')
  ) AS fragments(signature, old_fragment, new_fragment)
  LOOP
    IF to_regprocedure(repair.signature) IS NULL THEN
      RAISE EXCEPTION 'Required operator routine missing: %', repair.signature;
    END IF;
    definition := pg_get_functiondef(to_regprocedure(repair.signature));
    IF strpos(definition, repair.old_fragment) > 0 THEN
      EXECUTE replace(definition, repair.old_fragment, repair.new_fragment);
    ELSIF strpos(definition, repair.new_fragment) = 0 THEN
      RAISE EXCEPTION 'Operator source changed outside bounded repair: %', repair.signature;
    END IF;
  END LOOP;
END;
$operator_sql_repairs$;
-- END BOUNDED OPERATOR SQL REPAIRS
-- Repair the existing historical suggestion reader before its later retirement.
-- Keep its ranking and ACLs; only the nonexistent identifier is corrected.
CREATE OR REPLACE FUNCTION public.api_search_did_you_mean(
  p_query   text,
  p_country text    DEFAULT NULL,
  p_limit   integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_country text;
  v_clean   text;
  v_result  jsonb;
BEGIN
  -- Resolve country (same logic as api_search_products)
  v_country := COALESCE(
    p_country,
    (SELECT country FROM user_preferences WHERE user_id = auth.uid()),
    'PL'
  );

  -- Clean and normalize query (strip diacritics)
  v_clean := lower(trim(unaccent(COALESCE(p_query, ''))));

  -- Guard: empty or too-short query
  IF length(v_clean) < 2 THEN
    RETURN jsonb_build_object(
      'query', p_query,
      'suggestions', '[]'::jsonb
    );
  END IF;

  -- Find similar product names using pg_trgm
  SELECT jsonb_build_object(
    'query', p_query,
    'suggestions', COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT DISTINCT ON (p.product_name)
      p.product_id            AS product_id,
      p.product_name,
      p.brand,
      p.category,
      p.unhealthiness_score,
      similarity(unaccent(lower(p.product_name)), v_clean) AS sim
    FROM products p
    WHERE p.country = v_country
      AND similarity(unaccent(lower(p.product_name)), v_clean) > 0.2
    ORDER BY p.product_name, sim DESC
    LIMIT p_limit
  ) t;

  RETURN COALESCE(v_result, jsonb_build_object(
    'query', p_query,
    'suggestions', '[]'::jsonb
  ));
END;
$$;
COMMIT;
