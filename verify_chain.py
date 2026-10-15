import os
import psycopg
from dotenv import load_dotenv
from audit_chain import compute_entry_hash, GENESIS_HASH

load_dotenv()
DB_URL = os.getenv("NEON_DB_URL")

def verify_audit_chain():
    """Traverses the audit table and verifies SHA-256 hash continuity."""
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, user_prompt, generated_sql, status, pii_redacted, prev_hash, entry_hash FROM audit_log_chain ORDER BY id ASC;")
            rows = cur.fetchall()

    if not rows:
        print("ℹ️ Audit log chain is empty.")
        return True

    expected_prev = GENESIS_HASH
    for row in rows:
        entry_id, user_prompt, generated_sql, status, pii_redacted, prev_hash, entry_hash = row

        # Check hash linkage
        if prev_hash != expected_prev:
            print(f"❌ TAMPER DETECTED at ID {entry_id}: Previous hash mismatch!")
            print(f"   Expected: {expected_prev}")
            print(f"   Found:    {prev_hash}")
            return False

        # Re-compute hash
        recalculated_hash = compute_entry_hash(prev_hash, user_prompt, generated_sql, status, pii_redacted)
        if recalculated_hash != entry_hash:
            print(f"❌ TAMPER DETECTED at ID {entry_id}: Data modified!")
            print(f"   Stored Hash:      {entry_hash}")
            print(f"   Recalculated:     {recalculated_hash}")
            return False

        expected_prev = entry_hash

    print(f"✅ Audit log chain verified successfully. ({len(rows)} records verified, integrity intact)")
    return True

if __name__ == "__main__":
    verify_audit_chain()
