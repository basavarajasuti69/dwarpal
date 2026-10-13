import os
import time
import urllib.parse
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
    parsed = urllib.parse.urlparse(admin_url)
    netloc = f"dwarpal_reader:dwarpal_readonly_123@{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    return urllib.parse.urlunparse(parsed._replace(netloc=netloc))

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
            result = generate_sql(question, schema_text)
            
            print(f"\n💡 Rationale: {result.rationale}")
            print(f"🛠️  SQL: {result.sql}")
            print("🚀 Executing...")
            
            rows = execute_query(result.sql, readonly_url)
            print("📊 Results:")
            for row in rows:
                print(f"  {row}")
                
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
