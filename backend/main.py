import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from typing import Any, List, Optional
from urllib.parse import urlparse, urlunparse

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from audit_chain import log_audit_event
from pii_guard import redact_sql_results
from policy import check_question, load_allowed_tables, validate_sql

load_dotenv()
logger = logging.getLogger("dwarpal.api")

app = FastAPI(title="Dwarpal OS API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    prompt: Optional[str] = None
    question: Optional[str] = None
    history: List[Any] = Field(default_factory=list)


class QueryResponse(BaseModel):
    success: bool
    question: str
    sql: Optional[str] = None
    rationale: Optional[str] = None
    insight: Optional[str] = None
    columns: List[str] = Field(default_factory=list)
    rows: List[Any] = Field(default_factory=list)
    results: List[Any] = Field(default_factory=list)
    row_count: int = 0
    status: str
    message: Optional[str] = None
    audit_hash: Optional[str] = None


class SqlGeneration(BaseModel):
    sql: str
    rationale: str


def _database_url() -> str:
    """Return a read-only Neon URL, deriving one only when reader credentials exist."""
    readonly_url = os.getenv("DWARPAL_READONLY_DB_URL") or os.getenv("NEON_READONLY_DB_URL")
    if readonly_url:
        return readonly_url

    admin_url = os.getenv("NEON_DB_URL")
    reader_password = os.getenv("DWARPAL_READER_PASSWORD")
    if admin_url and reader_password:
        parsed = urlparse(admin_url)
        if not parsed.hostname:
            raise ValueError("NEON_DB_URL is not a valid PostgreSQL URL")
        netloc = f"dwarpal_reader:{reader_password}@{parsed.hostname}"
        if parsed.port:
            netloc += f":{parsed.port}"
        return urlunparse(parsed._replace(netloc=netloc))

    raise ValueError(
        "Database is not configured. Set DWARPAL_READONLY_DB_URL (or "
        "NEON_READONLY_DB_URL), or set NEON_DB_URL and DWARPAL_READER_PASSWORD."
    )


def _generate_sql(question: str) -> SqlGeneration:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.yaml")
    with open(schema_path, "r", encoding="utf-8") as schema_file:
        schema_text = schema_file.read()

    client = genai.Client(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    prompt = (
        "You are a PostgreSQL business intelligence analyst. Generate one read-only "
        "SELECT query using only tables in this schema. Do not use system catalogs, "
        "comments, or multiple statements. Return a concise rationale.\n\n"
        f"Database schema:\n{schema_text}\n\nUser question: {question}"
    )
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SqlGeneration,
            temperature=0.0,
        ),
    )
    parsed = response.parsed
    if parsed is None:
        raise ValueError("Gemini returned an empty SQL response")
    if isinstance(parsed, SqlGeneration):
        return parsed
    return SqlGeneration.model_validate(parsed)


def _execute_read_only_query(sql: str) -> tuple[List[str], List[tuple[Any, ...]]]:
    with psycopg.connect(_database_url(), connect_timeout=10, autocommit=True) as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET default_transaction_read_only = on")
            cursor.execute(sql)
            columns = [description.name for description in (cursor.description or [])]
            rows = cursor.fetchall() if cursor.description else []
            return columns, rows


def _audit(question: str, sql: Optional[str], status: str, success: bool) -> Optional[str]:
    try:
        return log_audit_event(question, sql or "", status, success)
    except Exception:
        logger.exception("Failed to write audit event (status=%s)", status)
        raise


@app.get("/")
def read_root():
    return {"status": "online", "service": "Dwarpal OS API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Dwarpal OS API"}


@app.post("/api/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest):
    question = (req.prompt or req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Request must include a non-empty prompt or question")

    question_verdict = check_question(question)
    if not question_verdict.allowed:
        try:
            audit_hash = _audit(question, None, "BLOCKED", False)
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err)) from err
        return QueryResponse(
            success=False,
            question=question,
            status="BLOCKED",
            rationale=question_verdict.reason,
            insight=question_verdict.reason,
            audit_hash=audit_hash,
        )

    try:
        generated = _generate_sql(question)
    except Exception as err:
        logger.exception("Gemini SQL generation failed")
        try:
            _audit(question, None, "ERROR", False)
        except Exception:
            logger.exception("Failed to audit Gemini error")
        if getattr(err, "status_code", None) == 429 or "RESOURCE_EXHAUSTED" in str(err) or "429" in str(err):
            raise HTTPException(
                status_code=429,
                detail=(
                    "Gemini API quota is exhausted for the configured model. Check the Google AI quota/billing page, "
                    "wait for the quota reset, or configure a model with available quota."
                ),
            ) from err
        raise HTTPException(status_code=500, detail=str(err)) from err

    try:
        allowed_tables = load_allowed_tables(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.yaml")
        )
        verdict = validate_sql(generated.sql, allowed_tables)
    except Exception as err:
        logger.exception("SQL policy validation failed")
        raise HTTPException(status_code=500, detail=str(err)) from err

    if not verdict.allowed:
        try:
            audit_hash = _audit(question, generated.sql, "BLOCKED", False)
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err)) from err
        return QueryResponse(
            success=False,
            question=question,
            sql=generated.sql,
            status="BLOCKED",
            rationale=verdict.reason,
            insight=verdict.reason,
            audit_hash=audit_hash,
        )

    # Execute the SQL rewritten and row-limited by the deterministic policy engine.
    sql = verdict.sql
    try:
        columns, raw_rows = _execute_read_only_query(sql)
        redacted_rows = redact_sql_results(raw_rows)
        results = [dict(zip(columns, row)) for row in redacted_rows]
        audit_hash = _audit(question, sql, "ALLOWED", True)
    except Exception as err:
        logger.exception("Database query execution failed")
        try:
            _audit(question, sql, "ERROR", False)
        except Exception:
            logger.exception("Failed to audit database error")
        raise HTTPException(status_code=500, detail=str(err)) from err

    return QueryResponse(
        success=True,
        question=question,
        sql=sql,
        rationale=generated.rationale,
        insight=generated.rationale,
        columns=columns,
        rows=results,
        results=results,
        row_count=len(results),
        status="ALLOWED",
        audit_hash=audit_hash,
    )


@app.get("/api/audit")
def get_audit_logs():
    try:
        from verify_chain import load_audit_chain, verify_audit_chain

        chain = load_audit_chain()
        intact = verify_audit_chain(chain)
        return {
            "is_intact": intact,
            "record_count": len(chain),
            "chain": list(reversed(chain)),
        }
    except Exception as err:
        logger.exception("Could not load audit chain")
        raise HTTPException(status_code=500, detail=str(err)) from err
