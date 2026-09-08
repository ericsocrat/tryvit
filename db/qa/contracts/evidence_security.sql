-- Session-local QA contracts, never deployed database objects. Load before the
-- consuming QA suite. Exact signatures prevent newly added overloads inheriting
-- an exception. Behavior is covered by the evidence-first/public-share pgTAP.
CREATE TEMP VIEW qa_reviewed_invokers AS
SELECT signature, anonymous, to_regprocedure('public.' || signature) AS oid
FROM (VALUES
 ('api_find_filter_options(text,text)',false),
 ('api_find_products(text,jsonb,integer,integer,boolean,text)',false),
 ('api_get_list_items(uuid,integer,integer)',false),
 ('api_product_read_model(bigint[],text)',false),
 ('api_saved_list_read_model(uuid,integer,integer,text)',false),
 ('api_watched_products_read_model(integer,integer,text)',false),
 ('api_get_shared_comparison(text)',true),
 ('api_get_shared_comparison_v2(text,text)',true),
 ('api_get_shared_list(text,integer,integer)',true),
 ('api_get_shared_list_v2(text,text,integer,integer)',true)
) reviewed(signature,anonymous);

CREATE TEMP VIEW qa_invoker_violations AS
SELECT signature FROM qa_reviewed_invokers r LEFT JOIN pg_proc p ON p.oid=r.oid
WHERE p.oid IS NULL OR p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR has_function_privilege('anon',p.oid,'EXECUTE') IS DISTINCT FROM r.anonymous
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
            WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
UNION ALL
SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'api_%' AND NOT p.prosecdef
 AND NOT EXISTS(SELECT 1 FROM qa_reviewed_invokers r WHERE r.oid=p.oid);

CREATE TEMP VIEW qa_default_deny_tables AS
SELECT name,to_regclass('public.'||name) AS oid FROM (VALUES
 ('ingestion_batches'),('product_source_records'),
 ('product_source_observations'),('product_source_assertions')) t(name);

CREATE TEMP VIEW qa_default_deny_violations AS
SELECT d.name FROM qa_default_deny_tables d LEFT JOIN pg_class c ON c.oid=d.oid
WHERE c.oid IS NULL OR NOT c.relrowsecurity OR c.relkind<>'r'
 OR EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid)
 OR EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated')) r(name)
   WHERE has_table_privilege(r.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_any_column_privilege(r.name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
 OR NOT (has_table_privilege('service_role',c.oid,'SELECT') AND has_table_privilege('service_role',c.oid,'INSERT')
     AND has_table_privilege('service_role',c.oid,'UPDATE') AND has_table_privilege('service_role',c.oid,'DELETE'));

-- A full FK key must be an equality-constrained leading B-tree key set, or a
-- unique index on a subset must bound the lookup to at most one referencing row.
-- A simple FK-column IS NOT NULL predicate is implied by FK equality and is
-- therefore sufficient. Other partial predicates, INCLUDE keys, expressions,
-- and invalid/unready indexes do not count. Legacy tables retain their existing
-- QA obligations; their more permissive historical checks need a separate audit.
CREATE FUNCTION pg_temp.qa_fk_index_support(fk smallint[], keys smallint[], is_unique boolean,
 is_valid boolean,is_ready boolean,predicate_implied boolean,no_expressions boolean,is_btree boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT is_valid AND is_ready AND predicate_implied AND no_expressions AND is_btree
 AND ((cardinality(keys)>=cardinality(fk) AND
       ARRAY(SELECT k FROM unnest(keys[1:cardinality(fk)]) k ORDER BY k)=
       ARRAY(SELECT k FROM unnest(fk) k ORDER BY k))
      OR (is_unique AND cardinality(keys)>0 AND keys <@ fk));
$$;
CREATE TEMP VIEW qa_missing_fk_indexes AS
SELECT con.oid,con.conrelid,con.conname FROM pg_constraint con
JOIN pg_namespace n ON n.oid=con.connamespace
WHERE n.nspname='public' AND con.contype='f'
 AND con.conrelid IN (SELECT oid FROM qa_default_deny_tables)
 AND NOT EXISTS (
  SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_am am ON am.oid=idx.relam
  WHERE i.indrelid=con.conrelid AND pg_temp.qa_fk_index_support(con.conkey,
   ARRAY(SELECT k FROM unnest(i.indkey::smallint[]) WITH ORDINALITY u(k,pos) WHERE pos<=i.indnkeyatts),
   i.indisunique,i.indisvalid,i.indisready,
   (i.indpred IS NULL OR EXISTS(SELECT 1 FROM pg_attribute a
       WHERE a.attrelid=con.conrelid AND a.attnum=ANY(con.conkey)
         AND pg_get_expr(i.indpred,i.indrelid)='('||quote_ident(a.attname)||' IS NOT NULL)')),
   i.indexprs IS NULL,am.amname='btree')
 );
