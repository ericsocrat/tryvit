-- Migration: Explain exact active-market Find matches withheld by current filters.
-- Rollback: restore the prior api_find_products body in a forward migration; this adds no data or policy state.
BEGIN;

CREATE OR REPLACE FUNCTION evidence_private.find_products(
  p_query text DEFAULT NULL, p_filters jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 20,
  p_show_avoided boolean DEFAULT false, p_language text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid(); v_country text; v_language text;
  v_query text := NULLIF(btrim(p_query),''); v_clean text; v_identity_clean text; v_tsq tsquery;
  v_categories text[]; v_nova text[]; v_explicit_excluded text[]; v_saved_excluded text[]; v_synonyms text[];
  v_sort text; v_order text; v_rate jsonb; v_prefs public.user_preferences%ROWTYPE;
  v_preferences boolean; v_strict_unknown boolean; v_offset integer; v_field text; v_response jsonb;
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
    IF p_filters ? v_field AND jsonb_typeof(p_filters->v_field)<>'array' THEN RETURN jsonb_build_object('error','Invalid search filters'); END IF;
    IF p_filters ? v_field AND (jsonb_array_length(p_filters->v_field)>30 OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_filters->v_field) e WHERE jsonb_typeof(e)<>'string' OR length(e#>>'{}')>100
    )) THEN RETURN jsonb_build_object('error','Invalid search filters'); END IF;
  END LOOP;
  FOREACH v_field IN ARRAY ARRAY['country','sort_by','sort_order'] LOOP
    IF p_filters ? v_field AND jsonb_typeof(p_filters->v_field)<>'string' THEN RETURN jsonb_build_object('error','Invalid search filters'); END IF;
  END LOOP;
  v_sort := COALESCE(p_filters->>'sort_by','relevance'); v_order := COALESCE(p_filters->>'sort_order','asc');
  IF v_sort NOT IN ('relevance','name') OR v_order NOT IN ('asc','desc') THEN RETURN jsonb_build_object('error','Unsupported search ordering'); END IF;
  v_country := public.resolve_effective_country(p_filters->>'country'); v_language := public.resolve_language(p_language);
  IF v_country NOT IN ('PL','DE') OR v_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported search context'); END IF;
  v_categories := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'category','[]'::jsonb)));
  v_nova := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'nova_group','[]'::jsonb)));
  v_explicit_excluded := ARRAY(SELECT evidence_private.allergen_key(jsonb_array_elements_text(COALESCE(p_filters->'allergen_free','[]'::jsonb))));
  IF EXISTS(SELECT 1 FROM unnest(v_explicit_excluded) a WHERE NOT EXISTS(SELECT 1 FROM public.allergen_ref r WHERE r.allergen_id=a AND r.is_active)) THEN
    RETURN jsonb_build_object('error','Unsupported allergen filter');
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(v_nova) n WHERE n NOT IN ('1','2','3','4')) THEN RETURN jsonb_build_object('error','Unsupported NOVA classification'); END IF;
  SELECT * INTO v_prefs FROM public.user_preferences WHERE user_id=v_user;
  v_preferences := COALESCE(v_prefs.diet_preference NOT IN ('none',''),false) OR COALESCE(cardinality(v_prefs.avoid_allergens)>0,false);
  v_strict_unknown := (COALESCE(v_prefs.strict_diet,false) AND COALESCE(v_prefs.diet_preference IN ('vegan','vegetarian'),false))
    OR (COALESCE(v_prefs.strict_allergen,false) AND COALESCE(cardinality(v_prefs.avoid_allergens)>0,false));
  v_saved_excluded := ARRAY(SELECT evidence_private.allergen_key(a) FROM unnest(COALESCE(v_prefs.avoid_allergens,ARRAY[]::text[])) a);
  v_rate := public.check_api_rate_limit(v_user,'api_search_products');
  IF NOT (v_rate->>'allowed')::boolean THEN RETURN jsonb_build_object('error','rate_limit_exceeded'); END IF;
  v_clean := lower(public.unaccent(COALESCE(v_query,'')));
  v_identity_clean := NULLIF(regexp_replace(v_clean,'\s+',' ','g'),'');
  SELECT to_tsquery('simple',string_agg(quote_literal(term)||':*',' & ')) INTO v_tsq
    FROM unnest(tsvector_to_array(to_tsvector('simple',v_clean))) term;
  v_synonyms := CASE WHEN v_query IS NULL THEN ARRAY[]::text[] ELSE public.expand_search_query(v_clean) END;
  v_offset := (p_page-1)*p_page_size;

  WITH base AS MATERIALIZED (
    SELECT p.product_id,p.product_name,p.product_name_en,p.brand,p.ean,p.category,p.search_vector,
      lower(public.unaccent(regexp_replace(btrim(p.brand)||' '||btrim(p.product_name),'\s+',' ','g'))) AS identity_forward,
      lower(public.unaccent(regexp_replace(btrim(p.product_name)||' '||btrim(p.brand),'\s+',' ','g'))) AS identity_reverse
    FROM public.products p WHERE p.is_deprecated IS NOT TRUE AND p.country=v_country
  ), exact_probe AS MATERIALIZED (
    SELECT product_id,'ean'::text AS match_type FROM base WHERE v_query IS NOT NULL AND ean=v_query
    UNION ALL
    SELECT product_id,'identity'::text FROM base
    WHERE v_query IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM base WHERE ean=v_query)
      AND (identity_forward=v_identity_clean OR identity_reverse=v_identity_clean)
      AND 1=(SELECT count(*) FROM base WHERE identity_forward=v_identity_clean OR identity_reverse=v_identity_clean)
  ), matched AS MATERIALIZED (
    SELECT b.*,probe.match_type,
      COALESCE(cardinality(v_categories)=0 OR b.category=ANY(v_categories),false) AS category_ok,
      COALESCE(cardinality(v_nova)=0 OR (SELECT o.extracted_fields->'nova_classification'->>'value'
        FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
        WHERE r.product_id=b.product_id AND o.status='accepted' AND o.extracted_fields->'nova_classification'->>'state'='recorded'
        ORDER BY o.retrieved_at DESC,o.id LIMIT 1)=ANY(v_nova),false) AS nova_ok,
      EXISTS(SELECT 1 FROM public.user_product_list_items i JOIN public.user_product_lists l ON l.id=i.list_id
        WHERE i.product_id=b.product_id AND l.user_id=v_user AND l.list_type='avoid') AS is_avoided,
      CASE WHEN COALESCE(v_prefs.diet_preference,'none') IN ('none','') THEN true
        ELSE COALESCE(evidence_private.legacy_diet_match(b.product_id,v_prefs.diet_preference),false) END AS diet_ok,
      allergen_matches.explicit_tags,allergen_matches.saved_tags
    FROM base b LEFT JOIN exact_probe probe USING(product_id)
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(array_agg(DISTINCT tag ORDER BY tag) FILTER (WHERE tag=ANY(v_explicit_excluded)
          AND (evidence_type='contains' OR (COALESCE(v_prefs.treat_may_contain_as_unsafe,false) AND evidence_type='traces'))),ARRAY[]::text[]) AS explicit_tags,
        COALESCE(array_agg(DISTINCT tag ORDER BY tag) FILTER (WHERE tag=ANY(v_saved_excluded)
          AND (evidence_type='contains' OR (COALESCE(v_prefs.treat_may_contain_as_unsafe,false) AND evidence_type='traces'))),ARRAY[]::text[]) AS saved_tags
      FROM (
        SELECT evidence_private.allergen_key(a.tag) AS tag,a.type AS evidence_type FROM public.product_allergen_info a WHERE a.product_id=b.product_id
        UNION
        SELECT evidence_private.allergen_key(a.assertion->>'tag') AS tag,a.kind AS evidence_type
          FROM public.product_source_records r JOIN public.product_source_assertions a ON a.source_record_id=r.id WHERE r.product_id=b.product_id
      ) evidence
    ) allergen_matches ON true
    WHERE v_query IS NULL OR probe.product_id IS NOT NULL OR b.ean=v_query
      OR position(v_clean IN lower(public.unaccent(b.product_name)))>0
      OR position(v_clean IN lower(public.unaccent(COALESCE(b.product_name_en,''))))>0
      OR position(v_clean IN lower(public.unaccent(b.brand)))>0
      OR (v_tsq IS NOT NULL AND b.search_vector @@ v_tsq)
      OR EXISTS(SELECT 1 FROM unnest(v_synonyms) s WHERE position(lower(public.unaccent(s)) IN lower(public.unaccent(b.product_name)))>0
        OR position(lower(public.unaccent(s)) IN lower(public.unaccent(COALESCE(b.product_name_en,''))))>0)
  ), evaluated AS MATERIALIZED (
    SELECT *,array_remove(ARRAY[
      CASE WHEN NOT category_ok OR NOT nova_ok OR cardinality(explicit_tags)>0 THEN 'explicit_filter' END,
      CASE WHEN NOT p_show_avoided AND is_avoided THEN 'avoid_list' END,
      CASE WHEN NOT diet_ok THEN 'diet_preference' END,
      CASE WHEN cardinality(saved_tags)>0 THEN 'allergen_preference' END,
      CASE WHEN v_strict_unknown THEN 'strict_unknown' END
    ],NULL)::text[] AS exclusion_reasons
    FROM matched
  ), eligible AS MATERIALIZED (
    SELECT * FROM evaluated WHERE cardinality(exclusion_reasons)=0
  ), ranked AS MATERIALIZED (
    SELECT *,CASE WHEN v_query IS NULL THEN 0 WHEN ean=v_query THEN 100
      WHEN match_type='identity' THEN 90
      WHEN lower(public.unaccent(product_name))=v_clean OR lower(public.unaccent(COALESCE(product_name_en,'')))=v_clean THEN 10
      WHEN position(v_clean IN lower(public.unaccent(product_name)))>0 OR position(v_clean IN lower(public.unaccent(COALESCE(product_name_en,''))))>0 THEN 5
      ELSE 1 END+COALESCE(ts_rank(search_vector,v_tsq),0) AS relevance
    FROM eligible
  ), paged AS (
    SELECT product_id,row_number() OVER(ORDER BY CASE WHEN v_sort='relevance' THEN relevance END DESC,
      CASE WHEN v_sort='name' AND v_order='desc' THEN lower(product_name) END DESC,
      CASE WHEN v_sort='name' AND v_order='asc' THEN lower(product_name) END ASC,lower(product_name),product_id) AS row_position
    FROM ranked ORDER BY row_position LIMIT p_page_size OFFSET v_offset
  ), projected AS (
    SELECT evidence_private.product_one(product_id,v_language) AS product,row_position FROM paged
  ), summary AS (
    SELECT (count(*) FILTER(WHERE cardinality(exclusion_reasons)=0))::integer AS eligible_total,
      (count(*) FILTER(WHERE cardinality(exclusion_reasons)>0))::integer AS total_hidden,
      (count(*) FILTER(WHERE 'explicit_filter'=ANY(exclusion_reasons)))::integer AS explicit_filter_count,
      (count(*) FILTER(WHERE 'avoid_list'=ANY(exclusion_reasons)))::integer AS avoid_list_count,
      (count(*) FILTER(WHERE 'diet_preference'=ANY(exclusion_reasons)))::integer AS diet_preference_count,
      (count(*) FILTER(WHERE 'allergen_preference'=ANY(exclusion_reasons)))::integer AS allergen_preference_count,
      (count(*) FILTER(WHERE 'strict_unknown'=ANY(exclusion_reasons)))::integer AS strict_unknown_count
    FROM evaluated
  )
  SELECT jsonb_build_object(
    'api_version','2','policy_version','evidence-first-v1','query',v_query,'country',v_country,'language',v_language,
    'total',summary.eligible_total,'page',p_page,'pages',greatest(1,ceil(summary.eligible_total::numeric/p_page_size)::integer),'page_size',p_page_size,
    'filters_applied',p_filters,'preferences_applied',v_preferences,
    'results',(SELECT COALESCE(jsonb_agg(product ORDER BY row_position),'[]'::jsonb) FROM projected),
    'excluded_summary',CASE WHEN v_query IS NULL THEN NULL ELSE jsonb_build_object(
      'total_hidden',summary.total_hidden,
      'by_reason',jsonb_build_object('explicit_filter',summary.explicit_filter_count,'avoid_list',summary.avoid_list_count,
        'diet_preference',summary.diet_preference_count,'allergen_preference',summary.allergen_preference_count,'strict_unknown',summary.strict_unknown_count),
      'reason_count_semantics','overlapping') END,
    'excluded_exact_match',(SELECT jsonb_build_object('match_type',match_type,'product_id',product_id,'product_name',product_name,
      'brand',brand,'ean',ean,'category',category,'reasons',to_jsonb(exclusion_reasons),'allergen_tags',to_jsonb(saved_tags))
      FROM evaluated WHERE match_type IS NOT NULL AND cardinality(exclusion_reasons)>0 LIMIT 1)
  ) INTO v_response FROM summary;
  RETURN v_response;
END $$;

REVOKE ALL ON FUNCTION evidence_private.find_products(text,jsonb,integer,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.find_products(text,jsonb,integer,integer,boolean,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_find_products(p_query text DEFAULT NULL,p_filters jsonb DEFAULT '{}'::jsonb,p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_show_avoided boolean DEFAULT false,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.find_products(p_query,p_filters,p_page,p_page_size,p_show_avoided,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_find_products(text,jsonb,integer,integer,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_find_products(text,jsonb,integer,integer,boolean,text) TO authenticated,service_role;

COMMIT;
