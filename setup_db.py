import os
import psycopg
from psycopg import sql
from dotenv import load_dotenv

load_dotenv()
ADMIN_URL = os.getenv("NEON_DB_URL")

def setup_readonly_role():
    try:
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            with conn.cursor() as cur:
                print("✅ Connected to Neon successfully as Admin.")
                
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname='dwarpal_reader'")
                if not cur.fetchone():
                    cur.execute(sql.SQL("CREATE ROLE dwarpal_reader WITH LOGIN PASSWORD {}").format(sql.Literal(os.environ["DWARPAL_READER_PASSWORD"])))
                    print("✅ Created role 'dwarpal_reader'.")
                else:
                    print("ℹ️ Role 'dwarpal_reader' already exists.")
                
                cur.execute("GRANT USAGE ON SCHEMA public TO dwarpal_reader;")
                cur.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO dwarpal_reader;")
                cur.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dwarpal_reader;")
                print("✅ Granted read-only permissions on all current and future tables.")
                
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                tables = [row[0] for row in cur.fetchall()]
                print(f"📊 Found {len(tables)} tables: {', '.join(tables)}")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    setup_readonly_role()
