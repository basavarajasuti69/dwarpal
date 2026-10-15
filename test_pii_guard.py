import pytest
from pii_guard import (
    redact_sql_results, redact_text, verhoeff_check_digit, verhoeff_valid,
)


def make_aadhaar(first11: str = "23456789012") -> str:
    return first11 + str(verhoeff_check_digit(first11))


def test_verhoeff_known_example():
    assert verhoeff_check_digit("236") == 3
    assert verhoeff_valid("2363")
    assert not verhoeff_valid("2364")


def test_valid_aadhaar_is_redacted_plain_and_spaced():
    a = make_aadhaar()
    for text in (a, f"{a[:4]} {a[4:8]} {a[8:]}"):
        out = redact_text(f"id: {text}")
        assert "[REDACTED_AADHAAR]" in out
        assert a[:4] not in out


def test_wrong_checksum_is_not_treated_as_aadhaar():
    a = make_aadhaar()
    bad = a[:-1] + str((int(a[-1]) + 1) % 10)
    assert "[REDACTED_AADHAAR]" not in redact_text(bad)


def test_pan_valid_and_invalid_holder_type():
    assert "[REDACTED_PAN]" in redact_text("PAN ABCPE1234F")
    assert "[REDACTED_PAN]" not in redact_text("code ABCZE1234F")


@pytest.mark.parametrize("value", [
    "9876543210", "+91 98765 43210", "09876543210", "91-9876543210",
])
def test_indian_mobile_numbers(value):
    assert redact_text(value) == "[REDACTED_MOBILE]"


def test_number_starting_with_5_is_not_a_mobile():
    assert redact_text("5876543210") == "5876543210"


def test_upi_and_email_are_distinguished():
    assert redact_text("rahul.sharma@okhdfcbank") == "[REDACTED_UPI]"
    assert redact_text("rahul@gmail.com") == "[REDACTED_EMAIL]"


def test_normal_olist_values_are_untouched():
    for v in ["23f1d9792d6032bbdb97d6ae3988d21f", "sao paulo", "78320", "SP"]:
        assert redact_text(v) == v


def test_redact_sql_results_keeps_shape_and_non_strings():
    rows = [("a", "9876543210", 5), ("b", "x", 6)]
    assert redact_sql_results(rows) == [("a", "[REDACTED_MOBILE]", 5), ("b", "x", 6)]
    rows = [{"phone": "9876543210", "n": 5}]
    assert redact_sql_results(rows) == [{"phone": "[REDACTED_MOBILE]", "n": 5}]
