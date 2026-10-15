"""Dwarpal Indian PII guard. Regex + checksum based; use with synthetic data only."""
import re

# --- Verhoeff checksum (used by Aadhaar) ---
_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def verhoeff_valid(number: str) -> bool:
    if not number.isdigit():
        return False
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def verhoeff_check_digit(number: str) -> int:
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[(i + 1) % 8][int(ch)]]
    return _INV[c]


# --- Detectors ---
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
AADHAAR_RE = re.compile(r"(?<!\w)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\w)")
PAN_RE = re.compile(r"(?<!\w)[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z](?!\w)", re.IGNORECASE)
UPI_RE = re.compile(r"(?<![\w.+-])[\w.-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}(?!\w|\.\w)")
MOBILE_RE = re.compile(r"(?<!\w)(?:(?:\+91|91|0)[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\w)")


def _aadhaar_sub(m: re.Match) -> str:
    digits = re.sub(r"\D", "", m.group())
    return "[REDACTED_AADHAAR]" if verhoeff_valid(digits) else m.group()


def redact_text(text: str) -> str:
    text = EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    text = AADHAAR_RE.sub(_aadhaar_sub, text)
    text = PAN_RE.sub("[REDACTED_PAN]", text)
    text = UPI_RE.sub("[REDACTED_UPI]", text)
    text = MOBILE_RE.sub("[REDACTED_MOBILE]", text)
    return text


def _redact_value(value):
    return redact_text(value) if isinstance(value, str) else value


def redact_sql_results(results):
    redacted = []
    for row in results:
        if isinstance(row, dict):
            redacted.append({k: _redact_value(v) for k, v in row.items()})
        elif isinstance(row, (list, tuple)):
            redacted.append(tuple(_redact_value(v) for v in row))
        else:
            redacted.append(_redact_value(row))
    return redacted
