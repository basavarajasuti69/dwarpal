import re

# Standard regex for emails
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
# Basic regex for US-style phone numbers
PHONE_REGEX = re.compile(r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')

def mask_email(match):
    email = match.group(0)
    local, domain = email.split('@')
    # Keep first character of the email, mask the rest
    masked_local = local[0] + "*" * (len(local) - 1) if len(local) > 1 else "*"
    return f"{masked_local}@{domain}"

def mask_phone(match):
    phone = match.group(0)
    # Extract just the digits to find the last 4
    digits = re.sub(r'\D', '', phone)
    if len(digits) >= 4:
        return f"***-***-{digits[-4:]}"
    return "***-***-****"

def redact_pii_from_string(text):
    if not isinstance(text, str):
        text = str(text)
    
    text = EMAIL_REGEX.sub(mask_email, text)
    text = PHONE_REGEX.sub(mask_phone, text)
    return text

def redact_sql_results(results):
    """Takes a list of tuples (SQL rows) and redacts PII from each column."""
    redacted_results = []
    for row in results:
        redacted_row = tuple(
            redact_pii_from_string(item) if item is not None else None 
            for item in row
        )
        redacted_results.append(redacted_row)
    return redacted_results
