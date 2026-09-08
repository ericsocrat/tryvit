-- Migration: Token-gated evidence reads; no sharing-enable or user-data mutation.
-- Rollback: Retain token gating; never restore enumerable public table RLS.
BEGIN;

-- Possessing a token authorizes one RPC read, not enumeration of every shared
-- row. The old PUBLIC policies exposed tokens, owner IDs and private item notes.
DROP POLICY IF EXISTS "Public read via share token" ON public.user_comparisons;
DROP POLICY IF EXISTS "Public read shared lists" ON public.user_product_lists;
DROP POLICY IF EXISTS "Public read items in shared lists" ON public.user_product_list_items;
REVOKE SELECT ON public.user_comparisons, public.user_product_lists,
  public.user_product_list_items FROM PUBLIC, anon;
-- Authenticated owner policies and their direct grants remain unchanged.

GRANT USAGE ON SCHEMA evidence_private TO anon;

CREATE FUNCTION evidence_private.shared_list(
  p_share_token text,p_language text,p_limit integer,p_offset integer
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_name text; v_total integer; v_selected integer; v_products jsonb;
BEGIN
  IF p_share_token IS NULL OR p_share_token !~ '^[-A-Za-z0-9+/_=]{16,128}$' THEN
    RETURN jsonb_build_object('api_version','2','error','invalid_share');
  END IF;
  IF p_language IS NULL OR p_language NOT IN ('en','pl','de') OR p_limit IS NULL
    OR p_limit NOT BETWEEN 1 AND 50 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
    RETURN jsonb_build_object('api_version','2','error','invalid_request');
  END IF;
  SELECT id,name INTO v_id,v_name FROM public.user_product_lists
    WHERE share_token=p_share_token AND share_enabled=true AND list_type<>'avoid';
  IF NOT FOUND THEN RETURN jsonb_build_object('api_version','2','error','invalid_share'); END IF;

  SELECT count(*),count(*) FILTER(WHERE p.product_id IS NOT NULL AND p.is_deprecated IS NOT TRUE)
    INTO v_selected,v_total FROM public.user_product_list_items li
    LEFT JOIN public.products p ON p.product_id=li.product_id WHERE li.list_id=v_id;
  SELECT COALESCE(jsonb_agg(evidence_private.product_one(i.product_id,p_language)
    ORDER BY i.position,i.added_at,i.product_id),'[]'::jsonb) INTO v_products
  FROM (SELECT li.product_id,li.position,li.added_at FROM public.user_product_list_items li
    JOIN public.products p ON p.product_id=li.product_id AND p.is_deprecated IS NOT TRUE
    WHERE li.list_id=v_id ORDER BY li.position,li.added_at,li.product_id
    LIMIT p_limit OFFSET p_offset) i;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'kind','list','title',v_name,'total_count',v_total,'unavailable_count',v_selected-v_total,
    'limit',p_limit,'offset',p_offset,'products',v_products);
