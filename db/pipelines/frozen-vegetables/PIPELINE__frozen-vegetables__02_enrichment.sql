-- Generated deterministic ingredient/allergen enrichment
-- Category: Frozen Vegetables
-- Source: committed OFF-derived snapshot 20260601173035
-- Identity: products(country, ean); absence of rows means unknown.
BEGIN;

INSERT INTO ingredient_ref
  (name_en, is_additive, vegan, vegetarian, from_palm_oil)
VALUES
  ('Bamboo Shoot', false, 'yes', 'yes', 'unknown'),
  ('Bell Pepper', false, 'yes', 'yes', 'unknown'),
  ('Black Pepper', false, 'yes', 'yes', 'unknown'),
  ('Boletus', false, 'yes', 'yes', 'unknown'),
  ('Breadcrumbs', false, 'maybe', 'maybe', 'unknown'),
  ('Broccoli', false, 'yes', 'yes', 'unknown'),
  ('Carrot', false, 'yes', 'yes', 'unknown'),
  ('Chicken Breast Fillet', false, 'no', 'no', 'unknown'),
  ('Chicken Meat', false, 'no', 'no', 'unknown'),
  ('Chili Pepper', false, 'yes', 'yes', 'unknown'),
  ('Chives', false, 'yes', 'yes', 'unknown'),
  ('Cinnamon', false, 'yes', 'yes', 'unknown'),
  ('Colza Oil', false, 'yes', 'yes', 'no'),
  ('Coriander', false, 'yes', 'yes', 'unknown'),
  ('Corn Flour', false, 'yes', 'yes', 'unknown'),
  ('Cumin', false, 'yes', 'yes', 'unknown'),
  ('Dehydrated Onion', false, 'yes', 'yes', 'unknown'),
  ('Dextrose', false, 'yes', 'yes', 'unknown'),
  ('Durum Wheat Semolina', false, 'yes', 'yes', 'unknown'),
  ('Emmental', false, 'no', 'maybe', 'unknown'),
  ('Fresh Cream', false, 'no', 'yes', 'unknown'),
  ('Garlic', false, 'yes', 'yes', 'unknown'),
  ('Ginger', false, 'yes', 'yes', 'unknown'),
  ('Green Bean', false, 'yes', 'yes', 'unknown'),
  ('Green Peas', false, 'yes', 'yes', 'unknown'),
  ('Grzyby Chińskie', false, 'unknown', 'unknown', 'unknown'),
  ('Hydrolysed Soy Protein', false, 'yes', 'yes', 'unknown'),
  ('Issu De Poules Elevees En Plein Air', false, 'unknown', 'unknown', 'unknown'),
  ('Lactic Ferments', false, 'maybe', 'yes', 'unknown'),
  ('Leek', false, 'yes', 'yes', 'unknown'),
  ('Makaron Noodle Gotowany', false, 'unknown', 'unknown', 'unknown'),
  ('Milk', false, 'unknown', 'unknown', 'unknown'),
  ('Natural Flavouring', false, 'maybe', 'maybe', 'unknown'),
  ('Onion', false, 'yes', 'yes', 'unknown'),
  ('Paprika Or Bell Pepper', false, 'yes', 'yes', 'unknown'),
  ('Pepper', false, 'yes', 'yes', 'unknown'),
  ('Powdered Egg White', false, 'no', 'yes', 'unknown'),
  ('Przyprawa W Saszetce', false, 'unknown', 'unknown', 'unknown'),
  ('Rice Flakes', false, 'yes', 'yes', 'unknown'),
  ('Salt', false, 'yes', 'yes', 'unknown'),
  ('Snow Pea', false, 'yes', 'yes', 'unknown'),
  ('Sugar', false, 'maybe', 'yes', 'unknown'),
  ('Sunflower Oil', false, 'yes', 'yes', 'no'),
  ('Szpinak Liście Zamrożone', false, 'unknown', 'unknown', 'unknown'),
  ('Tomato', false, 'yes', 'yes', 'unknown'),
  ('Turmeric', false, 'yes', 'yes', 'unknown'),
  ('Vegetable', false, 'yes', 'yes', 'unknown'),
  ('Water', false, 'yes', 'yes', 'unknown'),
  ('Wheat Flour', false, 'yes', 'yes', 'unknown'),
  ('Yeast', false, 'yes', 'yes', 'unknown'),
  ('Yellow Mustard Seed', false, 'yes', 'yes', 'unknown')
