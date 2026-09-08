-- Migration: Additive evidence-first ingestion and immutable observations.
-- Rollback: Stop imports and restore projection pointers from retained observations;
-- retain audit tables. Existing products and historical scores are not backfilled.
BEGIN;

CREATE TABLE public.ingestion_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL REFERENCES public.data_sources(source_key),
  country text NOT NULL REFERENCES public.country_ref(country_code),
  extractor_version text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','quarantined')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL REFERENCES public.data_sources(source_key),
  external_id text NOT NULL CHECK(length(external_id) BETWEEN 1 AND 200),
  country text NOT NULL REFERENCES public.country_ref(country_code),
  product_id bigint REFERENCES public.products(product_id),
  selected_observation_id uuid,
  UNIQUE(source_key, external_id, country)
);
CREATE TABLE public.product_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES public.product_source_records(id),
  batch_id uuid NOT NULL REFERENCES public.ingestion_batches(id),
  source_revision bigint CHECK(source_revision > 0),
  extractor_version text NOT NULL,
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  sanitized_payload jsonb NOT NULL CHECK(jsonb_typeof(sanitized_payload) = 'object'),
  extracted_fields jsonb NOT NULL CHECK(jsonb_typeof(extracted_fields) = 'object'),
  source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
  license text NOT NULL CHECK(length(license)>0),
  retrieved_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,
  validation_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK(status IN ('accepted','quarantined','superseded')),
  reason text,
  UNIQUE(source_record_id,id),
  UNIQUE(source_record_id,batch_id,payload_hash,extractor_version),
  CHECK(source_updated_at IS NULL OR (retrieved_at IS NOT NULL AND source_updated_at <= retrieved_at)),
  CHECK(status <> 'accepted' OR retrieved_at IS NOT NULL)
);
ALTER TABLE public.product_source_records ADD CONSTRAINT source_selected_observation_fk
  FOREIGN KEY(id,selected_observation_id) REFERENCES public.product_source_observations(source_record_id,id);
CREATE INDEX ON public.product_source_records(product_id);
CREATE INDEX ON public.ingestion_batches(source_key);
CREATE INDEX ON public.ingestion_batches(country);
CREATE INDEX ON public.product_source_records(country);
CREATE INDEX ON public.product_source_observations(batch_id);
CREATE INDEX ON public.product_source_observations(source_record_id,retrieved_at DESC);

ALTER TABLE public.product_field_provenance
  ADD COLUMN observation_id uuid REFERENCES public.product_source_observations(id),
  ADD COLUMN evidence_state text NOT NULL DEFAULT 'missing'
    CHECK(evidence_state IN ('recorded','missing','invalid','conflicting')),
  ADD COLUMN basis text NOT NULL DEFAULT 'unknown'
    CHECK(basis IN ('per_100g','per_100ml','per_serving','unknown')),
  ADD COLUMN unit text,
  ADD COLUMN qualifier text CHECK(qualifier IN ('eq','lt','lte','gt','gte','approx')),
  ADD COLUMN preparation_state text NOT NULL DEFAULT 'unknown'
    CHECK(preparation_state IN ('as_sold','prepared','unknown'));
CREATE INDEX ON public.product_field_provenance(observation_id);

-- Independent source assertions are not forced into legacy junction keys,
-- which cannot represent ownership. Selection switches atomically by source.
CREATE TABLE public.product_source_assertions (
  source_record_id uuid NOT NULL REFERENCES public.product_source_records(id),
  observation_id uuid NOT NULL REFERENCES public.product_source_observations(id),
  kind text NOT NULL CHECK(kind IN ('ingredient','contains','traces')),
  position integer NOT NULL CHECK(position >= 0),
  assertion jsonb NOT NULL,
  PRIMARY KEY(source_record_id,kind,position),
  FOREIGN KEY(source_record_id,observation_id) REFERENCES public.product_source_observations(source_record_id,id)
);
CREATE INDEX ON public.product_source_assertions(observation_id);
CREATE INDEX ON public.product_source_assertions(source_record_id,observation_id);

CREATE FUNCTION public.ingestion_observation_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Source observations are immutable; append and select another observation';
END $$;
CREATE TRIGGER immutable_source_observation BEFORE UPDATE OR DELETE
ON public.product_source_observations FOR EACH ROW
EXECUTE FUNCTION public.ingestion_observation_immutable();

