-- Migration: Evidence-first reads for user-owned saved membership.
-- Rollback: Retain additive APIs until consumers migrate; never delete user membership.
-- Additive reads retain IDs, notes and ordering; historical calculations remain stored.
BEGIN;

CREATE OR REPLACE FUNCTION evidence_private.saved_list(p_list_id uuid,p_limit integer,p_offset integer,p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_list public.user_product_lists%ROWTYPE; v_items jsonb; v_total integer; v_language text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN
    RETURN jsonb_build_object('error','Invalid collection page');
  END IF;
  v_language:=public.resolve_language(p_language);
  IF v_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported language'); END IF;
  SELECT * INTO v_list FROM public.user_product_lists WHERE id=p_list_id AND user_id=auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('error','List not found'); END IF;
  SELECT count(*)::integer INTO v_total FROM public.user_product_list_items WHERE list_id=p_list_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_id',i.id,'product_id',i.product_id,'position',i.position,'notes',i.notes,'added_at',i.added_at,
    'product',evidence_private.product_one(i.product_id,v_language)
  ) ORDER BY i.position,i.added_at,i.id),'[]'::jsonb) INTO v_items
  FROM (SELECT * FROM public.user_product_list_items WHERE list_id=p_list_id
    ORDER BY position,added_at,id LIMIT p_limit OFFSET p_offset) i;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'list_id',v_list.id,'list_name',v_list.name,'list_type',v_list.list_type,'description',v_list.description,
    'share_enabled',v_list.share_enabled,'share_token',v_list.share_token,
    'total_count',v_total,'limit',p_limit,'offset',p_offset,'items',v_items);
END $$;
REVOKE ALL ON FUNCTION evidence_private.saved_list(uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.saved_list(uuid,integer,integer,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_saved_list_read_model(p_list_id uuid,p_limit integer DEFAULT 20,p_offset integer DEFAULT 0,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.saved_list(p_list_id,p_limit,p_offset,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_saved_list_read_model(uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_saved_list_read_model(uuid,integer,integer,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION evidence_private.watched_products(p_page integer,p_page_size integer,p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_items jsonb; v_total integer; v_language text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_page IS NULL OR p_page<1 OR p_page>10000 OR p_page_size IS NULL OR p_page_size<1 OR p_page_size>100 THEN
    RETURN jsonb_build_object('error','Invalid collection page');
  END IF;
  v_language:=public.resolve_language(p_language);
  IF v_language NOT IN ('en','pl','de') THEN RETURN jsonb_build_object('error','Unsupported language'); END IF;
  SELECT count(*)::integer INTO v_total FROM public.user_watched_products WHERE user_id=auth.uid();
  SELECT COALESCE(jsonb_agg(jsonb_build_object('watch_id',w.watch_id,'product_id',w.product_id,
    'watched_since',w.created_at,'product',evidence_private.product_one(w.product_id,v_language))
    ORDER BY w.created_at DESC,w.watch_id DESC),'[]'::jsonb) INTO v_items
  FROM (SELECT * FROM public.user_watched_products WHERE user_id=auth.uid()
    ORDER BY created_at DESC,watch_id DESC LIMIT p_page_size OFFSET (p_page-1)*p_page_size) w;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'items',v_items,'total',v_total,'page',p_page,'page_size',p_page_size,
    'total_pages',greatest(1,ceil(v_total::numeric/p_page_size)::integer));
END $$;
REVOKE ALL ON FUNCTION evidence_private.watched_products(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION evidence_private.watched_products(integer,integer,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_watched_products_read_model(p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.watched_products(p_page,p_page_size,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_watched_products_read_model(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_watched_products_read_model(integer,integer,text) TO authenticated,service_role;

-- An old list/export client can coerce a null score into 100. Return a
-- deterministic error, never a v1 success envelope with null numeric fields.
CREATE OR REPLACE FUNCTION public.api_get_list_items(p_list_id uuid,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'error','refresh_required','status','refresh_required',
    'message','Refresh TryVit to use source-backed product evidence.');
$$;
REVOKE ALL ON FUNCTION public.api_get_list_items(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_list_items(uuid,integer,integer) TO authenticated,service_role;
COMMIT;
