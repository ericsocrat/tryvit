/** Entirely fabricated unit data. No filesystem, network or retained observations. */
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value));
const sqlJson=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export function syntheticRecord(id=178) {
  const values={calories_100g:'219',fat_100g:'1.8',saturated_fat_100g:'0.3',trans_fat_100g:null,
    carbs_100g:'44',sugars_100g:'1.6',fiber_100g:null,protein_100g:'4.8',salt_100g:'1.4'};
  const extracted_fields=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,value===null?
    {state:'missing',basis:'unknown'}:{state:'recorded',value,qualifier:'eq',basis:'unknown'}]));
  const sanitized_payload={extractor_version:'synthetic-unit-v1',product_name:`Synthetic product ${id}`,nutrients:values};
  const payload_canonical=JSON.stringify(sanitized_payload);
  return {identity:{brand:"Synthetic O'Brand",product_name:`Synthetic product ${id}`,category:'Synthetic category'},
    sanitized_payload,payload_canonical,payload_hash:sha(Buffer.from(payload_canonical)),extracted_fields,
    source_url:`https://example.invalid/synthetic-food/${id}`,license:'synthetic-fixture-only',source_revision:'10',
    retrieved_at:'2026-09-05T10:27:34.904106Z',source_updated_at:'2026-04-01T09:46:00Z',validation_findings:[],
    ingredients_state:id===195?'reported':'missing',ingredients:id===195?[{text:'Synthetic oats',position:1}]:[],
    allergen_assertions:id===195?[{type:'contains',tag:'en:gluten',text:'Synthetic gluten'}]:[]};
}
export function syntheticPilot() {
  const record=syntheticRecord(),batch={source_key:'off_api',country:'PL',extractor_version:'synthetic-unit-v1',
    idempotency_key:'synthetic-pilot-v1',scope:{category:record.identity.category,kind:'partial_upsert'}};
  return {record,pilot:{sql:{mutation:`DO $fixture$ DECLARE result jsonb; BEGIN result := public.ingestion_apply_observation(${sqlJson(batch)},${sqlJson(record)}); END $fixture$;`}}};
}
export function syntheticPilotSource() {
  const {record,pilot}=syntheticPilot();
  const sql=Buffer.from('-- DRY PLAN ONLY: requires a fresh 19-table recovery proof and isolated import/reversal rehearsal.\n'+
    '-- Fixed operator identity contract: 5900340003615\nBEGIN;\n'+pilot.sql.mutation+'\nCOMMIT;');
  const observation=encode(record),manifest={schemaVersion:1,scope:'schema-and-catalog',recoveryProfile:'consumer-v1',
    migrations:Array.from({length:7},(_,i)=>({path:`supabase/migrations/2099010100000${i}_synthetic.sql`,sha256:sha(Buffer.from(`SELECT ${i};`))}))};
  const files=new Map([
    ['audit-reports/evidence-cohort/production-import-plan-20260908/pilot-178.sql',sql],
    ['audit-reports/evidence-cohort/run-20260905T101700Z/PL-178-5900340003615.observation.json',observation],
    ['docs/releases/evidence-first-consumer.migrations.json',encode(manifest)],
  ]);
  return {files,pilotSha256:sha(sql),observationSha256:sha(observation),
    readFile:file=>{const bytes=files.get(file.replaceAll('\\','/'));if(!bytes)throw Error('synthetic_input_not_found');return Buffer.from(bytes);},
    // Manifest validator itself has separate filesystem-backed unit coverage.
    // This injected boundary asserts exactly the fabricated seven input hashes.
    validateMigrationManifest:value=>{if(JSON.stringify(value)!==JSON.stringify(manifest))throw Error('synthetic_manifest_changed');}};
}
export function syntheticRetainedSource() {
  const eligible=[148,195,...Array.from({length:52},(_,i)=>10000+i)];
  const held=[628,2882,2903,2950,6029],ids=[178,...eligible,...held];
  const files=new Map(),members=[],receiptMembers=[];
  for(const id of ids) {
    const record=syntheticRecord(id),bytes=encode(record),file=`synthetic-${id}.json`,recordHash=sha(bytes);
    const rename=eligible.indexOf(id)>=0&&eligible.indexOf(id)<19;
    const before={...record.identity,...(rename?{product_name:`Old synthetic product ${id}`}:{})};
    members.push({product_id:id,country:id%2?'DE':'PL',ean:`990000${String(id).padStart(7,'0')}`,record_sha256:recordHash,
      payload_hash:record.payload_hash,before_product:before,
      hold_reasons:held.includes(id)?['synthetic-category-hold']:rename?['identity_text_change_requires_review']:[]});
    receiptMembers.push({product_id:id,observation_file:file,observation_sha256:recordHash});
    files.set(`audit-reports/evidence-cohort/run-20260905T101700Z/${file}`,bytes);
  }
  const plan=encode({production_checked_at:'2026-09-01T00:00:00Z',members});
  files.set('audit-reports/evidence-cohort/production-import-plan-20260908/plan.json',plan);
  files.set('audit-reports/evidence-cohort/run-20260905T101700Z/receipt.json',encode({members:receiptMembers}));
  return {files,planSha256:sha(plan),readFile:file=>{
    const bytes=files.get(file.replaceAll('\\','/'));if(!bytes)throw Error('synthetic_input_not_found');return Buffer.from(bytes);
  }};
}