-- Service-owned ingestion; no authenticated-user write or direct raw payload
-- exposure. Root read-model functions selectively expose sanitized fields.
ALTER TABLE public.ingestion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_assertions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_batches, public.product_source_records,
  public.product_source_observations, public.product_source_assertions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ingestion_batches, public.product_source_records,
  public.product_source_observations, public.product_source_assertions TO service_role;

CREATE FUNCTION public.ingestion_upsert_product(
  p_country text,p_ean text,p_brand text,p_name text,p_category text,
  p_type text DEFAULT 'Grocery',p_prep text DEFAULT 'not-applicable',
  p_store text DEFAULT NULL,p_controversies text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id bigint; v_name_id bigint;
BEGIN
  IF nullif(btrim(p_ean),'') IS NULL OR p_ean !~ '^([0-9]{8}|[0-9]{12,14})$'
     OR nullif(btrim(p_brand),'') IS NULL OR nullif(btrim(p_name),'') IS NULL THEN
    RAISE EXCEPTION 'ambiguous_identity: barcode, brand and name are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_country || ':' || p_ean,0));
  SELECT product_id INTO v_id FROM public.products
    WHERE country=p_country AND ean=p_ean FOR UPDATE;
  SELECT product_id INTO v_name_id FROM public.products
    WHERE country=p_country AND lower(btrim(brand))=lower(btrim(p_brand))
      AND lower(btrim(product_name))=lower(btrim(p_name))
      AND is_deprecated IS NOT TRUE LIMIT 1;
  IF (v_id IS NOT NULL AND v_name_id IS NOT NULL AND v_id<>v_name_id)
    OR (v_id IS NULL AND v_name_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ambiguous_identity: name maps to another product';
  END IF;
  IF v_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.products WHERE product_id=v_id AND is_deprecated IS TRUE) THEN
      RAISE EXCEPTION 'ambiguous_identity: explicit deprecation requires reconciliation';
    END IF;
    UPDATE public.products SET brand=p_brand, product_name=p_name,category=p_category
      WHERE product_id=v_id;
    RETURN v_id;
  END IF;
  INSERT INTO public.products(country,ean,brand,product_name,category,product_type,
    prep_method,store_availability,controversies)
  VALUES(p_country,p_ean,p_brand,p_name,p_category,p_type,COALESCE(p_prep,'not-applicable'),p_store,p_controversies)
  RETURNING product_id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.ingestion_upsert_product(text,text,text,text,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingestion_upsert_product(text,text,text,text,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.ingestion_apply_observation(p_batch jsonb,p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_batch uuid; v_source uuid; v_obs uuid; v_existing uuid; v_product bigint; v_mapped_product bigint;
  v_selected public.product_source_observations%ROWTYPE;
  v_status text := 'accepted'; v_reason text; v_key text; v_value jsonb;
  v_column text; v_numeric numeric; v_index integer; v_nutrition jsonb := '{}'::jsonb;
  v_retrieved timestamptz; v_updated timestamptz; v_number numeric; v_revision bigint;
  v_findings jsonb := COALESCE(p_record->'validation_findings','[]'::jsonb);
  v_parsed jsonb := '{}'::jsonb;
  v_payload jsonb := p_record->'sanitized_payload';
  v_expected_source text; v_expected_transform text; v_raw_value jsonb;
  v_raw_allergens jsonb;
BEGIN
  IF NOT (COALESCE(p_record->'extracted_fields','{}'::jsonb) ?& ARRAY[
    'calories_100g','fat_100g','saturated_fat_100g','trans_fat_100g','carbs_100g',
    'sugars_100g','fiber_100g','protein_100g','salt_100g']) THEN
    RAISE EXCEPTION 'Incomplete canonical nutrient envelope';
  END IF;
  IF p_record->>'payload_hash' !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(p_record->'extracted_fields') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_record->'sanitized_payload') IS DISTINCT FROM 'object'
    OR p_record->>'payload_canonical' IS NULL
    OR (p_record->>'payload_canonical')::jsonb IS DISTINCT FROM p_record->'sanitized_payload'
    OR encode(sha256(convert_to(p_record->>'payload_canonical','UTF8')),'hex') IS DISTINCT FROM p_record->>'payload_hash'
    OR p_record->>'external_id' IS DISTINCT FROM p_record->'identity'->>'ean'
    OR p_record->>'external_id' IS DISTINCT FROM v_payload->>'code'
    OR p_batch->>'extractor_version' IS DISTINCT FROM 'off-observations-v1'
    OR v_payload->>'extractor_version' IS DISTINCT FROM p_batch->>'extractor_version'
    OR v_payload->'extraction' IS DISTINCT FROM p_record->'extracted_fields'
    OR v_payload->'projected_identity' IS DISTINCT FROM p_record->'identity'
    OR v_payload->'ingredient_assertions' IS DISTINCT FROM COALESCE(p_record->'ingredients','null'::jsonb)
    OR v_payload->'allergen_assertions' IS DISTINCT FROM COALESCE(p_record->'allergen_assertions','[]'::jsonb)
    OR v_payload->'set_states' IS DISTINCT FROM jsonb_build_object(
      'ingredients_state',COALESCE(p_record->>'ingredients_state','missing'),
      'allergens_state',COALESCE(p_record->>'allergens_state','missing'))
    OR v_payload->'observation_metadata' IS DISTINCT FROM jsonb_build_object(
      'source_revision',p_record->'source_revision','source_url',p_record->'source_url',
      'license',p_record->'license','retrieved_at',p_record->'retrieved_at',
      'source_updated_at',p_record->'source_updated_at','validation_findings',p_record->'validation_findings')
    OR p_record->'identity'->'brand' IS DISTINCT FROM p_record->'extracted_fields'->'brand'->'value'
    OR p_record->'identity'->'product_name' IS DISTINCT FROM p_record->'extracted_fields'->'product_name'->'value' THEN
    RAISE EXCEPTION 'Invalid observation envelope';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tag',regexp_replace(t.tag,'^en:',''),'type',t.kind)
    ORDER BY t.group_order,t.position),'[]'::jsonb) INTO v_raw_allergens
  FROM (
    SELECT tag,'contains'::text AS kind,1 AS group_order,position
      FROM jsonb_array_elements_text(COALESCE(NULLIF(v_payload->'allergens_tags','null'::jsonb),'[]'::jsonb)) WITH ORDINALITY a(tag,position)
    UNION ALL
    SELECT tag,'traces',2,position
      FROM jsonb_array_elements_text(COALESCE(NULLIF(v_payload->'traces_tags','null'::jsonb),'[]'::jsonb)) WITH ORDINALITY a(tag,position)
  ) t;
  IF v_payload->'ingredient_assertions' IS DISTINCT FROM COALESCE(v_payload->'ingredients','null'::jsonb)
    OR v_payload->'allergen_assertions' IS DISTINCT FROM v_raw_allergens THEN
    RAISE EXCEPTION 'Assertions lack bound source input';
  END IF;
  -- Check provenance lineage, not a second implementation of the extractor.
  -- A recorded field must have its actual allowlisted raw input in the sealed
  -- snapshot, and use the declared version's known transformation.
  FOR v_key,v_value IN SELECT * FROM jsonb_each(p_record->'extracted_fields') LOOP
    IF v_value->>'state'<>'recorded' THEN CONTINUE; END IF;
    v_expected_source := CASE v_key
      WHEN 'calories_100g' THEN 'energy-kcal_100g' WHEN 'fat_100g' THEN 'fat_100g'
      WHEN 'saturated_fat_100g' THEN 'saturated-fat_100g' WHEN 'trans_fat_100g' THEN 'trans-fat_100g'
      WHEN 'carbs_100g' THEN 'carbohydrates_100g' WHEN 'sugars_100g' THEN 'sugars_100g'
      WHEN 'fiber_100g' THEN 'fiber_100g' WHEN 'protein_100g' THEN 'proteins_100g'
      WHEN 'salt_100g' THEN 'salt_100g' WHEN 'brand' THEN 'brands' WHEN 'ean' THEN 'code'
      WHEN 'category' THEN 'categories_tags' WHEN 'nutri_score_label' THEN 'nutriscore_grade'
      WHEN 'nova_classification' THEN 'nova_group'
      WHEN 'product_name' THEN CASE WHEN NULLIF(btrim(v_payload->>'product_name'),'') IS NOT NULL
        THEN 'product_name' ELSE 'abbreviated_product_name' END END;
    v_expected_transform := CASE v_key
      WHEN 'brand' THEN 'off_primary_brand_v1' WHEN 'product_name' THEN 'off_product_name_v1'
      WHEN 'ean' THEN 'source_string' WHEN 'category' THEN 'off_category_v1'
      WHEN 'nutri_score_label' THEN 'uppercase_source_grade' WHEN 'nova_classification' THEN 'source_integer'
      ELSE 'off_normalized_value' END;
    v_raw_value := CASE WHEN v_expected_transform='off_normalized_value'
      THEN v_payload->'nutriments'->v_expected_source ELSE v_payload->v_expected_source END;
    IF v_expected_source IS NULL OR v_value->>'source_field' IS DISTINCT FROM v_expected_source
      OR v_value->>'transformation' IS DISTINCT FROM v_expected_transform
      OR v_raw_value IS NULL OR v_raw_value='null'::jsonb OR v_raw_value='""'::jsonb OR v_raw_value='[]'::jsonb THEN
      RAISE EXCEPTION 'Recorded field lacks bound source input';
    END IF;
  END LOOP;
  BEGIN
    v_retrieved := (p_record->>'retrieved_at')::timestamptz;
  EXCEPTION WHEN data_exception THEN v_retrieved := NULL;
  END;
  IF v_retrieved IS NULL OR v_retrieved > now()+interval '5 minutes' THEN
    v_findings := v_findings || jsonb_build_array(jsonb_build_object('reason','invalid_retrieved_at','value',p_record->>'retrieved_at'));
    v_retrieved := NULL;
  END IF;
  BEGIN
    v_updated := (p_record->>'source_updated_at')::timestamptz;
  EXCEPTION WHEN data_exception THEN
    v_findings := v_findings || jsonb_build_array(jsonb_build_object('reason','invalid_source_updated_at','value',p_record->>'source_updated_at'));
    v_updated := NULL;
  END;
  IF v_updated IS NOT NULL AND (v_retrieved IS NULL OR v_updated>v_retrieved) THEN
    v_findings := v_findings || jsonb_build_array(jsonb_build_object('reason','future_source_updated_at','value',p_record->>'source_updated_at'));
    v_updated := NULL;
  END IF;
  BEGIN
    v_revision := (p_record->>'source_revision')::bigint;
    IF v_revision<=0 THEN RAISE EXCEPTION 'Invalid revision'; END IF;
  EXCEPTION WHEN raise_exception OR data_exception THEN
    v_findings := v_findings || jsonb_build_array(jsonb_build_object('reason','invalid_source_revision','value',p_record->>'source_revision'));
    v_revision := NULL;
  END;
  -- Validate before touching current projections. The service boundary is not
  -- allowed to rely on the Python validator having run.
  FOR v_key,v_value IN SELECT * FROM jsonb_each(p_record->'extracted_fields') LOOP
    IF v_value->>'state' NOT IN ('recorded','missing') OR v_value->>'state' IS NULL THEN
      v_findings := v_findings || jsonb_build_array(jsonb_build_object('field',v_key,'reason','invalid_evidence_state'));
    END IF;
    IF v_key = ANY(ARRAY['calories_100g','fat_100g','saturated_fat_100g','trans_fat_100g',
      'carbs_100g','sugars_100g','fiber_100g','protein_100g','salt_100g']) AND v_value->>'state'='recorded' THEN
      BEGIN
        IF COALESCE(v_value->>'value','') !~ '^[+]?[0-9]*[.]?[0-9]+([eE][+-]?[0-9]+)?$'
          OR v_value->>'qualifier' NOT IN ('eq','lt','lte','gt','gte','approx') OR v_value->>'qualifier' IS NULL
          OR v_value->>'basis' NOT IN ('per_100g','per_100ml','per_serving','unknown') OR v_value->>'basis' IS NULL
          OR v_value->>'preparation_state' NOT IN ('as_sold','prepared','unknown') OR v_value->>'preparation_state' IS NULL
          OR (v_key='calories_100g' AND v_value->>'unit' IS DISTINCT FROM 'kcal')
          OR (v_key<>'calories_100g' AND v_value->>'unit' IS DISTINCT FROM 'g') THEN
          RAISE EXCEPTION 'invalid_nutrient_descriptor';
        END IF;
        v_number := (v_value->>'value')::numeric;
        IF v_number<0 OR v_number>=1000
          OR (v_value->>'basis'='per_100g' AND v_key<>'calories_100g' AND v_number>100) THEN
          RAISE EXCEPTION 'implausible_nutrient_quantity';
        END IF;
        IF v_value->>'qualifier'='eq' THEN
          v_parsed := v_parsed || jsonb_build_object(v_key,v_number);
        END IF;
      EXCEPTION WHEN raise_exception OR data_exception THEN
        v_findings := v_findings || jsonb_build_array(jsonb_build_object('field',v_key,'reason','invalid_nutrient_descriptor_or_quantity'));
      END;
    END IF;
  END LOOP;
  IF (v_parsed->>'saturated_fat_100g')::numeric > (v_parsed->>'fat_100g')::numeric
    OR (v_parsed->>'sugars_100g')::numeric > (v_parsed->>'carbs_100g')::numeric THEN
    v_findings := v_findings || '[{"reason":"inconsistent_nutrient_relationship"}]'::jsonb;
  END IF;
  -- A malformed positive set must never clear retained warnings, even when a
  -- service caller bypasses the Python adapter's validation findings.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_raw_allergens) a
    WHERE NULLIF(btrim(a->>'tag'),'') IS NULL) THEN
    v_findings := v_findings || '[{"reason":"invalid_allergen_tag"}]'::jsonb;
  END IF;
  IF jsonb_array_length(v_findings)>0 THEN
    v_status := 'quarantined'; v_reason := 'record_validation_failed';
  END IF;
  INSERT INTO public.ingestion_batches(source_key,country,extractor_version,idempotency_key,scope)
  VALUES(p_batch->>'source_key',p_batch->>'country',p_batch->>'extractor_version',
    p_batch->>'idempotency_key',p_batch->'scope')
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_batch;
  IF v_batch IS NULL THEN
    SELECT id INTO v_batch FROM public.ingestion_batches WHERE idempotency_key=p_batch->>'idempotency_key'
      AND source_key=p_batch->>'source_key' AND country=p_batch->>'country'
      AND extractor_version=p_batch->>'extractor_version' AND scope=p_batch->'scope';
    IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch idempotency conflict'; END IF;
  END IF;
  INSERT INTO public.product_source_records(source_key,external_id,country)
    VALUES(p_batch->>'source_key',p_record->>'external_id',p_batch->>'country')
    ON CONFLICT(source_key,external_id,country) DO NOTHING;
  SELECT id,product_id INTO v_source,v_product FROM public.product_source_records
    WHERE source_key=p_batch->>'source_key' AND external_id=p_record->>'external_id'
      AND country=p_batch->>'country' FOR UPDATE;
  v_mapped_product := v_product;
  SELECT id INTO v_existing FROM public.product_source_observations
    WHERE source_record_id=v_source AND payload_hash=p_record->>'payload_hash'
      AND batch_id=v_batch
      AND extractor_version=p_batch->>'extractor_version';
  IF v_existing IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.product_source_observations WHERE id=v_existing
      AND extracted_fields IS DISTINCT FROM p_record->'extracted_fields') THEN
      RAISE EXCEPTION 'Non-deterministic extraction under identical extractor version';
    END IF;
    RETURN jsonb_build_object('status','duplicate','product_id',v_product,'observation_id',v_existing);
  END IF;
  SELECT o.* INTO v_selected FROM public.product_source_observations o
    JOIN public.product_source_records s ON s.selected_observation_id=o.id WHERE s.id=v_source;
  IF FOUND AND v_status='accepted' AND (v_retrieved < v_selected.retrieved_at
    OR (v_updated IS NOT NULL AND v_selected.source_updated_at IS NOT NULL
      AND v_updated < v_selected.source_updated_at)
    OR (v_revision IS NOT NULL AND v_selected.source_revision IS NOT NULL
      AND v_revision < v_selected.source_revision)) THEN
    v_status := 'superseded'; v_reason := 'out_of_order_observation';
  END IF;
  IF v_status='accepted' THEN
    BEGIN
      v_product := public.ingestion_upsert_product(p_batch->>'country',p_record->'identity'->>'ean',
        p_record->'identity'->>'brand',p_record->'identity'->>'product_name',p_record->'identity'->>'category');
      IF v_mapped_product IS NOT NULL AND v_product<>v_mapped_product THEN
        RAISE EXCEPTION 'stable_source_mapping_conflict';
      END IF;
      IF EXISTS(SELECT 1 FROM public.product_field_provenance pf
        WHERE pf.product_id=v_product AND pf.source_type<>p_batch->>'source_key'
          AND p_record->'extracted_fields' ? pf.field_name) THEN
        RAISE EXCEPTION 'independent_source_conflict';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_each(p_record->'extracted_fields') f
        WHERE f.value->>'state' IN ('invalid','conflicting')) THEN
        RAISE EXCEPTION 'invalid_or_conflicting_fields';
      END IF;
    EXCEPTION WHEN raise_exception OR unique_violation THEN
      v_status := 'quarantined'; v_reason := 'identity_or_evidence_conflict';
      SELECT product_id INTO v_product FROM public.product_source_records WHERE id=v_source;
    END;
  END IF;
  INSERT INTO public.product_source_observations(source_record_id,batch_id,source_revision,extractor_version,
    payload_hash,sanitized_payload,extracted_fields,source_url,license,retrieved_at,
    source_updated_at,validation_findings,status,reason)
  VALUES(v_source,v_batch,v_revision,p_batch->>'extractor_version',p_record->>'payload_hash',
    p_record->'sanitized_payload',p_record->'extracted_fields',p_record->>'source_url',
    p_record->>'license',v_retrieved,v_updated,
    v_findings,v_status,v_reason) RETURNING id INTO v_obs;
  IF v_status='accepted' THEN
    UPDATE public.product_source_records SET product_id=v_product,selected_observation_id=v_obs WHERE id=v_source;
    FOR v_key,v_value IN SELECT * FROM jsonb_each(p_record->'extracted_fields') LOOP
      INSERT INTO public.product_field_provenance(product_id,field_name,source_type,source_url,
        confidence,recorded_at,observation_id,evidence_state,basis,unit,qualifier,preparation_state)
      VALUES(v_product,v_key,p_batch->>'source_key',p_record->>'source_url',NULL,v_retrieved,
        v_obs,v_value->>'state',COALESCE(v_value->>'basis','unknown'),v_value->>'unit',
        v_value->>'qualifier',COALESCE(v_value->>'preparation_state','unknown'))
      ON CONFLICT(product_id,field_name) DO UPDATE SET source_url=excluded.source_url,
        source_type=excluded.source_type,confidence=NULL,recorded_at=excluded.recorded_at,
        observation_id=excluded.observation_id,evidence_state=excluded.evidence_state,
        basis=excluded.basis,unit=excluded.unit,qualifier=excluded.qualifier,
        preparation_state=excluded.preparation_state,verified_at=NULL,verified_by=NULL;
      v_column := CASE v_key WHEN 'calories_100g' THEN 'calories' WHEN 'fat_100g' THEN 'total_fat_g'
        WHEN 'saturated_fat_100g' THEN 'saturated_fat_g' WHEN 'trans_fat_100g' THEN 'trans_fat_g'
        WHEN 'carbs_100g' THEN 'carbs_g' WHEN 'sugars_100g' THEN 'sugars_g'
        WHEN 'fiber_100g' THEN 'fibre_g' WHEN 'protein_100g' THEN 'protein_g' WHEN 'salt_100g' THEN 'salt_g' END;
      IF v_column IS NOT NULL THEN
        v_numeric := CASE WHEN v_value->>'state'='recorded' AND v_value->>'qualifier'='eq'
          THEN (v_value->>'value')::numeric ELSE NULL END;
        v_nutrition := v_nutrition || jsonb_build_object(v_column,v_numeric);
      END IF;
    END LOOP;
    -- Project all nutrients together: intermediate single-column updates could
    -- violate sat-fat/fat or sugar/carbohydrate constraints during a valid edit.
    INSERT INTO public.nutrition_facts(product_id,calories,total_fat_g,saturated_fat_g,
      trans_fat_g,carbs_g,sugars_g,fibre_g,protein_g,salt_g)
    VALUES(v_product,(v_nutrition->>'calories')::numeric,(v_nutrition->>'total_fat_g')::numeric,
      (v_nutrition->>'saturated_fat_g')::numeric,(v_nutrition->>'trans_fat_g')::numeric,
      (v_nutrition->>'carbs_g')::numeric,(v_nutrition->>'sugars_g')::numeric,
      (v_nutrition->>'fibre_g')::numeric,(v_nutrition->>'protein_g')::numeric,(v_nutrition->>'salt_g')::numeric)
    ON CONFLICT(product_id) DO UPDATE SET calories=excluded.calories,total_fat_g=excluded.total_fat_g,
      saturated_fat_g=excluded.saturated_fat_g,trans_fat_g=excluded.trans_fat_g,carbs_g=excluded.carbs_g,
      sugars_g=excluded.sugars_g,fibre_g=excluded.fibre_g,protein_g=excluded.protein_g,salt_g=excluded.salt_g;
    -- Only an explicitly collected/reported set replaces that source's set.
    -- Missing input preserves older assertions and their original observation
    -- pointers. An empty reported positive-only set is still NOT absence proof.
    IF p_record->>'ingredients_state'='reported' THEN
      IF jsonb_typeof(p_record->'ingredients') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Reported ingredients require an array';
      END IF;
      DELETE FROM public.product_source_assertions WHERE source_record_id=v_source AND kind='ingredient';
      v_index := 0;
      FOR v_value IN SELECT value FROM jsonb_array_elements(p_record->'ingredients') LOOP
        v_index := v_index+1;
        INSERT INTO public.product_source_assertions VALUES(v_source,v_obs,'ingredient',v_index,v_value);
      END LOOP;
    END IF;
    IF p_record->>'allergens_state'='reported' THEN
      IF jsonb_typeof(p_record->'allergen_assertions') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Reported allergens require an array';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_record->'allergen_assertions') a
          WHERE lower(btrim(a->>'tag')) NOT IN ('','none'))
        OR (p_record->>'ingredients_state'='reported' AND
          CASE WHEN jsonb_typeof(p_record->'ingredients')='array' THEN jsonb_array_length(p_record->'ingredients') ELSE 0 END > 0) THEN
        DELETE FROM public.product_source_assertions WHERE source_record_id=v_source AND kind IN ('contains','traces');
      END IF;
    END IF;
    FOR v_value IN SELECT value FROM jsonb_array_elements(COALESCE(NULLIF(p_record->'allergen_assertions','null'::jsonb),'[]'::jsonb)) LOOP
      SELECT position INTO v_index FROM public.product_source_assertions
        WHERE source_record_id=v_source AND kind=v_value->>'type' AND assertion->>'tag'=v_value->>'tag' LIMIT 1;
      IF v_index IS NULL THEN
        SELECT COALESCE(MAX(position),0)+1 INTO v_index FROM public.product_source_assertions
          WHERE source_record_id=v_source AND kind=v_value->>'type';
      END IF;
      INSERT INTO public.product_source_assertions VALUES(v_source,v_obs,v_value->>'type',v_index,v_value)
        ON CONFLICT(source_record_id,kind,position) DO UPDATE SET
          observation_id=excluded.observation_id,assertion=excluded.assertion;
    END LOOP;
    UPDATE public.products SET source_type=p_batch->>'source_key',source_url=p_record->>'source_url',
      source_ean=p_record->'identity'->>'ean',last_fetched_at=v_retrieved,
      off_revision=v_revision WHERE product_id=v_product;
  END IF;
  UPDATE public.ingestion_batches SET status=CASE WHEN v_status='quarantined' THEN 'quarantined' ELSE status END,
    counts=jsonb_set(counts,ARRAY[v_status],to_jsonb(COALESCE((counts->>v_status)::integer,0)+1)) WHERE id=v_batch;
  RETURN jsonb_build_object('status',v_status,'product_id',v_product,'observation_id',v_obs,'reason',v_reason);
END $$;
REVOKE ALL ON FUNCTION public.ingestion_apply_observation(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingestion_apply_observation(jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ingestion_observation_immutable() FROM PUBLIC,anon,authenticated;
COMMIT;
