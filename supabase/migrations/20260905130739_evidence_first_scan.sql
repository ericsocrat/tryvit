-- Keep the proven scan-history/rate-limit transaction, but do not publish its
-- legacy scoring payload. The previous public entrypoint becomes refresh-only.
BEGIN;
ALTER FUNCTION public.api_record_scan(text,text) SET SCHEMA evidence_private;
ALTER FUNCTION evidence_private.api_record_scan(text,text) RENAME TO record_scan_transaction;
REVOKE ALL ON FUNCTION evidence_private.record_scan_transaction(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION evidence_private.record_scan_transaction(text,text) TO service_role;

CREATE FUNCTION public.api_record_scan_v2(p_ean text,p_scan_country text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_product jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Authentication required'); END IF;
  IF p_ean IS NULL OR btrim(p_ean) !~ '^([0-9]{8}|[0-9]{13})$' THEN
    RETURN jsonb_build_object('error','EAN must be 8 or 13 digits');
  END IF;
  IF p_scan_country IS NOT NULL AND p_scan_country NOT IN ('PL','DE') THEN
    RETURN jsonb_build_object('error','Unsupported scan country');
  END IF;
  v_result:=evidence_private.record_scan_transaction(btrim(p_ean),p_scan_country);
  IF v_result ? 'error' THEN RETURN v_result; END IF;
  IF (v_result->>'found')::boolean THEN
    v_product:=evidence_private.product_one((v_result->>'product_id')::bigint,public.resolve_language(NULL));
    IF v_product IS NULL THEN RETURN jsonb_build_object('error','Product information unavailable'); END IF;
    RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1','found',true,
      'product',v_product,'scan_country',v_result->'scan_country');
  END IF;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1','found',false,
    'ean',btrim(p_ean),'has_pending_submission',v_result->'has_pending_submission','scan_country',v_result->'scan_country');
END $$;
REVOKE ALL ON FUNCTION public.api_record_scan_v2(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_record_scan_v2(text,text) TO authenticated,service_role;

CREATE FUNCTION public.api_record_scan(p_ean text,p_scan_country text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT jsonb_build_object('error','refresh_required','message','Refresh TryVit to use the evidence-first scanner.');
$$;
REVOKE ALL ON FUNCTION public.api_record_scan(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_record_scan(text,text) TO authenticated,service_role;
COMMENT ON FUNCTION public.api_record_scan_v2(text,text) IS
 'Authenticated v2 scan transaction. Preserves rate limit, history and cross-market warning; returns canonical evidence, never the historical score.';
-- Neutral owner-scoped scan history. Stable tie-breaking prevents duplicate or
-- skipped rows across pages that share a timestamp.
CREATE FUNCTION public.api_get_scan_history_v2(p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_filter text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=auth.uid(); v_total bigint; v_items jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('api_version','2','error','Authentication required'); END IF;
  IF p_page IS NULL OR p_page<1 OR p_page>10000 OR p_page_size IS NULL OR p_page_size<1 OR p_page_size>50
    OR p_filter IS NULL OR p_filter NOT IN ('all','found','not_found') THEN
    RETURN jsonb_build_object('api_version','2','error','Invalid scan history request');
  END IF;
  SELECT count(*) INTO v_total FROM public.scan_history sh WHERE sh.user_id=v_user
    AND (p_filter='all' OR (p_filter='found' AND sh.found) OR (p_filter='not_found' AND NOT sh.found));
  SELECT COALESCE(jsonb_agg(body ORDER BY scanned_at DESC,id DESC),'[]'::jsonb) INTO v_items FROM (
    SELECT sh.id,sh.scanned_at,jsonb_build_object(
      'scan_id',sh.id,'ean',sh.ean,'found',sh.found,'scanned_at',sh.scanned_at,
      'product_id',p.product_id,'product_name',p.product_name,'brand',p.brand,'category',p.category,
      'submission_status',(SELECT ps.status FROM public.product_submissions ps
        WHERE ps.user_id=v_user AND ps.ean=sh.ean
          AND ps.suggested_country IS NOT DISTINCT FROM COALESCE(sh.scan_country,p.country)
        ORDER BY ps.created_at DESC,ps.id DESC LIMIT 1)) AS body
    FROM public.scan_history sh LEFT JOIN public.products p ON p.product_id=sh.product_id
    WHERE sh.user_id=v_user
      AND (p_filter='all' OR (p_filter='found' AND sh.found) OR (p_filter='not_found' AND NOT sh.found))
    ORDER BY sh.scanned_at DESC,sh.id DESC LIMIT p_page_size OFFSET (p_page-1)*p_page_size
  ) selected;
  RETURN jsonb_build_object('api_version','2','policy_version','evidence-first-v1','total',v_total,'page',p_page,
    'pages',greatest(ceil(v_total::numeric/p_page_size),1),'page_size',p_page_size,'filter',p_filter,'scans',v_items);
END $$;
REVOKE ALL ON FUNCTION public.api_get_scan_history_v2(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_scan_history_v2(integer,integer,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.api_get_scan_history(p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_filter text DEFAULT 'all')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT jsonb_build_object('api_version','2','error','refresh_required','message','Refresh TryVit to read scan history without retired grades.');
$$;
REVOKE ALL ON FUNCTION public.api_get_scan_history(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.api_get_scan_history(integer,integer,text) TO authenticated,service_role;
COMMIT;