ON CONFLICT (name_en) DO NOTHING;

WITH evidence(country, ean, ingredient_name, position, percent, percent_estimate, is_sub, parent_name) AS (
 VALUES
  ('PL', '3083680014601', 'Snow Pea', 1, NULL::numeric, 100::numeric, false, NULL),
  ('PL', '3083681147834', 'Broccoli', 1, 56.8::numeric, 56.8::numeric, false, NULL),
  ('PL', '3083681147834', 'Breadcrumbs', 2, NULL::numeric, 17.5::numeric, false, NULL),
  ('PL', '3083681147834', 'Wheat Flour', 3, NULL::numeric, 9.26::numeric, true, 'Breadcrumbs'),
  ('PL', '3083681147834', 'Yeast', 4, NULL::numeric, 4.12::numeric, true, 'Breadcrumbs'),
  ('PL', '3083681147834', 'Salt', 5, NULL::numeric, 0.41::numeric, true, 'Breadcrumbs'),
  ('PL', '3083681147834', 'Colza Oil', 6, NULL::numeric, 3.7::numeric, true, 'Breadcrumbs'),
  ('PL', '3083681147834', 'Sunflower Oil', 7, NULL::numeric, 14.9::numeric, false, NULL),
  ('PL', '3083681147834', 'Water', 8, NULL::numeric, 7.45::numeric, false, NULL),
  ('PL', '3083681147834', 'Emmental', 9, 4.1::numeric, 3.35::numeric, false, NULL),
  ('PL', '3083681147834', 'Milk', 10, NULL::numeric, 2.9::numeric, true, 'Emmental'),
  ('PL', '3083681147834', 'Salt', 11, NULL::numeric, 0.23::numeric, true, 'Emmental'),
  ('PL', '3083681147834', 'Lactic Ferments', 12, NULL::numeric, 0.23::numeric, true, 'Emmental'),
  ('PL', '3083681147834', 'Fresh Cream', 13, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Wheat Flour', 14, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Salt', 15, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Corn Flour', 16, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Rice Flakes', 17, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Powdered Egg White', 18, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Issu De Poules Elevees En Plein Air', 19, NULL::numeric, 0::numeric, true, 'Powdered Egg White'),
  ('PL', '3083681147834', 'Chives', 20, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '3083681147834', 'Pepper', 21, NULL::numeric, 0::numeric, false, NULL),
  ('PL', '5901581210176', 'Broccoli', 1, 100::numeric, 100::numeric, false, NULL),
  ('PL', '5901581211173', 'Carrot', 1, 60::numeric, 60::numeric, false, NULL),
  ('PL', '5901581211173', 'Green Peas', 2, 40::numeric, 40::numeric, false, NULL),
  ('PL', '5902966000337', 'Szpinak Liście Zamrożone', 1, NULL::numeric, 100::numeric, false, NULL),
  ('PL', '5907431389788', 'Vegetable', 1, 47::numeric, 47::numeric, false, NULL),
  ('PL', '5907431389788', 'Paprika Or Bell Pepper', 2, NULL::numeric, 47::numeric, true, 'Vegetable'),
  ('PL', '5907431389788', 'Carrot', 3, NULL::numeric, 26.5::numeric, false, NULL),
  ('PL', '5907431389788', 'Green Bean', 4, NULL::numeric, 13.25::numeric, false, NULL),
  ('PL', '5907431389788', 'Leek', 5, NULL::numeric, 6.62::numeric, false, NULL),
  ('PL', '5907431389788', 'Onion', 6, NULL::numeric, 3.31::numeric, false, NULL),
  ('PL', '5907431389788', 'Bamboo Shoot', 7, NULL::numeric, 1.66::numeric, false, NULL),
  ('PL', '5907431389788', 'Makaron Noodle Gotowany', 8, 30::numeric, 1.66::numeric, false, NULL),
  ('PL', '5907431389788', 'Water', 9, NULL::numeric, 0.83::numeric, true, 'Makaron Noodle Gotowany'),
  ('PL', '5907431389788', 'Durum Wheat Semolina', 10, NULL::numeric, 0.83::numeric, true, 'Makaron Noodle Gotowany'),
  ('PL', '5907431389788', 'Chicken Meat', 11, 15::numeric, 0::numeric, false, NULL),
  ('PL', '5907431389788', 'Chicken Breast Fillet', 12, NULL::numeric, 0::numeric, true, 'Chicken Meat'),
  ('PL', '5907431389788', 'Dextrose', 13, NULL::numeric, 0::numeric, true, 'Chicken Meat'),
  ('PL', '5907431389788', 'Salt', 14, NULL::numeric, 0::numeric, true, 'Chicken Meat'),
  ('PL', '5907431389788', 'Grzyby Chińskie', 15, 7::numeric, 0::numeric, false, NULL),
  ('PL', '5907431389788', 'Przyprawa W Saszetce', 16, 1::numeric, 0::numeric, false, NULL),
  ('PL', '5907431389788', 'Salt', 17, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Sugar', 18, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Hydrolysed Soy Protein', 19, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Tomato', 20, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Dehydrated Onion', 21, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Turmeric', 22, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Bell Pepper', 23, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Garlic', 24, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Ginger', 25, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Chili Pepper', 26, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Cumin', 27, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Cinnamon', 28, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Coriander', 29, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Black Pepper', 30, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Yellow Mustard Seed', 31, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Boletus', 32, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce'),
  ('PL', '5907431389788', 'Natural Flavouring', 33, NULL::numeric, 0::numeric, true, 'Przyprawa W Saszetce')
)
INSERT INTO product_ingredient
  (product_id, ingredient_id, position, percent, percent_estimate, is_sub_ingredient, parent_ingredient_id)
