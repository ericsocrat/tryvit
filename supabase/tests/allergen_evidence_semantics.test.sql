-- pgTAP: Phase 5 allergen evidence semantics
-- Self-contained fixtures prove that missing positive evidence stays unknown.

BEGIN;
SELECT plan(20);

INSERT INTO public.category_ref (
    category, slug, display_name, sort_order, is_active
)
VALUES (
    'pgtap-allergen-evidence',
    'pgtap-allergen-evidence',
    'pgTAP Allergen Evidence',
    999,
    true
)
ON CONFLICT (category) DO UPDATE
SET slug = EXCLUDED.slug;

INSERT INTO public.country_ref (country_code, country_name, is_active)
VALUES ('XX', 'Test Country', true)
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO public.products (
    product_id, ean, product_name, brand, category, country,
    unhealthiness_score, nutri_score_label, nova_classification
)
VALUES
    (999971, '5901234999971', 'Phase5 Evidence Explicit', 'Test Brand',
     'pgtap-allergen-evidence', 'XX', 40, 'B', '2'),
    (999970, '5901234999970', 'Phase5 Evidence May Contain', 'Test Brand',
     'pgtap-allergen-evidence', 'XX', 40, 'B', '2'),
    (999969, '5901234999969', 'Phase5 Evidence Derived', 'Test Brand',
     'pgtap-allergen-evidence', 'XX', 40, 'B', '2'),
    (999968, '5901234999968', 'Phase5 Evidence Unknown', 'Test Brand',
     'pgtap-allergen-evidence', 'XX', 40, 'B', '2')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.product_allergen_info (
    product_id, tag, type, source_tag
)
VALUES (999971, 'milk', 'contains', 'en:milk');

INSERT INTO public.product_allergen_info (
    product_id, tag, type, evidence_basis
)
VALUES
    (999971, 'gluten', 'contains', 'ingredient_derived'),
    (999969, 'milk', 'contains', 'ingredient_derived');

INSERT INTO public.product_allergen_info (
    product_id, tag, type, source_tag
)
VALUES (999970, 'milk', 'traces', 'en:milk');

SELECT has_column(
    'public',
    'product_allergen_info',
    'evidence_basis',
    'positive allergen evidence records have a provenance basis'
);

SELECT is(
    (SELECT evidence_basis
     FROM public.product_allergen_info
     WHERE product_id = 999971 AND tag = 'milk'),
    'explicit_source',
    'source-tagged positive evidence is classified as explicit source'
);

SELECT is(
    (SELECT evidence_basis
     FROM public.product_allergen_info
     WHERE product_id = 999969 AND tag = 'milk'),
    'ingredient_derived',
    'deterministic ingredient evidence remains distinguishable'
);

SELECT is(
    jsonb_array_length(
        public.api_get_product_profile(999971)->'allergens'->'evidence'
    ),
    2,
    'profile returns mixed explicit and derived positive evidence'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            public.api_get_product_profile(999971)
                ->'allergens'->'evidence'
        ) item
        WHERE item->>'tag' = 'milk'
          AND item->>'evidence_type' = 'contains'
          AND item->>'evidence_basis' = 'explicit_source'
    ),
    'profile identifies explicit contains evidence'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            public.api_get_product_profile(999971)
                ->'allergens'->'evidence'
        ) item
        WHERE item->>'tag' = 'gluten'
          AND item->>'evidence_basis' = 'ingredient_derived'
    ),
    'profile identifies deterministic derived evidence'
);

SELECT is(
    public.api_get_product_profile(999971)
        ->'allergens'->>'evidence_status',
    'positive_evidence_available',
    'profile reports positive evidence without claiming completeness'
);

SELECT is(
    public.api_get_product_profile(999968)
        ->'allergens'->>'evidence_status',
    'unknown',
    'product with no positive rows reports evidence unknown'
);

SELECT is(
    public.api_get_product_profile(999968)
        ->'allergens'->>'absence_assessment',
    'not_assessed',
    'no evidence does not become assessed absence'
);

SELECT is(
    jsonb_array_length(
        public.api_get_product_profile(999968)
            ->'allergens'->'assessed_absent'
    ),
    0,
    'profile never synthesizes absent allergens'
);

