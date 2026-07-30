-- Phase 5 preflight A: truthful allergen evidence semantics.
--
-- product_allergen_info continues to store positive evidence only. Absence of
-- a row is unknown, never an assessed absence. The additive evidence_basis
-- column records whether positive evidence came from a source declaration,
-- deterministic ingredient rules, or a historical row whose provenance
-- cannot be reconstructed safely.

BEGIN;

ALTER TABLE public.product_allergen_info
    ADD COLUMN IF NOT EXISTS evidence_basis text;

UPDATE public.product_allergen_info
SET evidence_basis = 'legacy_unclassified'
WHERE evidence_basis IS NULL;

ALTER TABLE public.product_allergen_info
    ALTER COLUMN evidence_basis SET DEFAULT 'legacy_unclassified',
    ALTER COLUMN evidence_basis SET NOT NULL;

ALTER TABLE public.product_allergen_info
    DROP CONSTRAINT IF EXISTS chk_product_allergen_evidence_basis;

ALTER TABLE public.product_allergen_info
    ADD CONSTRAINT chk_product_allergen_evidence_basis
    CHECK (evidence_basis IN (
        'explicit_source',
        'ingredient_derived',
        'legacy_unclassified'
    ));

ALTER TABLE public.product_allergen_info
    DROP CONSTRAINT IF EXISTS chk_explicit_allergen_source_traceability;

ALTER TABLE public.product_allergen_info
    ADD CONSTRAINT chk_explicit_allergen_source_traceability
    CHECK (
        evidence_basis <> 'explicit_source'
        OR source_tag IS NOT NULL
    );

COMMENT ON COLUMN public.product_allergen_info.evidence_basis IS
'Provenance of positive allergen evidence. explicit_source = source contains/may-contain declaration; ingredient_derived = deterministic governed ingredient relationship; legacy_unclassified = positive evidence whose provenance cannot be reconstructed. Missing rows mean unknown, not absent.';

CREATE OR REPLACE FUNCTION public.set_product_allergen_evidence_basis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
    -- Generated source-evidence pipelines preserve source_tag. Upgrade the
    -- safe default when that traceability is present. Never infer assessed
    -- absence here: this trigger only classifies positive evidence rows.
    IF NEW.source_tag IS NOT NULL
       AND NEW.evidence_basis = 'legacy_unclassified' THEN
        NEW.evidence_basis := 'explicit_source';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_product_allergen_evidence_basis() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_product_allergen_evidence_basis
    ON public.product_allergen_info;

CREATE TRIGGER trg_product_allergen_evidence_basis
    BEFORE INSERT OR UPDATE OF source_tag, evidence_basis
    ON public.product_allergen_info
    FOR EACH ROW
    EXECUTE FUNCTION public.set_product_allergen_evidence_basis();

-- Keep the established product-profile payload intact and add an explicit,
-- additive evidence contract. The renamed implementation is private and can
-- only be reached through the evidence-aware wrapper below.
ALTER FUNCTION public.api_get_product_profile(bigint, text)
    RENAME TO get_product_profile_v1_legacy_internal;

