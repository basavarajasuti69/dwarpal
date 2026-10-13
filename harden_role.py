import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

ALLOWED_TABLES = [
    "dim_customers", "dim_products", "dim_sellers", "dim_date",
    "fact_order_items", "fact_payments", "fact_reviews",
    "ev_state_registrations", "ev_charging_stations",
]

STATEMENTS = [
    "REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM dwarpal_reader",
    "GRANT SELECT ON " + ", ".join(ALLOWED_TABLES) + " TO dwarpal_reader",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM dwarpal_reader",
    "ALTER ROLE dwarpal_reader SET default_transaction_read_only = on",
    "ALTER ROLE dwarpal_reader SET statement_timeout = '10s'",
]

with psycopg.connect(os.environ["NEON_DB_URL"], autocommit=True) as conn:
    for stmt in STATEMENTS:
        conn.execute(stmt)
        print("✅", stmt[:70])
print("Done. dwarpal_reader is now least-privilege.")
