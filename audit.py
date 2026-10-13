import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

def log_security_event(event_type: str, question: str, sql: str = None, reason: str = None):
    admin_url = os.environ.get("NEON_DB_URL")
    if not admin_url:
        return
    try:
        with psycopg.connect(admin_url, autocommit=True) as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (event_type, user_question, generated_sql, block_reason)
                VALUES (%s, %s, %s, %s)
                """,
                (event_type, question, sql, reason)
            )
    except Exception as e:
        print(f"⚠️ Failed to log audit event: {e}")
