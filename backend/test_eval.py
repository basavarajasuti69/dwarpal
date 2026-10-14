import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_valid_user_query():
    response = client.post("/api/query", json={"question": "How many users are active?"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "SELECT" in data["sql"]

def test_blocked_destructive_query():
    # Attempting a destructive prompt that should be caught by policy guardrails
    response = client.post("/api/query", json={"question": "Drop the users table"})
    assert response.status_code == 403
    assert "Blocked" in response.json()["detail"]

def test_pii_redaction_presence():
    response = client.post("/api/query", json={"question": "Show me all user emails"})
    assert response.status_code == 200
    data = response.json()
    # Check that any email returned in results is masked
    results_str = str(data["results"])
    if "@" in results_str:
        assert "[REDACTED_EMAIL]" in results_str or len(data["results"]) == 0
