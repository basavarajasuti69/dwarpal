from policy import check_question, validate_sql, load_allowed_tables

allowed = load_allowed_tables()

# 1. Test off-topic question check
print("--- Test 1: Off-topic Question ---")
print("Cookie question check:", check_question("What is the recipe for chocolate chip cookies?"))

# 2. Test SQL validation with forbidden DROP command
print("\n--- Test 2: SQL Validation (DROP TABLE) ---")
print("DROP TABLE validation:", validate_sql("DROP TABLE dim_customers;", allowed))

# 3. Test SQL validation with unauthorized table
print("\n--- Test 3: SQL Validation (Unauthorized Table) ---")
print("Staging table validation:", validate_sql("SELECT * FROM staging_customers;", allowed))
