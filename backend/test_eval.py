from fastapi.testclient import TestClient
from backend import main

client = TestClient(main.app)


def test_valid_user_query(monkeypatch):
    monkeypatch.setattr(
        main,
        "_generate_sql",
        lambda question: main.SqlGeneration(
            sql="SELECT COUNT(*) AS customer_count FROM dim_customers",
            rationale="Counts the customer records.",
        ),
    )
    monkeypatch.setattr(
        main,
        "_execute_read_only_query",
        lambda sql: (["customer_count"], [(42,)]),
    )
    monkeypatch.setattr(main, "_audit", lambda *args: "test-audit-hash")

    response = client.post("/api/query", json={"question": "How many users are active?"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ALLOWED"
    assert data["success"] is True
    assert "SELECT" in data["sql"]
    assert data["results"] == [{"customer_count": 42}]
    assert data["source"] == "live"
    assert data["chart"] == "bar"


def test_blocked_destructive_sql(monkeypatch):
    monkeypatch.setattr(
        main,
        "_generate_sql",
        lambda question: main.SqlGeneration(
            sql="DROP TABLE dim_customers",
            rationale="Destructive query.",
        ),
    )
    monkeypatch.setattr(main, "_audit", lambda *args: "test-audit-hash")

    response = client.post("/api/query", json={"question": "Remove the customer table"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "BLOCKED"
    assert data["success"] is False
    assert "Only SELECT queries are allowed" in data["rationale"]


def test_pii_redaction_presence(monkeypatch):
    monkeypatch.setattr(
        main,
        "_generate_sql",
        lambda question: main.SqlGeneration(
            sql="SELECT customer_unique_id FROM dim_customers",
            rationale="Returns customer identifiers.",
        ),
    )
    monkeypatch.setattr(
        main,
        "_execute_read_only_query",
        lambda sql: (["email"], [("customer@example.com",)]),
    )
    monkeypatch.setattr(main, "_audit", lambda *args: "test-audit-hash")

    response = client.post("/api/query", json={"question": "Show me all user emails"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ALLOWED"
    assert data["results"] == [{"email": "[REDACTED_EMAIL]"}]


def test_time_series_query_uses_line_chart(monkeypatch):
    monkeypatch.setattr(
        main,
        "_generate_sql",
        lambda question: main.SqlGeneration(
            sql="SELECT full_date, COUNT(*) AS total FROM dim_date GROUP BY full_date",
            rationale="Counts records by date.",
        ),
    )
    monkeypatch.setattr(
        main,
        "_execute_read_only_query",
        lambda sql: (["full_date", "total"], [("2026-01-01", 5)]),
    )
    monkeypatch.setattr(main, "_audit", lambda *args: "test-audit-hash")

    response = client.post("/api/query", json={"question": "Show records by date"})
    assert response.status_code == 200
    assert response.json()["chart"] == "line"
