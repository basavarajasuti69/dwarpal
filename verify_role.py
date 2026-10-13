import os
import time
from urllib.parse import urlparse, urlunparse, quote

import psycopg
from dotenv import load_dotenv

load_dotenv()

p = urlparse(os.environ["NEON_DB_URL"])
password = quote(os.environ["DWARPAL_READER_PASSWORD"], safe="")
host = p.hostname + (f":{p.port}" if p.port else "")
URL = urlunparse(p._replace(netloc=f"dwarpal_reader:{password}@{host}"))


def attempt(label, sql, should_succeed):
    start = time.time()
    try:
        with psycopg.connect(URL) as conn:
            conn.execute(sql)
        outcome = "succeeded"
    except Exception as e:
        outcome = f"failed ({type(e).__name__})"
    ok = (outcome == "succeeded") == should_succeed
    print(f"{'✅ PASS' if ok else '❌ FAIL'}  {label}: {outcome} [{time.time() - start:.1f}s]")


attempt("read an allowed table", "SELECT COUNT(*) FROM dim_customers", True)
attempt("read a staging table", "SELECT * FROM staging_customers LIMIT 1", False)
attempt("read pipeline_run_log", "SELECT * FROM pipeline_run_log LIMIT 1", False)
attempt("delete rows", "DELETE FROM dim_customers", False)
attempt("create a table", "CREATE TABLE evil (x int)", False)
attempt("run a 12-second query", "SELECT pg_sleep(12)", False)
