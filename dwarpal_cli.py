import os
from policy import check_question, load_allowed_tables, validate_sql
import time
from urllib.parse import urlparse, urlunparse, quote
from google import genai
from pii_guard import redact_sql_results
import psycopg
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# 1. Define the exact JSON structure we want from Gemini
class SqlGeneration(BaseModel):
    sql: str
    rationale: str

def get_readonly_url(admin_url: str) -> str:
    """Converts the admin DB URL to use the read-only credentials."""
    parsed = urlparse(admin_url)
    netloc = f"dwarpal_reader:{os.environ['DWARPAL_READER_PASSWORD']}@{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    return urlunparse(parsed._replace(netloc=netloc))

from audit import log_security_event

def execute_sql_with_self_correction(initial_sql: str, schema_text: str, question: str, readonly_url: str, max_retries=2):
    """Executes SQL against the database with automated AI self-correction on failure."""
    client = genai.Client()
    current_sql = initial_sql
    
    for attempt in range(max_retries + 1):
        try:
            with psycopg.connect(readonly_url) as conn:
                with conn.cursor() as cursor:
                    # Safely wrap query to enforce maximum rows limit
                    wrapped_query = f"SELECT * FROM ({current_sql.rstrip(';')}) AS sub LIMIT 1000"
                    cursor.execute(wrapped_query)
                    return cursor.fetchall(), current_sql
        except Exception as db_err:
            if attempt == max_retries:
                log_security_event("SQL_ERROR", question, current_sql, str(db_err))
                raise db_err
            
            print(f"⚠️ SQL Error: {db_err}\n🔄 Attempting AI self-correction...")
            
            fix_prompt = f"""
            The previous PostgreSQL query failed with this error:
            {db_err}

            Original User Question: {question}
            Failed SQL Query: {current_sql}

            Database Schema:
            {schema_text}

            Please fix the SQL query so it runs successfully against the schema. Return ONLY the corrected SQL query string.
            """
            
            response = client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
                contents=fix_prompt,
            )
            current_sql = response.text.strip().replace("```sql", "").replace("```", "").strip()

def generate_sql(question: str, schema_text: str) -> SqlGeneration:
    """Uses Gemini to generate SQL from a natural language question, with retries."""
    client = genai.Client()
    
    prompt = f"""
    You are an expert PostgreSQL data analyst.
    Here is the database schema and some examples:
    {schema_text}
    
    Generate a highly accurate PostgreSQL query to answer the user's question.
    Ensure you only query the tables provided.
    
    User Question: {question}
    """
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SqlGeneration,
                    temperature=0.0
                ),
            )
            return response.parsed
        except Exception as e:
            if "503" in str(e) and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"⚠️  API high demand (503). Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise e

def execute_query(sql: str, db_url: str) -> list[tuple]:
    """Executes a SQL query using the read-only role and returns results."""
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                return cur.fetchall()
    except Exception as e:
        return [(f"Error executing query: {str(e)}",)]

def main():
    admin_url = os.environ.get("NEON_DB_URL")
    if not admin_url:
        print("❌ Missing NEON_DB_URL in .env")
        return
        
    readonly_url = get_readonly_url(admin_url)
    
    try:
        with open("schema.yaml", "r") as f:
            schema_text = f.read()
    except FileNotFoundError:
        print("❌ schema.yaml not found! Run Phase 1 scripts first.")
        return

    print("\n🤖 Dwarpal Text-to-SQL CLI (Type 'exit' to quit)")
    print("-" * 50)
    
    while True:
        try:
            question = input("\n📝 Ask a question: ").strip()
            if question.lower() in ['exit', 'quit']:
                break
            if not question:
                continue
                
            print("🧠 Thinking...")
            pre = check_question(question)
            if not pre.allowed:
                print(f"🛑 Blocked by Dwarpal policy: {pre.reason}")
                continue
            result = generate_sql(question, schema_text)
            
            print(f"\n💡 Rationale: {result.rationale}")
            print(f"🛠️  SQL: {result.sql}")
            print("🚀 Executing...")
            
            verdict = validate_sql(result.sql, load_allowed_tables())
            if not verdict.allowed:
                print(f"🛑 Blocked by Dwarpal policy: {verdict.reason}")
                continue
            if verdict.sql != result.sql:
                print(f"🔒 Running as: {verdict.sql}")
            rows = execute_query(verdict.sql, readonly_url)
            print("📊 Results:")
            MAX_DISPLAY = 20
            for row in rows[:MAX_DISPLAY]:
                print(f"  {row}")
            if len(rows) > MAX_DISPLAY:
                print(f"  ... {len(rows) - MAX_DISPLAY} more rows not shown ({len(rows)} total)")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
