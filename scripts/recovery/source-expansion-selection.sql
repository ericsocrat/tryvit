-- Read-only, privacy-safe ranking for the bounded PL source expansion cohort.
-- psql variables: source_head (40 hex), output is one canonical JSON value.
SET SESSION default_transaction_read_only = on;
SET SESSION standard_conforming_strings = on;

WITH quotas(category, quota) AS (VALUES
  ('Drinks',10),('Dairy',10),('Breakfast & Grain-Based',10),('Bread',6),('Sauces',6),
  ('Chips',8),('Seafood & Fish',8),('Sweets',8),('Meat',8),('Canned Goods',8),
  ('Frozen & Prepared',7),('Instant & Frozen',7),('Condiments',7),('Nuts, Seeds & Legumes',7),
  ('Baby',5),('Snacks',5),('Alcohol',3),('Spreads & Dips',8),('Cereals',5),
  ('Plant-Based & Alternatives',8),('Oils & Vinegars',6)
), linked AS (
  SELECT DISTINCT product_id FROM public.product_source_records
), event_views AS (
  SELECT p.product_id, count(*) n
  FROM public.analytics_events e JOIN public.products p
    ON e.event_data->>'product_id'=p.product_id::text
  WHERE e.event_name='product_viewed'
  GROUP BY p.product_id
), saved_views AS (
  SELECT product_id, count(*) n FROM public.user_product_views GROUP BY product_id
), scans AS (
  SELECT product_id, count(*) n FROM public.scan_history
  WHERE product_id IS NOT NULL AND found GROUP BY product_id
), compares AS (
  SELECT p.product_id, count(*) n
  FROM public.analytics_events e
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(e.event_data->'product_ids')='array'
      THEN e.event_data->'product_ids' ELSE '[]'::jsonb END
  ) value
  JOIN public.products p ON value=p.product_id::text
  WHERE e.event_name='compare_opened'
  GROUP BY p.product_id
), families AS (
  SELECT lower(btrim(brand)) brand_key, count(*) n
  FROM public.products
  WHERE NOT is_deprecated AND country='PL' AND nullif(btrim(brand),'') IS NOT NULL
  GROUP BY 1
), base AS (
  SELECT p.product_id,p.product_name,p.brand,p.country,p.category,p.ean,q.quota,
    coalesce(ev.n,0) event_views,coalesce(sv.n,0) saved_views,
    coalesce(sc.n,0) scans,coalesce(co.n,0) compares,
    coalesce(f.n,0) family_size,coalesce(p.data_completeness_pct,0) completeness,
    lower(btrim(p.brand)) brand_key,
    (coalesce(ev.n,0)*100 + coalesce(sv.n,0)*120 + coalesce(sc.n,0)*150
      + coalesce(co.n,0)*80 + least(coalesce(f.n,0),10)*3
      + coalesce(p.data_completeness_pct,0)/10
      + CASE WHEN p.ean LIKE '590%' THEN 5 ELSE 0 END) score
  FROM public.products p JOIN quotas q USING(category)
  LEFT JOIN linked l USING(product_id)
  LEFT JOIN event_views ev USING(product_id)
  LEFT JOIN saved_views sv USING(product_id)
  LEFT JOIN scans sc USING(product_id)
  LEFT JOIN compares co USING(product_id)
  LEFT JOIN families f ON f.brand_key=lower(btrim(p.brand))
  WHERE NOT p.is_deprecated AND p.country='PL' AND l.product_id IS NULL
    AND p.ean ~ '^[0-9]{8,14}$'
    AND nullif(btrim(p.product_name),'') IS NOT NULL
    AND nullif(btrim(p.brand),'') IS NOT NULL
    AND (SELECT count(*) FROM public.products peer
      WHERE peer.country=p.country AND peer.ean=p.ean)=1
    AND (SELECT count(*) FROM public.products peer
      WHERE peer.country=p.country AND NOT peer.is_deprecated
        AND lower(btrim(peer.brand))=lower(btrim(p.brand))
        AND lower(btrim(peer.product_name))=lower(btrim(p.product_name)))=1
), ranked AS (
  SELECT *,
    row_number() OVER(PARTITION BY category,brand_key ORDER BY score DESC,product_id) brand_category_rank,
    row_number() OVER(PARTITION BY brand_key ORDER BY score DESC,product_id) brand_global_rank
  FROM base
), diversified AS (
  SELECT *,row_number() OVER(PARTITION BY category ORDER BY score DESC,product_id) category_rank
  FROM ranked WHERE brand_category_rank<=2 AND brand_global_rank<=6
), chosen AS (
  SELECT * FROM diversified WHERE category_rank<=quota
), manifest AS (
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'profile','source-expansion-selection-v1',
    'sourceHead',:'source_head',
    'productionCheckedAt',now(),
    'selectedCount',count(*),
    'uniqueBrands',count(DISTINCT brand_key),
    'maxBrandConcentration',(SELECT max(n) FROM (SELECT brand_key,count(*) n FROM chosen GROUP BY brand_key)x),
    'members',jsonb_agg(jsonb_build_object(
      'productId',product_id,'productName',product_name,'brand',brand,
      'country',country,'category',category,'ean',ean,
      'currentSourceStatus','unlinked',
      'selectionRationale',jsonb_build_object(
        'validEan',true,'uniqueMarketEan',true,'uniqueActiveMarketName',true,
        'plMarket',true,'categoryQuota',quota,'categoryRank',category_rank,
        'eventViews',event_views,'savedViews',saved_views,'successfulScans',scans,
        'compareSelections',compares,'brandFamilySize',family_size,
        'catalogCompleteness',completeness,'diversityScore',score
      )
    ) ORDER BY category,category_rank,product_id)
  ) value FROM chosen
)
SELECT value::text FROM manifest;