END $$;
REVOKE ALL ON FUNCTION evidence_private.shared_list(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.shared_list(text,text,integer,integer) TO anon,authenticated,service_role;

CREATE FUNCTION evidence_private.shared_comparison(p_share_token text,p_language text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_title text; v_ids bigint[]; v_products jsonb; v_selected integer; v_count integer;
BEGIN
  IF p_share_token IS NULL OR p_share_token !~ '^[-A-Za-z0-9+/_=]{16,128}$' THEN
    RETURN jsonb_build_object('api_version','2','error','invalid_share');
  END IF;
  IF p_language IS NULL OR p_language NOT IN ('en','pl','de') THEN
    RETURN jsonb_build_object('api_version','2','error','invalid_request');
  END IF;
  SELECT product_ids,title INTO v_ids,v_title FROM public.user_comparisons
    WHERE share_token=p_share_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('api_version','2','error','invalid_share'); END IF;
  IF cardinality(v_ids)>4 OR cardinality(v_ids)<1 OR EXISTS(SELECT 1 FROM unnest(v_ids) id WHERE id IS NULL OR id<=0) THEN
    RETURN jsonb_build_object('api_version','2','error','invalid_request');
  END IF;
  WITH requested AS (SELECT id,min(position) AS position FROM unnest(v_ids)
    WITH ORDINALITY AS requested(id,position) GROUP BY id)
  SELECT count(*),count(p.product_id),COALESCE(jsonb_agg(evidence_private.product_one(p.product_id,p_language)
    ORDER BY r.position) FILTER(WHERE p.product_id IS NOT NULL),'[]'::jsonb)
    INTO v_selected,v_count,v_products FROM requested r
    LEFT JOIN public.products p ON p.product_id=r.id AND p.is_deprecated IS NOT TRUE;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1',
    'kind','comparison','title',v_title,'product_count',v_count,
    'unavailable_count',v_selected-v_count,'products',v_products);
END $$;
REVOKE ALL ON FUNCTION evidence_private.shared_comparison(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.shared_comparison(text,text) TO anon,authenticated,service_role;

CREATE FUNCTION public.api_get_shared_list_v2(p_share_token text,p_language text DEFAULT 'en',
  p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.shared_list(p_share_token,p_language,p_limit,p_offset);
$$;
REVOKE ALL ON FUNCTION public.api_get_shared_list_v2(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_get_shared_list_v2(text,text,integer,integer) TO anon,authenticated,service_role;
CREATE FUNCTION public.api_get_shared_comparison_v2(p_share_token text,p_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT evidence_private.shared_comparison(p_share_token,p_language);
$$;
REVOKE ALL ON FUNCTION public.api_get_shared_comparison_v2(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_get_shared_comparison_v2(text,text) TO anon,authenticated,service_role;

-- Old clients receive an explicit contract retirement, never nullable scores
-- that can be interpreted as reassuring zeroes. Existing share URLs are kept.
CREATE OR REPLACE FUNCTION public.api_get_shared_list(p_share_token text,
  p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('api_version','2','error','share_client_refresh_required');
$$;
CREATE OR REPLACE FUNCTION public.api_get_shared_comparison(p_share_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('api_version','2','error','share_client_refresh_required');
$$;
REVOKE ALL ON FUNCTION public.api_get_shared_list(text,integer,integer),
  public.api_get_shared_comparison(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_get_shared_list(text,integer,integer),
  public.api_get_shared_comparison(text) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.api_get_shared_list_v2(text,text,integer,integer) IS
  'Read-only token-gated source facts. Owner/list/item IDs, notes, description and score rankings are never returned. Sharing disable/revocation is checked on every read.';
COMMENT ON FUNCTION public.api_get_shared_comparison_v2(text,text) IS
  'Read-only token-gated source facts for up to four catalog products. No user/comparison ID or creation timestamp. Deletion or token rotation revokes future reads.';
-- Saving privately and explicit sharing must work before the consumer cutover.
CREATE OR REPLACE FUNCTION public.api_save_comparison(p_product_ids bigint[],p_title text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=auth.uid(); v_id uuid; v_count integer:=cardinality(p_product_ids); v_rate jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('api_version','1.0','error','Authentication required'); END IF;
  IF COALESCE(v_count,0)<2 OR v_count>4 OR array_ndims(p_product_ids)<>1
    OR EXISTS(SELECT 1 FROM unnest(p_product_ids) AS requested(id) WHERE id IS NULL OR id<=0)
    OR v_count<>(SELECT count(DISTINCT id) FROM unnest(p_product_ids) AS requested(id)) THEN
    RETURN jsonb_build_object('api_version','1.0','error','Please provide between 2 and 4 distinct product IDs');
  END IF;
  IF v_count<>(SELECT count(*) FROM public.products WHERE product_id=ANY(p_product_ids)) THEN
    RETURN jsonb_build_object('api_version','1.0','error','A selected product is unavailable');
  END IF;
  v_rate:=public.check_api_rate_limit(v_user,'api_save_comparison');
  IF (v_rate->>'allowed')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('api_version','1.0','error','Rate limit exceeded for comparisons');
  END IF;
  -- There is no share-request parameter in this contract. A saved comparison
  -- must not silently become reachable through the public token reader.
  INSERT INTO public.user_comparisons(user_id,product_ids,title,share_token)
  VALUES(v_user,p_product_ids,p_title,NULL) RETURNING id INTO v_id;
  RETURN jsonb_build_object('api_version','1.0','comparison_id',v_id,
    'share_token',NULL,'product_ids',p_product_ids,'title',p_title);
END $$;
REVOKE ALL ON FUNCTION public.api_save_comparison(bigint[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_save_comparison(bigint[],text) TO authenticated,service_role;
COMMENT ON FUNCTION public.api_save_comparison(bigint[],text) IS
  'Save an owner-private selection of 2-4 products. Does not generate a share token or publish. Existing shared records are unchanged.';

-- The installed pgcrypto extension owns gen_random_bytes in extensions.
-- Keep existing explicit enable, ownership, Avoid-list, rate and quota checks.
CREATE OR REPLACE FUNCTION public.api_toggle_share(
  p_list_id   uuid,
  p_enabled   boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id      uuid;
  v_token        text;
  v_list         record;
  v_share_check  jsonb;
  v_rate_check   jsonb;
  v_item_count   integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'api_version', '1.0',
      'error', 'Authentication required'
    );
  END IF;

  IF p_enabled IS NULL THEN
    RETURN jsonb_build_object('api_version','1.0','error','Sharing choice is required');
  END IF;

  -- Ownership check
  SELECT id, share_token, list_type INTO v_list
  FROM public.user_product_lists
  WHERE id = p_list_id AND user_id = v_user_id;

  IF v_list.id IS NULL THEN
    RETURN jsonb_build_object(
      'api_version', '1.0',
      'error', 'List not found'
    );
  END IF;

  -- Cannot share the Avoid list
  IF v_list.list_type = 'avoid' THEN
    RETURN jsonb_build_object(
      'api_version', '1.0',
      'error', 'Cannot share the Avoid list'
    );
  END IF;

  IF p_enabled THEN
    -- Content validation: list must have at least 1 item to share
    SELECT COUNT(*) INTO v_item_count
    FROM public.user_product_list_items
    WHERE list_id = p_list_id;

    IF v_item_count = 0 THEN
      RETURN jsonb_build_object(
        'api_version', '1.0',
        'error', 'Cannot share an empty list'
      );
    END IF;

    -- Rate limit check
    v_rate_check := public.check_api_rate_limit(v_user_id, 'api_toggle_share');
    IF NOT (v_rate_check ->> 'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'api_version', '1.0',
        'error', 'Rate limit exceeded for sharing'
      );
    END IF;

    -- Share limit check
    v_share_check := public.check_share_limit(v_user_id, 'list');
    IF NOT (v_share_check ->> 'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'api_version', '1.0',
        'error', 'Share limit reached (max 50 shared lists)'
      );
    END IF;

    -- Generate new token on first enable (or if missing)
    IF v_list.share_token IS NULL THEN
      v_token := encode(extensions.gen_random_bytes(18), 'base64');
      v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    ELSE
      v_token := v_list.share_token;
    END IF;

    UPDATE public.user_product_lists
    SET share_enabled = p_enabled,
        share_token   = v_token
    WHERE id = p_list_id AND user_id = v_user_id;
  ELSE
    -- Disable sharing
    UPDATE public.user_product_lists
    SET share_enabled = false
    WHERE id = p_list_id AND user_id = v_user_id;
    v_token := NULL;
  END IF;

  RETURN jsonb_build_object(
    'api_version', '1.0',
    'share_enabled', p_enabled,
    'share_token', CASE WHEN p_enabled THEN v_token ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_revoke_share(p_list_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('api_version','1.0','error','Authentication required'); END IF;
  -- Clearing the capability invalidates old links. Later explicit enable
  -- generates a fresh URL-safe token; revocation needs no new secret.
  UPDATE public.user_product_lists SET share_enabled=false,share_token=NULL
  WHERE id=p_list_id AND user_id=v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('api_version','1.0','error','List not found'); END IF;
  RETURN jsonb_build_object('api_version','1.0','success',true);
END $$;
REVOKE ALL ON FUNCTION public.api_revoke_share(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_revoke_share(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
