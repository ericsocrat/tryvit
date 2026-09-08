-- Local canonical-API smoke bounds, not production p95 or a retired-shim benchmark.
-- The fixture contains 100 distinct products; all results are consumed before timing ends.
BEGIN;
CREATE TEMP TABLE qa_identity AS SELECT gen_random_uuid() uid;
INSERT INTO auth.users(id) SELECT uid FROM qa_identity;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) FROM qa_identity;

INSERT INTO public.user_preferences(user_id,country,diet_preference,preferred_language)
SELECT uid,'PL','none','en' FROM qa_identity ON CONFLICT(user_id) DO UPDATE SET country='PL',diet_preference='none',preferred_language='en';
CREATE TEMP TABLE qa_perf_products AS WITH added AS (
 INSERT INTO public.products(country,brand,product_name,category)
 SELECT 'PL',uid::text,'QA performance '||g,'Dairy' FROM qa_identity CROSS JOIN generate_series(1,100) g
 RETURNING product_id) SELECT product_id FROM added;
CREATE TEMP TABLE qa_timings(n integer PRIMARY KEY,elapsed interval,payload jsonb);
DO $measure$
DECLARE started timestamptz; result jsonb; ids bigint[]; label text;
BEGIN
 SELECT array_agg(product_id ORDER BY product_id) INTO ids FROM qa_perf_products;
 SELECT uid::text INTO label FROM qa_identity;
 started:=clock_timestamp(); result:=public.api_find_products(label,'{}',1,20,false,'en');
 INSERT INTO qa_timings VALUES(1,clock_timestamp()-started,result);
 started:=clock_timestamp(); result:=public.api_find_filter_options('PL','en');
 INSERT INTO qa_timings VALUES(2,clock_timestamp()-started,result);
 started:=clock_timestamp(); result:=public.api_find_products(label,'{"category":["Dairy"],"country":"PL"}',1,20,false,'en');
 INSERT INTO qa_timings VALUES(3,clock_timestamp()-started,result);
 started:=clock_timestamp(); result:=public.api_product_read_model(ids[1:1],'en');
 INSERT INTO qa_timings VALUES(4,clock_timestamp()-started,result);
 started:=clock_timestamp(); result:=public.api_product_read_model(ids,'en');
 INSERT INTO qa_timings VALUES(5,clock_timestamp()-started,result);
 started:=clock_timestamp(); result:=public.api_product_read_model(ids[1:4],'en');
 INSERT INTO qa_timings VALUES(6,clock_timestamp()-started,result);
END $measure$;
SELECT '1. canonical search completes with real results in under 5s' AS check_name,CASE WHEN elapsed<interval '5 seconds' AND payload->>'api_version'='2' AND payload->>'total'='100' AND jsonb_array_length(payload->'results')=20 THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=1;
SELECT '2. current filter options complete in under 3s' AS check_name,CASE WHEN elapsed<interval '3 seconds' AND payload->>'api_version'='2' AND jsonb_typeof(payload->'categories')='array' THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=2;
SELECT '3. canonical category search completes in under 5s' AS check_name,CASE WHEN elapsed<interval '5 seconds' AND payload->>'api_version'='2' AND payload->>'total'='100' THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=3;
SELECT '4. canonical detail completes in under 2s' AS check_name,CASE WHEN elapsed<interval '2 seconds' AND payload->>'api_version'='2' AND jsonb_array_length(payload->'products')=1 THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=4;
SELECT '5. 100 distinct canonical products read in under 5s' AS check_name,CASE WHEN elapsed<interval '5 seconds' AND payload->>'api_version'='2' AND jsonb_array_length(payload->'products')=100 THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=5;
SELECT '6. four-product comparison input completes in under 5s' AS check_name,CASE WHEN elapsed<interval '5 seconds' AND payload->>'api_version'='2' AND jsonb_array_length(payload->'products')=4 THEN 0 ELSE 1 END AS violations FROM qa_timings WHERE n=6;
ROLLBACK;
