import os

import psycopg
import yaml
from dotenv import load_dotenv

load_dotenv()

with psycopg.connect(os.environ["NEON_DB_URL"], autocommit=True) as conn:
    conn.execute("""
        CREATE OR REPLACE VIEW synthetic_customers_safe AS
        SELECT id, full_name, city, signup_year,
               right(mobile, 4) AS mobile_last4,
               right(replace(aadhaar, ' ', ''), 4) AS aadhaar_last4
        FROM synthetic_customers
    """)
    conn.execute("REVOKE SELECT ON synthetic_customers FROM dwarpal_reader")
    conn.execute("GRANT SELECT ON synthetic_customers_safe TO dwarpal_reader")
print("✅ View created; reader can no longer read synthetic_customers")

with open("schema.yaml") as f:
    schema = yaml.safe_load(f)

hidden = ("synthetic_customers", "synthetic_customers_safe")
schema["tables"] = [t for t in schema["tables"] if t["name"] not in hidden]
cols = [("id", "integer"), ("full_name", "text"), ("city", "text"),
        ("signup_year", "integer"), ("mobile_last4", "text"), ("aadhaar_last4", "text")]
schema["tables"].append({
    "name": "synthetic_customers_safe",
    "description": "SYNTHETIC customers, masked view: identifiers are reduced to their last 4 digits. Raw PII is not available.",
    "columns": [{"name": n, "type": t, "description": ""} for n, t in cols],
})
schema["examples"] = [e for e in schema.get("examples", []) if e.get("domain") != "Synthetic PII"]
schema["examples"].append({
    "domain": "Synthetic PII",
    "question": "How many synthetic customers are in each city?",
    "sql": "SELECT city, COUNT(*) FROM synthetic_customers_safe GROUP BY city ORDER BY COUNT(*) DESC;",
})
with open("schema.yaml", "w") as f:
    yaml.dump(schema, f, default_flow_style=False, sort_keys=False)
print("✅ schema.yaml now exposes only the masked view")
