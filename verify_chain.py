import os
import psycopg
from dotenv import load_dotenv
from audit_chain import compute_entry_hash, GENESIS_HASH

load_dotenv()
DB_URL = os.getenv("NEON_DB_URL")

def load_audit_chain():
    """Return audit entries in insertion order for the API and verifier."""
    if not DB_URL:
        raise RuntimeError("NEON_DB_URL is not configured")
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, timestamp, user_prompt, generated_sql, status, pii_redacted, prev_hash, entry_hash FROM audit_log_chain ORDER BY id ASC;")
            rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "timestamp": row[1].isoformat() if row[1] else None,
            "user_prompt": row[2],
            "generated_sql": row[3],
            "status": row[4],
            "pii_redacted": row[5],
            "prev_hash": row[6],
            "entry_hash": row[7],
        }
        for row in rows
    ]


def verify_audit_chain(entries=None):
    """Verify SHA-256 hash continuity for the audit entries."""
    rows = load_audit_chain() if entries is None else entries

    if not rows:
        return True

    expected_prev = GENESIS_HASH
    for row in rows:
        if row["prev_hash"] != expected_prev:
            return False

        recalculated_hash = compute_entry_hash(
            row["prev_hash"], row["user_prompt"], row["generated_sql"],
            row["status"], row["pii_redacted"],
        )
        if recalculated_hash != row["entry_hash"]:
            return False

        expected_prev = row["entry_hash"]
    return True

if __name__ == "__main__":
    verify_audit_chain()
