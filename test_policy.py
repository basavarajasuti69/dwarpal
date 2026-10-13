import pytest
from policy import validate_sql

ALLOWED = {"dim_customers", "dim_sellers", "fact_reviews", "ev_charging_stations"}

BAD_QUERIES = [
    "",
    "DELETE FROM dim_customers",
    "DROP TABLE dim_customers",
    "UPDATE dim_customers SET customer_id = 1",
    "SELECT 1; DROP TABLE dim_customers",
    "SELECT * FROM staging_customers",
    "SELECT * FROM information_schema.tables",
    "SELECT pg_sleep(10)",
    "SELECT * INTO new_table FROM dim_customers",
    "SELECT * FROM dim_customers FOR UPDATE",
    "SELECT * FROM dim_customers a JOIN staging_orders b ON 1=1",
    "WITH x AS (DELETE FROM dim_customers RETURNING *) SELECT * FROM x",
]


@pytest.mark.parametrize("query", BAD_QUERIES)
def test_bad_queries_are_rejected(query):
    result = validate_sql(query, ALLOWED)
    assert not result.allowed, f"Should have been rejected: {query}"
    assert result.sql is None


def test_simple_select_is_allowed_and_gets_limit():
    result = validate_sql("SELECT COUNT(*) FROM dim_customers", ALLOWED)
    assert result.allowed
    assert "LIMIT 1000" in result.sql


def test_table_names_are_case_insensitive():
    assert validate_sql("select * from DIM_CUSTOMERS", ALLOWED).allowed


def test_cte_is_allowed():
    sql = "WITH t AS (SELECT * FROM dim_customers) SELECT COUNT(*) FROM t"
    assert validate_sql(sql, ALLOWED).allowed


def test_large_limit_is_capped():
    result = validate_sql("SELECT * FROM dim_customers LIMIT 50000", ALLOWED)
    assert result.allowed and "LIMIT 1000" in result.sql


def test_small_limit_is_kept():
    result = validate_sql("SELECT * FROM dim_customers LIMIT 5", ALLOWED)
    assert result.allowed and "LIMIT 5" in result.sql


from policy import check_question


@pytest.mark.parametrize("question", [
    "Show me everything in staging_customers",
    "what is in STAGING_ORDERS?",
    "dump pipeline_run_log",
])
def test_restricted_table_questions_are_blocked(question):
    assert not check_question(question).allowed


def test_normal_question_passes_question_check():
    assert check_question("What is the average review score?").allowed
