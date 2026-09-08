-- Migration: Add the owner-scoped evidence-first Home projection.
-- Rollback: Restore the prior function from verified schema recovery only with a compatible client; never restore consumer score claims.
-- One owner-scoped Home projection: no aggregate score, winner or inferred safety.
BEGIN;
CREATE OR REPLACE FUNCTION public.api_home_read_model(p_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_preferences public.user_preferences%ROWTYPE;
  v_preferences_found boolean;
  v_avoid text[];
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_language IS NULL OR p_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported language'); END IF;
  SELECT * INTO v_preferences FROM public.user_preferences WHERE user_id=v_user;
  v_preferences_found:=FOUND;
  v_avoid:=ARRAY(SELECT DISTINCT evidence_private.allergen_key(tag)
    FROM unnest(COALESCE(v_preferences.avoid_allergens,ARRAY[]::text[])) tag
    WHERE evidence_private.allergen_key(tag) IS NOT NULL);

  WITH recent AS MATERIALIZED (
    SELECT product_id,viewed_at FROM public.user_product_views
    WHERE user_id=v_user ORDER BY viewed_at DESC,product_id LIMIT 8
  ), favorites AS MATERIALIZED (
    SELECT i.product_id,i.added_at,i.position,i.id AS item_id
    FROM public.user_product_list_items i JOIN public.user_product_lists l ON l.id=i.list_id
    WHERE l.user_id=v_user AND l.list_type='favorites'
  ), favorite_preview AS MATERIALIZED (
    SELECT * FROM favorites ORDER BY position,added_at DESC,product_id LIMIT 6
  ), assertions AS (
    SELECT f.product_id,evidence_private.allergen_key(a.assertion->>'tag') AS allergen,a.kind,
      CASE WHEN a.observation_id=r.selected_observation_id THEN 'recorded' ELSE 'unverified' END AS state,a.observation_id
    FROM favorites f JOIN public.product_source_records r ON r.product_id=f.product_id
    JOIN public.product_source_assertions a ON a.source_record_id=r.id
    WHERE a.kind='contains' OR (a.kind='traces' AND v_preferences.treat_may_contain_as_unsafe IS TRUE)
    UNION ALL
    SELECT f.product_id,evidence_private.allergen_key(a.tag),
      CASE WHEN a.type='contains' THEN 'contains' ELSE 'traces' END,'unverified',NULL::uuid
    FROM favorites f JOIN public.product_allergen_info a ON a.product_id=f.product_id
    WHERE a.type='contains' OR (a.type IN ('traces','may_contain') AND v_preferences.treat_may_contain_as_unsafe IS TRUE)
  ), matched AS MATERIALIZED (
    SELECT DISTINCT ON (product_id,allergen,kind) product_id,allergen,kind,state,observation_id
    FROM assertions WHERE allergen=ANY(v_avoid)
    ORDER BY product_id,allergen,kind,CASE WHEN state='recorded' THEN 0 ELSE 1 END,observation_id
  ), warning_ids AS MATERIALIZED (
    SELECT m.product_id,min(f.position) AS position,max(f.added_at) AS added_at
    FROM matched m JOIN favorites f ON f.product_id=m.product_id GROUP BY m.product_id
    ORDER BY min(f.position),max(f.added_at) DESC,m.product_id LIMIT 6
  ), visible_ids AS (
    SELECT product_id FROM recent UNION SELECT product_id FROM favorite_preview UNION SELECT product_id FROM warning_ids
  ), models AS MATERIALIZED (
    SELECT product_id,evidence_private.product_one(product_id,p_language) AS product FROM visible_ids
  )
  SELECT jsonb_build_object(
    'api_version','2','policy_version','evidence-first-v1','language',p_language,
    'country',CASE WHEN v_preferences_found THEN v_preferences.country ELSE NULL END,
    'recently_viewed',COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id',r.product_id,'viewed_at',r.viewed_at,'product',m.product)
      ORDER BY r.viewed_at DESC,r.product_id) FROM recent r JOIN models m USING(product_id)),'[]'::jsonb),
    'favorites_preview',COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id',f.product_id,'added_at',f.added_at,'product',m.product)
      ORDER BY f.position,f.added_at DESC,f.product_id) FROM favorite_preview f JOIN models m USING(product_id)),'[]'::jsonb),
    'stats',jsonb_build_object(
      'total_scanned',(SELECT count(*) FROM public.scan_history WHERE user_id=v_user),
      'total_viewed',(SELECT count(*) FROM public.user_product_views WHERE user_id=v_user),
      'favorites_count',(SELECT count(*) FROM favorites),
      'lists_count',(SELECT count(*) FROM public.user_product_lists WHERE user_id=v_user),
      'custom_lists_count',(SELECT count(*) FROM public.user_product_lists WHERE user_id=v_user AND list_type='custom')),
    'saved_allergen_matches',jsonb_build_object(
      'state',CASE WHEN NOT v_preferences_found THEN 'preferences_unavailable' WHEN cardinality(v_avoid)=0 THEN 'not_configured' ELSE 'checked' END,
      'count',CASE WHEN v_preferences_found AND cardinality(v_avoid)>0 THEN (SELECT count(DISTINCT product_id) FROM matched) ELSE NULL END,
      'includes_traces',v_preferences.treat_may_contain_as_unsafe IS TRUE,
      'products',COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id',w.product_id,'product',m.product,
        'matches',(SELECT jsonb_agg(jsonb_build_object('allergen',a.allergen,'kind',a.kind,'state',a.state,'observation_id',a.observation_id)
          ORDER BY a.allergen,a.kind) FROM matched a WHERE a.product_id=w.product_id))
        ORDER BY w.position,w.added_at DESC,w.product_id) FROM warning_ids w JOIN models m USING(product_id)),'[]'::jsonb))
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.api_home_read_model(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_home_read_model(text) TO authenticated,service_role;

-- Obsolete clients must refresh rather than coercing nulled aggregate fields.
CREATE OR REPLACE FUNCTION public.api_get_dashboard_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('error','Refresh required: Home evidence contract replaced this endpoint','status','refresh_required');
$$;
REVOKE ALL ON FUNCTION public.api_get_dashboard_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_dashboard_data() TO authenticated,service_role;
COMMIT;