SELECT p.product_id, i.ingredient_id, e.position, e.percent, e.percent_estimate,
       e.is_sub, parent_i.ingredient_id
FROM evidence e
JOIN products p ON p.country = e.country AND p.ean = e.ean
  AND p.category = 'Frozen Vegetables' AND p.is_deprecated IS NOT TRUE
JOIN ingredient_ref i ON i.name_en = e.ingredient_name
LEFT JOIN ingredient_ref parent_i ON parent_i.name_en = e.parent_name
WHERE e.is_sub IS FALSE OR parent_i.ingredient_id IS NOT NULL
ON CONFLICT (product_id, ingredient_id, position) DO NOTHING;

WITH evidence(country, ean, tag, type, source_tag) AS (
 VALUES
  ('PL', '3083680014601', 'celery', 'traces', 'celery'),
  ('PL', '3083681147834', 'celery', 'traces', 'celery'),
  ('PL', '3083681147834', 'eggs', 'contains', 'eggs'),
  ('PL', '3083681147834', 'gluten', 'contains', 'gluten'),
  ('PL', '3083681147834', 'milk', 'contains', 'milk'),
  ('PL', '5901581210176', 'celery', 'traces', 'celery'),
  ('PL', '5907431389788', 'celery', 'traces', 'celery'),
  ('PL', '5907431389788', 'eggs', 'traces', 'eggs'),
  ('PL', '5907431389788', 'gluten', 'contains', 'gluten'),
  ('PL', '5907431389788', 'mustard', 'contains', 'mustard'),
  ('PL', '5907431389788', 'soybeans', 'contains', 'soybeans')
)
INSERT INTO product_allergen_info (product_id, tag, type, source_tag)
SELECT p.product_id, e.tag, e.type, e.source_tag
FROM evidence e
JOIN products p ON p.country = e.country AND p.ean = e.ean
  AND p.category = 'Frozen Vegetables' AND p.is_deprecated IS NOT TRUE
JOIN allergen_ref a ON a.allergen_id = e.tag AND a.is_active IS TRUE
ON CONFLICT (product_id, tag, type) DO NOTHING;

COMMIT;
