import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
ADMIN_URL = os.getenv("NEON_DB_URL")

EV_REGISTRATIONS_DATA = [
    ("Karnataka", "2W", 2024, 115000),
    ("Karnataka", "4W", 2024, 18500),
    ("Maharashtra", "2W", 2024, 142000),
    ("Maharashtra", "4W", 2024, 24000),
    ("Delhi", "2W", 2024, 78000),
    ("Delhi", "4W", 2024, 15200),
    ("Tamil Nadu", "2W", 2024, 92000),
    ("Tamil Nadu", "4W", 2024, 11000),
    ("Gujarat", "2W", 2024, 85000),
    ("Gujarat", "4W", 2024, 13500)
]

EV_CHARGING_DATA = [
    ("Karnataka", 5200, 1800),
    ("Maharashtra", 6100, 2100),
    ("Delhi", 4300, 1500),
    ("Tamil Nadu", 3800, 1200),
    ("Gujarat", 3400, 1100)
]

def load_ev_data() -> None:
    try:
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            with conn.cursor() as cur:
                print("🔄 Creating India EV tables...")
                
                # 1. State-wise EV Registrations Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS ev_state_registrations (
                        id SERIAL PRIMARY KEY,
                        state_name VARCHAR(100) NOT NULL,
                        vehicle_category VARCHAR(50) NOT NULL,
                        registration_year INT NOT NULL,
                        total_units INT NOT NULL
                    );
                """)

                # 2. EV Charging Stations Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS ev_charging_stations (
                        id SERIAL PRIMARY KEY,
                        state_name VARCHAR(100) NOT NULL,
                        public_chargers INT NOT NULL,
                        fast_chargers INT NOT NULL
                    );
                """)

                # Clear old sample rows if re-running
                cur.execute("TRUNCATE TABLE ev_state_registrations, ev_charging_stations;")

                # Populate Registrations
                cur.executemany("""
                    INSERT INTO ev_state_registrations (state_name, vehicle_category, registration_year, total_units)
                    VALUES (%s, %s, %s, %s);
                """, EV_REGISTRATIONS_DATA)

                # Populate Charging Stations
                cur.executemany("""
                    INSERT INTO ev_charging_stations (state_name, public_chargers, fast_chargers)
                    VALUES (%s, %s, %s);
                """, EV_CHARGING_DATA)

                # Grant permissions to read-only user
                cur.execute("GRANT SELECT ON ev_state_registrations, ev_charging_stations TO dwarpal_reader;")
                
                print("✅ Successfully created and populated 'ev_state_registrations' and 'ev_charging_stations'.")
                print("✅ Granted read access to 'dwarpal_reader'.")

    except Exception as e:
        print(f"❌ Error loading EV data: {e}")

if __name__ == "__main__":
    load_ev_data()
