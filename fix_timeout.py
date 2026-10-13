import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

# Connect using the admin URL
admin_url = os.environ["NEON_DB_URL"]

with psycopg.connect(admin_url, autocommit=True) as conn:
    # 1. Set a strict 5-second timeout for the reader role
    conn.execute("ALTER ROLE dwarpal_reader SET statement_timeout = '5s';")
    
    # 2. Terminate any lingering connections to force the pool to refresh
    conn.execute("""
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE usename = 'dwarpal_reader';
    """)
    print("✅ Timeout set to 5s and connection pool flushed.")
