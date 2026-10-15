import os
import sys
import time
from typing import Optional, List, Any, Dict
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Ensure parent root directory is in sys.path to import root modules
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from audit_chain import log_audit_event, init_audit_db
from verify_chain import verify_audit_chain
from policy import check_question, load_allowed_tables, validate_sql
from pii_guard import redact_sql_results

load_dotenv(dotenv_path=ROOT_DIR / ".env")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize audit log table on startup
    try:
        init_audit_db()
    except Exception as e:
        print(f"⚠️ Audit DB initialization warning: {e}")
    yield

app = FastAPI(
    title="Dwarpal OS Security & Analytics API",
    version="2.0.0",
    description="Enterprise-grade secure text-to-SQL API with PII guardrails and tamper-evident audit log.",
    lifespan=lifespan
)

# CORS setup for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str = Field(..., example="Show top 5 customers by sales")

class QueryResponse(BaseModel):
    success: bool
    question: str
    sql: Optional[str] = None
    rationale: Optional[str] = None
    columns: List[str] = []
    rows: List[List[Any]] = []
    row_count: int = 0
    status: str  # 'ALLOWED', 'BLOCKED', 'ERROR'
    message: Optional[str] = None
    audit_hash: Optional[str] = None

class SqlGeneration(BaseModel):
    sql: str
    rationale: str

def get_readonly_url() -> str:
    admin_url = os.environ.get("NEON_DB_URL")
    reader_pw = os.environ.get("DWARPAL_READER_PASSWORD")
    if not admin_url or not reader_pw:
        raise ValueError("NEON_DB_URL and DWARPAL_READER_PASSWORD must be set in environment")
    parsed = urlparse(admin_url)
    netloc = f"dwarpal_reader:{reader_pw}@{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    return urlunparse(parsed._replace(netloc=netloc))

def load_schema_text() -> str:
    schema_path = ROOT_DIR / "schema.yaml"
    if not schema_path.exists():
        return "No schema.yaml found."
    return schema_path.read_text()

def generate_sql_with_gemini(question: str, schema_text: str) -> SqlGeneration:
    client = genai.Client()
    prompt = f"""
    You are an expert PostgreSQL data analyst.
    Here is the database schema and some examples:
    {schema_text}
    
    Generate a highly accurate PostgreSQL query to answer the user's question.
    Ensure you only query the tables provided.
    
    User Question: {question}
    """
    primary_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    fallback_model = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash")
    models_to_try = [primary_model] if primary_model == fallback_model else [primary_model, fallback_model]

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SqlGeneration,
                    temperature=0.0
                ),
            )
            return response.parsed
        except Exception as e:
            if model_name == models_to_try[-1]:
                raise e
            print(f"⚠️ Model {model_name} failed. Falling back to {fallback_model}...")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Dwarpal OS Security Engine"}

@app.get("/api/audit/verify")
def verify_audit_endpoint():
    """Endpoint for frontend/compliance dashboard to verify cryptographic chain integrity."""
    intact = verify_audit_chain()
    return {"chain_integrity_intact": intact}

@app.post("/api/query", response_model=QueryResponse)
def process_query(req: QueryRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # 1. Policy pre-check on user input
    pre = check_question(question)
    if not pre.allowed:
        entry_hash = log_audit_event(question, None, 'BLOCKED', False)
        return QueryResponse(
            success=False,
            question=question,
            status="BLOCKED",
            message=f"Blocked by policy: {pre.reason}",
            audit_hash=entry_hash
        )

    # 2. LLM SQL Generation
    try:
        schema_text = load_schema_text()
        generated = generate_sql_with_gemini(question, schema_text)
        sql = generated.sql
        rationale = generated.rationale
    except Exception as err:
        entry_hash = log_audit_event(question, None, 'ERROR', False)
        return QueryResponse(
            success=False,
            question=question,
            status="ERROR",
            message=f"Failed to generate SQL: {str(err)}",
            audit_hash=entry_hash
        )

    # 3. Policy validation on generated SQL
    allowed_tables = load_allowed_tables()
    verdict = validate_sql(sql, allowed_tables)
    if not verdict.allowed:
        entry_hash = log_audit_event(question, sql, 'BLOCKED', False)
        return QueryResponse(
            success=False,
            question=question,
            sql=sql,
            rationale=rationale,
            status="BLOCKED",
            message=f"Blocked by SQL policy: {verdict.reason}",
            audit_hash=entry_hash
        )

    # 4. Database execution using restricted read-only role
    try:
        readonly_url = get_readonly_url()
        with psycopg.connect(readonly_url) as conn:
            with conn.cursor() as cur:
                cur.execute(verdict.sql)
                raw_rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description] if cur.description else []
    except Exception as db_err:
        entry_hash = log_audit_event(question, verdict.sql, 'ERROR', False)
        return QueryResponse(
            success=False,
            question=question,
            sql=verdict.sql,
            rationale=rationale,
            status="ERROR",
            message=f"Database execution error: {str(db_err)}",
            audit_hash=entry_hash
        )

    # 5. Apply PII Redaction Guard to query output
    redacted_tuples = redact_sql_results(raw_rows)
    formatted_rows = [list(row) for row in redacted_tuples]

    # 6. Append entry to tamper-evident audit chain
    entry_hash = log_audit_event(question, verdict.sql, 'ALLOWED', True)

    return QueryResponse(
        success=True,
        question=question,
        sql=verdict.sql,
        rationale=rationale,
        columns=columns,
        rows=formatted_rows,
        row_count=len(formatted_rows),
        status="ALLOWED",
        audit_hash=entry_hash
    )
