import os
import hashlib
import json
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("NEON_DB_URL")
GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def init_audit_db():
    """Initializes the tamper-evident audit table if it does not exist."""
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_log_chain (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    user_prompt TEXT NOT NULL,
                    generated_sql TEXT,
                    status TEXT NOT NULL, -- 'ALLOWED', 'BLOCKED', 'ERROR'
                    pii_redacted BOOLEAN DEFAULT FALSE,
                    prev_hash VARCHAR(64) NOT NULL,
                    entry_hash VARCHAR(64) NOT NULL
                );
            """)
        conn.commit()

def compute_entry_hash(prev_hash: str, user_prompt: str, generated_sql: str, status: str, pii_redacted: bool) -> str:
    """Computes SHA-256 hash over entry attributes chained with prev_hash."""
    payload = json.dumps({
        "prev_hash": prev_hash,
        "user_prompt": user_prompt,
        "generated_sql": generated_sql or "",
        "status": status,
        "pii_redacted": pii_redacted
    }, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def log_audit_event(user_prompt: str, generated_sql: str, status: str, pii_redacted: bool = False) -> str:
    """Appends a new hash-chained record to the audit log."""
    init_audit_db()
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # Fetch last entry's hash
            cur.execute("SELECT entry_hash FROM audit_log_chain ORDER BY id DESC LIMIT 1;")
            row = cur.fetchone()
            prev_hash = row[0] if row else GENESIS_HASH

            # Compute current hash
            entry_hash = compute_entry_hash(prev_hash, user_prompt, generated_sql, status, pii_redacted)

            cur.execute("""
                INSERT INTO audit_log_chain (user_prompt, generated_sql, status, pii_redacted, prev_hash, entry_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (user_prompt, generated_sql, status, pii_redacted, prev_hash, entry_hash))
            entry_id = cur.fetchone()[0]
        conn.commit()
    return entry_hash

if __name__ == "__main__":
    init_audit_db()
    h1 = log_audit_event("Show top 5 customers", "SELECT * FROM dim_customers LIMIT 5;", "ALLOWED", False)
    print(f"✅ Audit log entry created. Entry Hash: {h1[:16]}...")