REVOKE ALL ON FUNCTION public.get_product_profile_v1_legacy_internal(bigint, text)
    FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.api_get_product_profile(
    p_product_id bigint,
    p_language text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_profile jsonb;
    v_evidence jsonb;
    v_allergens jsonb;
BEGIN
    v_profile := public.get_product_profile_v1_legacy_internal(
        p_product_id,
        p_language
    );

    IF v_profile IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'tag', ai.tag,
                'evidence_type', CASE ai.type
                    WHEN 'traces' THEN 'may_contain'
                    ELSE 'contains'
                END,
                'evidence_basis', ai.evidence_basis,
                'source_tag', ai.source_tag
            )
            ORDER BY
                CASE ai.type WHEN 'contains' THEN 0 ELSE 1 END,
                ai.tag,
                ai.evidence_basis
        ),
        '[]'::jsonb
    )
    INTO v_evidence
    FROM public.product_allergen_info ai
    WHERE ai.product_id = p_product_id;

    v_allergens := COALESCE(v_profile->'allergens', '{}'::jsonb)
        || jsonb_build_object(
            'evidence', v_evidence,
            'evidence_status', CASE
                WHEN jsonb_array_length(v_evidence) = 0 THEN 'unknown'
                ELSE 'positive_evidence_available'
            END,
            'absence_assessment', 'not_assessed',
            'assessed_absent', '[]'::jsonb
        );

    RETURN jsonb_set(v_profile, '{allergens}', v_allergens, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.api_get_product_profile(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_get_product_profile(bigint, text)
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.api_get_product_profile(bigint, text) IS
'Canonical product profile with additive allergen evidence provenance. Empty evidence and unmentioned allergens are unknown; assessed_absent remains empty unless a future authoritative source supports absence.';

-- Product-card warnings retain the existing contains/traces arrays while
-- exposing provenance for consumers that can distinguish derived evidence.
CREATE OR REPLACE FUNCTION public.api_get_product_allergens(
    p_product_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN (
        SELECT COALESCE(
            jsonb_object_agg(
                grouped.product_id::text,
                jsonb_build_object(
                    'contains', grouped.contains_tags,
                    'traces', grouped.traces_tags,
                    'evidence', grouped.evidence,
                    'evidence_status', CASE
                        WHEN jsonb_array_length(grouped.evidence) = 0
                            THEN 'unknown'
                        ELSE 'positive_evidence_available'
                    END,
                    'absence_assessment', 'not_assessed'
                )
            ),
            '{}'::jsonb
        )
        FROM (
            SELECT
                requested.product_id,
                COALESCE(
                    array_agg(ai.tag ORDER BY ai.tag)
                        FILTER (
                            WHERE ai.product_id IS NOT NULL
                              AND ai.type = 'contains'
                        ),
                    ARRAY[]::text[]
                ) AS contains_tags,
                COALESCE(
                    array_agg(ai.tag ORDER BY ai.tag)
                        FILTER (
                            WHERE ai.product_id IS NOT NULL
                              AND ai.type = 'traces'
                        ),
                    ARRAY[]::text[]
                ) AS traces_tags,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'tag', ai.tag,
                            'evidence_type', CASE ai.type
                                WHEN 'traces' THEN 'may_contain'
                                ELSE 'contains'
                            END,
                            'evidence_basis', ai.evidence_basis
                        )
                        ORDER BY
                            CASE ai.type WHEN 'contains' THEN 0 ELSE 1 END,
                            ai.tag,
                            ai.evidence_basis
                    ) FILTER (WHERE ai.product_id IS NOT NULL),
                    '[]'::jsonb
                ) AS evidence
            FROM unnest(COALESCE(p_product_ids, ARRAY[]::bigint[]))
                AS requested(product_id)
            LEFT JOIN public.product_allergen_info ai
                ON ai.product_id = requested.product_id
            GROUP BY requested.product_id
        ) grouped
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.api_get_product_allergens(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_get_product_allergens(bigint[])
    TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.api_get_product_allergens(bigint[]) IS
'Batch positive-allergen evidence lookup. Every requested product is returned; products with no rows have empty arrays and evidence_status unknown, never allergen-free.';

COMMENT ON FUNCTION public.api_search_products(text, jsonb, integer, integer, boolean) IS
'Search endpoint. The legacy allergen_free JSON key is retained for compatibility but means exclude products with matching contains evidence. Products with only may-contain evidence or no evidence remain eligible; the key does not prove allergen absence.';

COMMENT ON FUNCTION public.api_get_filter_options(text) IS
'Filter options endpoint. Allergen counts are counts of products with positive contains evidence, not counts of allergen-free products.';

COMMENT ON COLUMN public.v_master.allergen_count IS
'Count of positive contains-evidence rows. Zero means no contains evidence is recorded; it does not prove absence.';
COMMENT ON COLUMN public.v_master.allergen_tags IS
'Comma-separated tags with positive contains evidence. NULL means unknown/unavailable, not allergen-free.';
COMMENT ON COLUMN public.v_master.trace_count IS
'Count of explicit may-contain/trace evidence rows.';
COMMENT ON COLUMN public.v_master.trace_tags IS
'Comma-separated tags with may-contain/trace evidence.';

COMMENT ON FUNCTION public.compute_data_completeness(bigint) IS
'Computes the established 15-checkpoint data-availability score. Its allergen checkpoint means positive evidence or ingredient inputs are available for governed evaluation; it does not certify assessed absence or complete allergen coverage.';

COMMIT;
