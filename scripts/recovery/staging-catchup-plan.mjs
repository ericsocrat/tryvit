/** Offline preparation only. Never connects to a database or provisions credentials. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const PROJECT = 'rxtaicdpnaqigowdbmsb';
export const BASE = '7a67dc9085e07c6c0b4353b42d2c006787a1c6f0';
export const VERSIONS = Object.freeze(['20260601000000','20260601010000','20260601173035',
  '20260605223000','20260730173135','20260827010801','20260904150259',
  '20260904150300','20260904164332','20260904172653']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, code) => { if (!condition) throw new Error(code); };
const git = args => execFileSync('git', args, {cwd:ROOT, maxBuffer:32*1024*1024});

export function makePlan() {
  const files = git(['ls-tree','-r','--name-only',BASE,'--','supabase/migrations']).toString()
    .trim().split('\n').filter(p => /\/\d{14}_[a-z0-9_]+\.sql$/u.test(p)).sort();
  check(files.length === 237, 'baseline-source-count-changed');
  const baseline = files.filter(p => !VERSIONS.includes(path.basename(p).slice(0,14)));
  const migrations = VERSIONS.map(version => {
    const matches = files.filter(p => path.basename(p).startsWith(version+'_'));
    check(matches.length === 1, 'catchup-source-missing-or-ambiguous');
    const p = matches[0], bytes = git(['show',`${BASE}:${p}`]);
    check(digest(fs.readFileSync(path.join(ROOT,p))) === digest(bytes), 'historical-migration-worktree-drift');
    const roleControl = /\b(?:reset\s+role|set\s+(?:(?:local|session)\s+)?role|session_authorization|granted\s+by)\b/iu.test(bytes.toString());
    check(!roleControl, 'catchup-role-control-requires-review');
    return {path:p,sha256:digest(bytes),bytes:bytes.length};
  });
  check(baseline.length === 227, 'staging-baseline-count-changed');
  return {schemaVersion:1, environment:'staging', projectRef:PROJECT, sourceCommit:BASE,
    result:'PREPARED_NOT_CAPTURED_OR_RESTORED', baselineVersions:baseline.map(p=>path.basename(p).slice(0,14)),
    migrations, migrationSetSha256:digest(JSON.stringify(migrations)), remoteReads:false,remoteWrites:false,
    beforeImageColumns:{products:['product_id','ingredient_concern_score','updated_at'],
      ingredient_ref:['ingredient_id','concern_tier','is_additive','concern_reason','updated_at'],
      product_allergen_info:['product_id','tag','type','updated_at']},
    insertedKeySets:['ingredient_ref(ingredient_id)','product_ingredient(product_id,ingredient_id,position)',
      'product_allergen_info(product_id,tag,type)','product_change_log(id)','mv_refresh_log(refresh_id)'],
    sequenceState:['ingredient_ref_ingredient_id_seq','product_change_log_id_seq','mv_refresh_log_refresh_id_seq'],
    materializedViews:['mv_ingredient_frequency','v_product_confidence','mv_product_similarity','v_data_coverage_summary','mv_scoring_distribution'],
    blockers:['staging-only-direct-credential-and-verified-tls-snapshot-not-available',
      'actual-staging-schema-and-approved-catalog-archive-not-captured',
      'before-images-and-inserted-key-journal-not-captured',
      'isolated-restore-apply-rollback-and-permission-equality-not-executed',
      'quiescent-staging-window-and-materialized-cache-recovery-disposition-required'],
    exclusions:['private-user-rows','auth-identities-and-sessions','historical-audit-actor-values',
      'storage-objects','full-database-recovery','subsequent-foundation-migrations']};
}

// One SELECT only: no temporary roles, session changes, private rows, SQL bodies,
// credentials, or sequence advancement. Execute only via a verified staging
// connector. This metadata is preparation evidence, never a backup.
export const METADATA_SQL = `SELECT jsonb_build_object(
  'baselineVersions',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
  'triggerDefinitions',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,
    'trigger',pg_get_triggerdef(t.oid),'functionSha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))
    ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN
    ('products','ingredient_ref','product_ingredient','product_allergen_info','product_change_log','mv_refresh_log')),
  'sequenceState',jsonb_build_object(
    'ingredient_ref_ingredient_id_seq',(SELECT jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) FROM public.ingredient_ref_ingredient_id_seq),
    'product_change_log_id_seq',(SELECT jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) FROM public.product_change_log_id_seq),
    'mv_refresh_log_refresh_id_seq',(SELECT jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) FROM public.mv_refresh_log_refresh_id_seq)),
  'privateRowExports',false) AS metadata;`;

export function validateMetadata(plan, metadata) {
  check(JSON.stringify(metadata.baselineVersions) === JSON.stringify(plan.baselineVersions), 'staging-ledger-does-not-match-exact-227-baseline');
  check(metadata.privateRowExports === false, 'metadata-scope-invalid');
  check(Array.isArray(metadata.triggerDefinitions) && metadata.triggerDefinitions.length > 0, 'trigger-metadata-missing');
  for (const name of plan.sequenceState) {
    const state = metadata.sequenceState?.[name];
    check(state && (typeof state.lastValue === 'string' || Number.isSafeInteger(state.lastValue)) &&
      /^(?:0|[1-9]\d*)$/u.test(String(state.lastValue)) && typeof state.isCalled === 'boolean', 'sequence-state-missing');
  }
  return {result:'METADATA_VALIDATED_NOT_RESTORED', projectRef:PROJECT, sourceCommit:BASE,
    migrationSetSha256:plan.migrationSetSha256, baselineCount:227, migrationCount:10,
    metadataSha256:digest(JSON.stringify(metadata)), recoveryProven:false,
    note:'Metadata equality is not data capture, migration execution, rollback, or deployment authority.'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    if(args.length === 1 && args[0] === '--metadata-query') console.log(METADATA_SQL);
    else if(args.length === 2 && args[0] === '--validate-metadata')
      console.log(JSON.stringify(validateMetadata(makePlan(),JSON.parse(fs.readFileSync(args[1],'utf8'))),null,2));
    else {
      check(args.length === 0, 'unsupported-mode-no-remote-execution-implemented');
      console.log(JSON.stringify(makePlan(),null,2));
    }
  } catch { console.error(JSON.stringify({result:'HOLD',code:'staging-preparation-failed-no-recovery-proof'}));process.exitCode=1; }
}
