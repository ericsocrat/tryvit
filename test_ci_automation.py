"""Focused regression tests for workflow input and health interpretation."""

from __future__ import annotations

import pytest

from scripts.evaluate_health_response import evaluate_health_response
from scripts.validate_max_products import parse_max_products


@pytest.mark.parametrize("status", ["healthy", "degraded"])
def test_successful_health_response_is_ready(status: str) -> None:
    ready, _ = evaluate_health_response(200, f'{{"status":"{status}"}}')
    assert ready is True


@pytest.mark.parametrize("http_status", [302, 401, 403, 503])
def test_non_success_health_response_is_not_ready(http_status: int) -> None:
    ready, _ = evaluate_health_response(http_status, '{"status":"unavailable"}')
    assert ready is False


@pytest.mark.parametrize(
    "body",
    ["", "not-json", '{"status":"unavailable"}', '{"status":"unknown"}'],
)
def test_ambiguous_health_response_is_not_ready(body: str) -> None:
    ready, _ = evaluate_health_response(200, body)
    assert ready is False


@pytest.mark.parametrize("value", ["0", "1", "500", "1000000"])
def test_max_products_accepts_non_negative_integers(value: str) -> None:
    assert parse_max_products(value) == int(value)


@pytest.mark.parametrize(
    "value",
    ["", "-1", "+1", "1.0", "1e3", " 10", "10 ", "ten", "1; echo bad"],
)
def test_max_products_rejects_malformed_values(value: str) -> None:
    with pytest.raises(ValueError, match="non-negative integer"):
        parse_max_products(value)
