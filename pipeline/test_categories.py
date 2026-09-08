"""Conservative taxonomy regression from the frozen source cohort."""

import pytest

from pipeline.categories import CATEGORY_POLICY_VERSION, resolve_category

SKYR_TAGS = [
    "en:dairies",
    "en:fermented-foods",
    "en:fermented-milk-products",
    "en:desserts",
    "en:dairy-desserts",
    "en:fermented-dairy-desserts",
    "en:fromages-blancs-petit-suisses-and-skyr",
    "en:yogurts",
    "en:plain-fermented-dairy-desserts",
    "en:skyrs",
    "en:plain-skyrs",
]


def test_retained_skyr_leaf_wins_over_broad_dessert_ancestor():
    assert resolve_category(SKYR_TAGS) == "Dairy"
    assert resolve_category(list(reversed(SKYR_TAGS))) == "Dairy"
    assert CATEGORY_POLICY_VERSION == "off-category-v1.1"


@pytest.mark.parametrize("specific", ["en:ice-creams", "en:puddings", "en:frozen-desserts"])
def test_actual_dessert_with_skyr_ingredient_does_not_become_plain_dairy(specific):
    assert resolve_category(["en:desserts", specific, "en:skyrs"]) == "Desserts & Ice Cream"


def test_baby_skyr_remains_baby_category():
    assert resolve_category(["en:baby-foods", "en:skyrs", "en:desserts"]) == "Baby"


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        (["en:snacks", "en:chips"], "Chips"),
        (["en:beverages", "en:alcoholic-beverages"], "Alcohol"),
        (["en:desserts", "en:ice-creams"], "Desserts & Ice Cream"),
        (["en:dairies", "en:milks"], "Dairy"),
        (["en:unmapped"], None),
    ],
)
def test_unrelated_resolution_preserved(tags, expected):
    assert resolve_category(tags) == expected
