from pii_guard import redact_sql_results

# Mock database rows containing sensitive PII
mock_rows = [
    (1, "Alice Smith", "alice.smith@example.com", "555-019-2834"),
    (2, "Bob Jones", "bob_jones123@workplace.org", "+1 (555) 867-5309"),
    (3, "Charlie", None, None)
]

redacted = redact_sql_results(mock_rows)

print("Original Mock Data:")
for row in mock_rows:
    print(row)

print("\nRedacted Results:")
for row in redacted:
    print(row)

# Assertions matching the dynamic masking implementation
assert redacted[0][2] == "a**********@example.com"
assert redacted[0][3] == "***-***-2834"
assert redacted[1][2] == "b***********@workplace.org"
assert redacted[2][2] is None
print("\n✅ All PII guard tests passed successfully!")