SELECT ok(
    public.api_get_product_allergens(
        ARRAY[999971, 999970, 999969, 999968]::bigint[]
    ) ? '999968',
    'batch API returns an explicit payload for an unknown product'
);

SELECT is(
    jsonb_array_length(
        public.api_get_product_allergens(ARRAY[999968]::bigint[])
            ->'999968'->'evidence'
    ),
    0,
    'batch API unknown payload has no invented evidence'
);

SELECT is(
    public.api_get_product_allergens(ARRAY[999968]::bigint[])
        ->'999968'->>'evidence_status',
    'unknown',
    'batch API names the no-row state unknown'
);

SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM jsonb_array_elements(
            public.api_search_products(
                'Phase5 Evidence',
                '{"country":"XX","allergen_free":["milk"]}'::jsonb,
                1,
                20
            )->'results'
        ) result
        WHERE (result->>'product_id')::bigint = 999971
    ),
    0,
    'legacy filter key excludes matching explicit contains evidence'
);

SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM jsonb_array_elements(
            public.api_search_products(
                'Phase5 Evidence',
                '{"country":"XX","allergen_free":["milk"]}'::jsonb,
                1,
                20
            )->'results'
        ) result
        WHERE (result->>'product_id')::bigint = 999969
    ),
    0,
    'legacy filter key excludes matching ingredient-derived contains evidence'
);

SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM jsonb_array_elements(
            public.api_search_products(
                'Phase5 Evidence',
                '{"country":"XX","allergen_free":["milk"]}'::jsonb,
                1,
                20
            )->'results'
        ) result
        WHERE (result->>'product_id')::bigint = 999970
    ),
    1,
    'contains-evidence filter does not misrepresent may-contain as absent'
);

SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM jsonb_array_elements(
            public.api_search_products(
                'Phase5 Evidence',
                '{"country":"XX","allergen_free":["milk"]}'::jsonb,
                1,
                20
            )->'results'
        ) result
        WHERE (result->>'product_id')::bigint = 999968
    ),
    1,
    'contains-evidence filter keeps unknown products without calling them free'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            public.api_get_product_profile(999970)
                ->'allergens'->'evidence'
        ) item
        WHERE item->>'tag' = 'milk'
          AND item->>'evidence_type' = 'may_contain'
          AND item->>'evidence_basis' = 'explicit_source'
    ),
    'profile preserves explicit may-contain evidence'
);

SELECT is(
    jsonb_array_length(
        public.api_get_product_profile(999971)
            ->'allergens'->'assessed_absent'
    ),
    0,
    'unmentioned EU-14 allergens are not emitted as assessed absent'
);

CREATE TEMP TABLE phase5_allergen_checksum_before AS
SELECT md5(
    string_agg(
        concat_ws(':', product_id, tag, type, evidence_basis),
        '|' ORDER BY product_id, tag, type
    )
) AS checksum
FROM public.product_allergen_info
WHERE product_id BETWEEN 999968 AND 999971;

INSERT INTO public.product_allergen_info (
    product_id, tag, type, source_tag, evidence_basis
)
VALUES
    (999971, 'milk', 'contains', 'en:milk', 'explicit_source'),
    (999971, 'gluten', 'contains', NULL, 'ingredient_derived'),
    (999970, 'milk', 'traces', 'en:milk', 'explicit_source'),
    (999969, 'milk', 'contains', NULL, 'ingredient_derived')
ON CONFLICT (product_id, tag, type) DO UPDATE
SET source_tag = EXCLUDED.source_tag,
    evidence_basis = EXCLUDED.evidence_basis;

SELECT is(
    (
        SELECT md5(
            string_agg(
                concat_ws(':', product_id, tag, type, evidence_basis),
                '|' ORDER BY product_id, tag, type
            )
        )
        FROM public.product_allergen_info
        WHERE product_id BETWEEN 999968 AND 999971
    ),
    (SELECT checksum FROM phase5_allergen_checksum_before),
    'reapplying the same evidence produces an identical checksum'
);

SELECT * FROM finish();
ROLLBACK;
