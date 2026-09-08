/** Render captured metadata only for an isolated empty managed-schema bootstrap. */
const q=x=>'"'+String(x).replaceAll('"','""')+'"';
const managed=new Set(['auth','storage','realtime','supabase_migrations']);
export function managedBootstrap(source,supplement){
 const statements=[];
 for(const schema of ['auth','storage','realtime','supabase_migrations'])statements.push(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE;`);
 for(const schema of supplement.schemas)if(managed.has(schema.name))statements.push(`CREATE SCHEMA ${q(schema.name)} AUTHORIZATION ${q(schema.owner)};`);
 for(const type of supplement.types.filter(t=>managed.has(t.schema)&&t.kind==='e'))
  statements.push(`CREATE TYPE ${q(type.schema)}.${q(type.name)} AS ENUM (${type.labels.map(s=>"'"+s.replaceAll("'","''")+"'").join(',')});`);
 for(const type of supplement.types.filter(t=>managed.has(t.schema)&&t.kind==='c'))
  statements.push(`CREATE TYPE ${q(type.schema)}.${q(type.name)} AS (${type.attributes.map(a=>q(a.name)+' '+a.type).join(',')});`);
 const tables=source.filter(t=>managed.has(t.schema));
 const identitySequences=new Set(tables.flatMap(t=>t.columns.filter(c=>c.identity).map(c=>t.schema+'.'+t.name+'_'+c.name+'_seq')));
 for(const sequence of supplement.sequences.filter(s=>managed.has(s.schema)&&!identitySequences.has(s.schema+'.'+s.name)))
  statements.push(`CREATE SEQUENCE ${q(sequence.schema)}.${q(sequence.name)} AS ${sequence.type} INCREMENT ${sequence.increment}
   MINVALUE ${sequence.minimum} MAXVALUE ${sequence.maximum} START ${sequence.start} CACHE ${sequence.cache} ${sequence.cycle?'':'NO '}CYCLE;`);
 // Check-function-bodies is local reconstruction behavior, not a forward lint waiver.
 for(const fn of supplement.functions.filter(f=>managed.has(f.schema)))statements.push('SET check_function_bodies=off;\n'+fn.definition);
 const partitions=new Map(supplement.partitions.map(p=>[p.schema+'.'+p.name,p]));
 for(const table of tables.filter(t=>!partitions.get(t.schema+'.'+t.name)?.partition)){
  const partition=partitions.get(table.schema+'.'+table.name);
  const cols=table.columns.map(c=>q(c.name)+' '+c.type+
    (c.generated?` GENERATED ALWAYS AS (${c.default}) STORED`:c.identity?` GENERATED ${c.identity==='a'?'ALWAYS':'BY DEFAULT'} AS IDENTITY`:c.default?' DEFAULT '+c.default:'')+
    (c.notNull?' NOT NULL':'')).join(',\n');
  statements.push(`CREATE TABLE ${q(table.schema)}.${q(table.name)} (${cols})${partition?.key?' PARTITION BY '+partition.key:''};`);
 }
 for(const table of tables.filter(t=>partitions.get(t.schema+'.'+t.name)?.partition)){
  const p=partitions.get(table.schema+'.'+table.name);
  statements.push(`CREATE TABLE ${q(table.schema)}.${q(table.name)} PARTITION OF ${p.parent} ${p.bound};`);
 }
 for(const table of tables){
  statements.push(`ALTER TABLE ${q(table.schema)}.${q(table.name)} OWNER TO ${q(table.owner)};`);
  for(const c of table.constraints||[])if(/^(PRIMARY KEY|UNIQUE)\b/u.test(c.definition))
    statements.push(`DO $key$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='${q(table.schema)}.${q(table.name)}'::regclass
      AND conname='${c.name.replaceAll("'","''")}') THEN ALTER TABLE ${q(table.schema)}.${q(table.name)} ADD CONSTRAINT ${q(c.name)} ${c.definition}; END IF; END $key$;`);
  // Constraints/indexes/triggers are restored after historical application so
  // repository migrations can establish their original conditional policies.
 }
 return statements;
}
export function managedFinish(source,supplement){
 const statements=[];
 for(const fn of supplement.functions){
  statements.push('SET check_function_bodies=off;\n'+fn.definition);
  const signature=q(fn.schema)+'.'+q(fn.name)+'('+fn.args+')';
  statements.push(`DO $extension$ DECLARE ext text; routine regprocedure; BEGIN
    SELECT p.oid::regprocedure INTO STRICT routine FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='${fn.schema.replaceAll("'","''")}' AND p.proname='${fn.name.replaceAll("'","''")}'
      AND pg_get_function_identity_arguments(p.oid)='${fn.args.replaceAll("'","''")}';
    SELECT e.extname INTO ext FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
    WHERE d.classid='pg_proc'::regclass AND d.objid=routine AND d.deptype='e';
    IF ext IS NOT NULL THEN EXECUTE format('ALTER EXTENSION %I DROP FUNCTION %s',ext,routine); END IF; END $extension$;`);
  statements.push(`ALTER FUNCTION ${q(fn.schema)}.${q(fn.name)}(${fn.args}) OWNER TO ${q(fn.owner)};`);
 }
 for(const sequence of supplement.sequences.filter(s=>managed.has(s.schema)))
  statements.push(`ALTER SEQUENCE ${q(sequence.schema)}.${q(sequence.name)} OWNER TO ${q(sequence.owner)};`);
 for(const table of source.filter(t=>managed.has(t.schema))){
  for(const c of table.constraints||[])statements.push(`DO $c$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='${q(table.schema)}.${q(table.name)}'::regclass AND conname='${c.name.replaceAll("'","''")}') THEN
   ALTER TABLE ${q(table.schema)}.${q(table.name)} ADD CONSTRAINT ${q(c.name)} ${c.definition};
   END IF; END $c$;`);
  for(const c of table.constraints||[])if(c.validated&&/^(CHECK|FOREIGN KEY)/u.test(c.definition))
   statements.push(`ALTER TABLE ONLY ${q(table.schema)}.${q(table.name)} VALIDATE CONSTRAINT ${q(c.name)};`);
  for(const index of table.indexes||[])statements.push(index.replace(/^CREATE (UNIQUE )?INDEX /u,(_,unique)=>'CREATE '+(unique||'')+'INDEX IF NOT EXISTS ')+';');
  for(const trigger of table.triggers||[])statements.push(trigger.replace(/^CREATE TRIGGER /u,'CREATE OR REPLACE TRIGGER ')+';');
  statements.push(`ALTER TABLE ${q(table.schema)}.${q(table.name)} ${table.rls?'ENABLE':'DISABLE'} ROW LEVEL SECURITY;
    ALTER TABLE ${q(table.schema)}.${q(table.name)} ${table.forceRls?'FORCE':'NO FORCE'} ROW LEVEL SECURITY;`);
 }
 return statements;
}
export function canonicalGrantRows(rows){
 return rows.map(row=>({...row,grants:[...row.grants].sort((a,b)=>
   JSON.stringify([a.grantor,a.grantee,a.privilege,a.grantable]).localeCompare(JSON.stringify([b.grantor,b.grantee,b.privilege,b.grantable]),'en'))}))
   .sort((a,b)=>JSON.stringify([a.kind,a.schema,a.name]).localeCompare(JSON.stringify([b.kind,b.schema,b.name]),'en'));
}
export function restoreCapturedGrants(rows,authority,sourceSchema){
 const statements=[],targets=['PUBLIC',...authority.roles.map(r=>q(r.name))].join(',');
 const tables=new Set(sourceSchema.map(t=>t.schema+'.'+t.name));
 const defaults={r:'TABLES',S:'SEQUENCES',f:'FUNCTIONS',T:'TYPES',n:'SCHEMAS'};
 statements.push(`ALTER DATABASE postgres OWNER TO ${q(authority.database.owner)};`);
 const order={database:0,schema:1,default:2,relation:3,function:4,column:5};
 for(const row of [...rows].sort((a,b)=>order[a.kind]-order[b.kind])){
  let target,column='',prefix='',owner;
  if(row.kind==='column'){
   if(!row.grants.length)continue;
   const dot=row.name.indexOf('.');target='TABLE '+q(row.schema)+'.'+q(row.name.slice(0,dot));column=' ('+q(row.name.slice(dot+1))+')';
  }else if(row.kind==='relation')target=(tables.has(row.schema+'.'+row.name)?'TABLE ':'SEQUENCE ')+q(row.schema)+'.'+q(row.name);
  else if(row.kind==='function'){
   const i=row.name.indexOf('(');target='ROUTINE '+q(row.schema)+'.'+q(row.name.slice(0,i))+row.name.slice(i);
  }else if(row.kind==='schema')target='SCHEMA '+q(row.name);
  else if(row.kind==='database')target='DATABASE '+q(row.name);
  else if(row.kind==='default'){
   const i=row.name.lastIndexOf(':');owner=row.name.slice(0,i);target=defaults[row.name.slice(i+1)];
   if(!target)throw Error('unsupported_default_acl_kind');
   prefix=`ALTER DEFAULT PRIVILEGES FOR ROLE ${q(owner)}${row.schema?' IN SCHEMA '+q(row.schema):''} `;
  }else throw Error('unsupported_captured_acl_kind');
  statements.push(`${prefix}REVOKE ALL${column} ON ${target} FROM ${targets};`);
  for(const g of row.grants){
   if(!/^[A-Z ]+$/u.test(g.privilege))throw Error('invalid_captured_acl_privilege');
   statements.push(`BEGIN; SET LOCAL ROLE ${q(g.grantor)}; ${prefix}GRANT ${g.privilege}${column} ON ${target} TO ${g.grantee==='PUBLIC'?'PUBLIC':q(g.grantee)}${g.grantable?' WITH GRANT OPTION':''}; COMMIT;`);
  }
 }
 return statements;
}
export function missingPolicySql(policies){
 return policies.map(p=>`DO $p$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='${p.schema.replaceAll("'","''")}'
  AND tablename='${p.table.replaceAll("'","''")}' AND policyname='${p.name.replaceAll("'","''")}') THEN
  CREATE POLICY ${q(p.name)} ON ${q(p.schema)}.${q(p.table)} AS ${p.permissive} FOR ${p.command}
  TO ${p.roles.map(r=>r==='public'?'PUBLIC':q(r)).join(',')}${p.using?' USING ('+p.using+')':''}${p.check?' WITH CHECK ('+p.check+')':''};
  END IF; END $p$;`);
}
