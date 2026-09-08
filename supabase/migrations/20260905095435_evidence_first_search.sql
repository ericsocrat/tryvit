-- Migration: Paged evidence-first search; saved v1 filters and history are retained.
-- Rollback: remove these additive entrypoints only after all consumers are migrated.
BEGIN;

-- The legacy SQL helper contains unqualified relation names. Keep its original
-- non-strict diet semantics behind a non-exposed, invoker-only path boundary.
-- pg_temp is explicit and last so a temporary relation cannot shadow v_master.
CREATE OR REPLACE FUNCTION evidence_private.legacy_diet_match(p_product_id bigint,p_diet text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog,public,pg_temp AS $$
BEGIN
  RETURN public.check_product_preferences(p_product_id,p_diet,NULL,false,false,false);
END $$;
REVOKE ALL ON FUNCTION evidence_private.legacy_diet_match(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.legacy_diet_match(bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION evidence_private.find_products(
  p_query text DEFAULT NULL, p_filters jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 20,
  p_show_avoided boolean DEFAULT false, p_language text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid(); v_country text; v_language text;
  v_query text := NULLIF(btrim(p_query),''); v_clean text; v_tsq tsquery;
  v_categories text[]; v_nova text[]; v_excluded text[]; v_synonyms text[];
  v_sort text; v_order text; v_rate jsonb; v_prefs public.user_preferences%ROWTYPE;
  v_preferences boolean; v_strict_unknown boolean; v_total integer; v_pages integer;
  v_rows jsonb; v_offset integer; v_field text;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_filters IS NULL OR jsonb_typeof(p_filters)<>'object' OR EXISTS(
    SELECT 1 FROM jsonb_object_keys(p_filters) k
    WHERE k NOT IN ('category','nova_group','allergen_free','country','sort_by','sort_order')
  ) THEN RETURN jsonb_build_object('error','Unsupported search filters'); END IF;
  IF length(COALESCE(v_query,''))>200 OR p_page IS NULL OR p_page<1 OR p_page>10000
    OR p_page_size IS NULL OR p_page_size<1 OR p_page_size>50 OR p_show_avoided IS NULL THEN
    RETURN jsonb_build_object('error','Invalid search request');
  END IF;
  FOREACH v_field IN ARRAY ARRAY['category','nova_group','allergen_free'] LOOP
    IF p_filters ? v_field AND (jsonb_typeof(p_filters->v_field)<>'array') THEN
      RETURN jsonb_build_object('error','Invalid search filters');
    END IF;
    IF p_filters ? v_field AND (jsonb_array_length(p_filters->v_field)>30 OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_filters->v_field) e
      WHERE jsonb_typeof(e)<>'string' OR length(e#>>'{}')>100
    )) THEN RETURN jsonb_build_object('error','Invalid search filters'); END IF;
  END LOOP;
  FOREACH v_field IN ARRAY ARRAY['country','sort_by','sort_order'] LOOP
    IF p_filters ? v_field AND jsonb_typeof(p_filters->v_field)<>'string' THEN
      RETURN jsonb_build_object('error','Invalid search filters');
    END IF;
  END LOOP;
  v_sort := COALESCE(p_filters->>'sort_by','relevance');
  v_order := COALESCE(p_filters->>'sort_order','asc');
  IF v_sort NOT IN ('relevance','name') OR v_order NOT IN ('asc','desc') THEN
    RETURN jsonb_build_object('error','Unsupported search ordering');
  END IF;
  v_country := public.resolve_effective_country(p_filters->>'country');
  v_language := public.resolve_language(p_language);
  IF v_country NOT IN ('PL','DE') OR v_language NOT IN ('en','pl','de') THEN
    RETURN jsonb_build_object('error','Unsupported search context');
  END IF;
  v_categories := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'category','[]'::jsonb)));
  v_nova := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'nova_group','[]'::jsonb)));
  v_excluded := ARRAY(SELECT evidence_private.allergen_key(jsonb_array_elements_text(COALESCE(p_filters->'allergen_free','[]'::jsonb))));
  IF EXISTS(SELECT 1 FROM unnest(v_excluded) a WHERE NOT EXISTS(SELECT 1 FROM public.allergen_ref r WHERE r.allergen_id=a AND r.is_active)) THEN
    RETURN jsonb_build_object('error','Unsupported allergen filter');
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(v_nova) n WHERE n NOT IN ('1','2','3','4')) THEN
    RETURN jsonb_build_object('error','Unsupported NOVA classification');
  END IF;
  SELECT * INTO v_prefs FROM public.user_preferences WHERE user_id=v_user;
  v_preferences := COALESCE(v_prefs.diet_preference NOT IN ('none',''),false)
    OR COALESCE(cardinality(v_prefs.avoid_allergens)>0,false);
  -- The v2 evidence model cannot affirm dietary suitability or assessed allergen
  -- absence. Strict preferences therefore withhold unknowns, not invent yes.
  v_strict_unknown := (COALESCE(v_prefs.strict_diet,false) AND COALESCE(v_prefs.diet_preference IN ('vegan','vegetarian'),false))
    OR (COALESCE(v_prefs.strict_allergen,false) AND COALESCE(cardinality(v_prefs.avoid_allergens)>0,false));
  v_excluded := v_excluded || ARRAY(SELECT evidence_private.allergen_key(a) FROM unnest(COALESCE(v_prefs.avoid_allergens,ARRAY[]::text[])) a);
  -- Share the established search budget with v1; the new endpoint is not a bypass.
  v_rate := public.check_api_rate_limit(v_user,'api_search_products');
  IF NOT (v_rate->>'allowed')::boolean THEN RETURN jsonb_build_object('error','rate_limit_exceeded'); END IF;
  v_clean := lower(public.unaccent(COALESCE(v_query,'')));
  -- Parse before adding prefix operators. quote_literal prevents punctuation or
  -- apostrophes from becoming tsquery syntax; no user SQL is interpolated.
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO v_tsq
  FROM unnest(tsvector_to_array(to_tsvector('simple',v_clean))) term;
  v_synonyms := CASE WHEN v_query IS NULL THEN ARRAY[]::text[] ELSE public.expand_search_query(v_clean) END;
  v_offset := (p_page-1)*p_page_size;

  WITH eligible AS MATERIALIZED (
    SELECT p.product_id,p.product_name,p.product_name_en,p.brand,p.ean,p.search_vector
    FROM public.products p
    WHERE p.is_deprecated IS NOT TRUE AND p.country=v_country AND NOT v_strict_unknown
      AND (cardinality(v_categories)=0 OR p.category=ANY(v_categories))
      AND (v_query IS NULL OR p.ean=v_query
        OR position(v_clean IN lower(public.unaccent(p.product_name)))>0
        OR position(v_clean IN lower(public.unaccent(COALESCE(p.product_name_en,''))))>0
        OR position(v_clean IN lower(public.unaccent(p.brand)))>0
        OR (v_tsq IS NOT NULL AND p.search_vector @@ v_tsq)
        OR EXISTS(SELECT 1 FROM unnest(v_synonyms) s WHERE position(lower(public.unaccent(s)) IN lower(public.unaccent(p.product_name)))>0
          OR position(lower(public.unaccent(s)) IN lower(public.unaccent(COALESCE(p.product_name_en,''))))>0))
      AND (p_show_avoided OR NOT EXISTS(SELECT 1 FROM public.user_product_list_items i
        JOIN public.user_product_lists l ON l.id=i.list_id WHERE i.product_id=p.product_id AND l.user_id=v_user AND l.list_type='avoid'))
      AND (v_prefs.diet_preference IS NULL OR v_prefs.diet_preference='none' OR evidence_private.legacy_diet_match(p.product_id,v_prefs.diet_preference))
      AND NOT EXISTS(SELECT 1 FROM public.product_allergen_info a WHERE a.product_id=p.product_id
        AND evidence_private.allergen_key(a.tag)=ANY(v_excluded)
        AND (a.type='contains' OR (COALESCE(v_prefs.treat_may_contain_as_unsafe,false) AND a.type='traces')))
      AND NOT EXISTS(SELECT 1 FROM public.product_source_assertions a JOIN public.product_source_records r ON r.id=a.source_record_id
        WHERE r.product_id=p.product_id AND evidence_private.allergen_key(a.assertion->>'tag')=ANY(v_excluded)
        AND (a.kind='contains' OR (COALESCE(v_prefs.treat_may_contain_as_unsafe,false) AND a.kind='traces')))
      AND (cardinality(v_nova)=0 OR (SELECT o.extracted_fields->'nova_classification'->>'value'
        FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
        WHERE r.product_id=p.product_id AND o.status='accepted' AND o.extracted_fields->'nova_classification'->>'state'='recorded'
        ORDER BY o.retrieved_at DESC,o.id LIMIT 1)=ANY(v_nova))
  ), ranked AS (
    SELECT *,CASE WHEN v_query IS NULL THEN 0 WHEN ean=v_query THEN 100
      WHEN lower(public.unaccent(product_name))=v_clean OR lower(public.unaccent(COALESCE(product_name_en,'')))=v_clean THEN 10
      WHEN position(v_clean IN lower(public.unaccent(product_name)))>0 OR position(v_clean IN lower(public.unaccent(COALESCE(product_name_en,''))))>0 THEN 5
      ELSE 1 END + COALESCE(ts_rank(search_vector,v_tsq),0) AS relevance FROM eligible
  ), paged AS (
    SELECT product_id,row_number() OVER(ORDER BY
      CASE WHEN v_sort='relevance' THEN relevance END DESC,
      CASE WHEN v_sort='name' AND v_order='desc' THEN lower(product_name) END DESC,
      CASE WHEN v_sort='name' AND v_order='asc' THEN lower(product_name) END ASC,
      lower(product_name),product_id) AS row_position FROM ranked
    ORDER BY row_position LIMIT p_page_size OFFSET v_offset
  ), projected AS (
    SELECT evidence_private.product_one(product_id,v_language) AS product,row_position FROM paged
  ) SELECT (SELECT count(*)::integer FROM eligible),COALESCE(jsonb_agg(product ORDER BY row_position),'[]'::jsonb)
    INTO v_total,v_rows FROM projected;
  v_pages := greatest(1,ceil(v_total::numeric/p_page_size)::integer);
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1','query',v_query,'country',v_country,
    'language',v_language,'total',v_total,'page',p_page,'pages',v_pages,'page_size',p_page_size,
    'filters_applied',p_filters,'preferences_applied',v_preferences,'results',v_rows);
