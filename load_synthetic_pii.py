"""Creates synthetic_customers with FAKE personal identifiers for testing the PII guard."""
import os
import random

import psycopg
from dotenv import load_dotenv

from pii_guard import verhoeff_check_digit

load_dotenv()
rng = random.Random(42)

CITIES = ["Bengaluru", "Hyderabad", "Pune", "Mumbai", "Chennai", "Delhi"]
HANDLES = ["okhdfcbank", "oksbi", "okicici", "ybl", "paytm"]
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def digits(n):
    return "".join(rng.choice("0123456789") for _ in range(n))


def fake_aadhaar(spaced):
    first11 = rng.choice("23456789") + digits(10)
    number = first11 + str(verhoeff_check_digit(first11))
    return f"{number[:4]} {number[4:8]} {number[8:]}" if spaced else number


def fake_pan():
    pick = lambda: rng.choice(LETTERS)
    return pick() + pick() + pick() + "P" + pick() + digits(4) + pick()


rows = []
for n in range(1, 26):
    rows.append((
        f"Test Customer {n:02d}",
        f"test.user{n}@example.com",
        rng.choice("6789") + digits(9),
        fake_aadhaar(spaced=(n % 2 == 0)),
        fake_pan(),
        f"test.user{n}@{rng.choice(HANDLES)}",
        rng.choice(CITIES),
        rng.choice([2022, 2023, 2024, 2025]),
    ))

with psycopg.connect(os.environ["NEON_DB_URL"], autocommit=True) as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS synthetic_customers (
            id SERIAL PRIMARY KEY,
            full_name TEXT, email TEXT, mobile TEXT, aadhaar TEXT,
            pan TEXT, upi_id TEXT, city TEXT, signup_year INT
        )
    """)
    conn.execute("TRUNCATE TABLE synthetic_customers RESTART IDENTITY")
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO synthetic_customers "
            "(full_name, email, mobile, aadhaar, pan, upi_id, city, signup_year) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
    conn.execute("GRANT SELECT ON synthetic_customers TO dwarpal_reader")
print(f"✅ Loaded {len(rows)} synthetic customers and granted SELECT to dwarpal_reader")
