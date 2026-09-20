-- Read-only post-release matrix. No user identities, preferences, writes or source mutation.
WITH corpus(label,product_id,query) AS (VALUES
  ('known-156',156::bigint,'5900697040172'),('known-343',343::bigint,'5903895631418'),
  ('known-3065',3065::bigint,'5900001421635'),('old-2995',2995::bigint,'5900001421697'),
  ('new-77',77::bigint,'5900014005105'),('new-308',308::bigint,'5901713001795'),
  ('new-554',554::bigint,'5900783003043'),('legacy-62',62::bigint,'5900910010906'),
  ('graal-variant',1063::bigint,'Graal Tuńczyk'),('go-vege-family',2995::bigint,'Go Vege')
), active AS (
  SELECT p.*,lower(public.unaccent(regexp_replace(btrim(p.brand)||' '||btrim(p.product_name),'\s+',' ','g'))) AS normalized_identity
  FROM public.products p WHERE p.is_deprecated IS NOT TRUE
), rows AS (
  SELECT c.label,c.product_id,c.query,p.country,p.ean,p.brand,p.product_name,
    p.country='PL' AND p.ean=c.query AS exact_ean_current_market,
    (SELECT count(*) FROM active a WHERE a.country=p.country AND a.normalized_identity=lower(public.unaccent(regexp_replace(btrim(p.brand)||' '||btrim(p.product_name),'\s+',' ','g')))) AS normalized_identity_count,
    EXISTS(SELECT 1 FROM public.product_source_records r WHERE r.product_id=p.product_id AND r.selected_observation_id IS NOT NULL) AS source_linked
  FROM corpus c JOIN public.products p ON p.product_id=c.product_id
)
SELECT jsonb_build_object(
  'schema_version',1,
  'active_pl',(SELECT count(*) FROM active WHERE country='PL'),
  'valid_unique_pl_eans',(SELECT count(*) FROM (SELECT ean FROM active WHERE country='PL' AND ean~'^[0-9]{8,14}$' GROUP BY ean HAVING count(*)=1)x),
  'active_null_search_vectors',(SELECT count(*) FROM active WHERE search_vector IS NULL),
  'rows',(SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY label),'[]'::jsonb) FROM rows)
);