END $$;
REVOKE ALL ON FUNCTION evidence_private.find_products(text,jsonb,integer,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.find_products(text,jsonb,integer,integer,boolean,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_find_products(p_query text DEFAULT NULL,p_filters jsonb DEFAULT '{}'::jsonb,p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_show_avoided boolean DEFAULT false,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.find_products(p_query,p_filters,p_page,p_page_size,p_show_avoided,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_find_products(text,jsonb,integer,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_find_products(text,jsonb,integer,integer,boolean,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION evidence_private.find_filter_options(p_country text,p_language text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_country text; v_language text; v_rows jsonb; v_rate jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  v_country:=public.resolve_effective_country(p_country); v_language:=public.resolve_language(p_language);
  IF v_country NOT IN ('PL','DE') OR v_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported search context'); END IF;
  v_rate:=public.check_api_rate_limit(auth.uid(),'api_get_filter_options');
  IF NOT (v_rate->>'allowed')::boolean THEN RETURN jsonb_build_object('error','rate_limit_exceeded'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('value',c.category,'label',COALESCE(t.display_name,c.display_name),'slug',c.slug) ORDER BY c.sort_order,c.category),'[]'::jsonb)
  INTO v_rows FROM public.category_ref c LEFT JOIN public.category_translations t ON t.category=c.category AND t.language_code=v_language
  WHERE EXISTS(SELECT 1 FROM public.products p WHERE p.category=c.category AND p.country=v_country AND p.is_deprecated IS NOT TRUE);
  RETURN jsonb_build_object('api_version','2','country',v_country,'language',v_language,'categories',v_rows);
END $$;
REVOKE ALL ON FUNCTION evidence_private.find_filter_options(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.find_filter_options(text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_find_filter_options(p_country text DEFAULT NULL,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$ SELECT evidence_private.find_filter_options(p_country,p_language); $$;
REVOKE ALL ON FUNCTION public.api_find_filter_options(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_find_filter_options(text,text) TO authenticated,service_role;
COMMIT;
