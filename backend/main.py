import os
import sys
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg
from urllib.parse import urlparse, urlunparse
from google import genai
from google.genai import types
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from policy import check_question, load_allowed_tables, validate_sql
from pii_guard import redact_sql_results
from audit import log_security_event
from cache import get_cached_query, set_cached_query

load_dotenv()

app = FastAPI(title="Dwarpal Autonomous AI Analytics API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    question: str
    history: Optional[List[ChatMessage]] = []

class AIAnalysisResponse(BaseModel):
    sql: str
    rationale: str
    recommended_chart: str  # 'bar', 'line', 'pie', 'metric'

def get_readonly_url():
    admin_url = os.environ["NEON_DB_URL"]
    parsed = urlparse(admin_url)
    netloc = f"dwarpal_reader:{os.environ['DWARPAL_READER_PASSWORD']}@{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    return urlunparse(parsed._replace(netloc=netloc))

@app.post("/api/query")
def process_query(req: QueryRequest):
    # 1. Check Cache
    cached_data = get_cached_query(req.question)
    if cached_data:
        return {
            "status": "success", 
            "source": "cache", 
            "question": req.question, 
            "results": cached_data, 
            "chart": "bar",
            "insight": "Loaded instantly from execution cache."
        }

    # 2. Policy Guardrail Check
    policy_res = check_question(req.question)
    if not policy_res.allowed:
        log_security_event("POLICY_BLOCKED", req.question, reason=policy_res.reason)
        raise HTTPException(status_code=403, detail=policy_res.reason)

    allowed_tables = load_allowed_tables()
    client = genai.Client()

    # Build conversation context string if history exists
    context_str = ""
    if req.history:
        context_str = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in req.history[-4:]])

    prompt = f"""
    You are an expert autonomous PostgreSQL data analyst agent.
    Database Schema tables and columns: {allowed_tables}

    Recent Conversation History:
    {context_str}

    Current User Question: {req.question}

    Instructions:
    1. Generate a highly accurate PostgreSQL query.
    2. Provide a short rationale.
    3. Choose the best chart visualization type for the expected result structure from: 'bar', 'line', 'pie', 'metric'.
    """

    # 3. Text-to-SQL Generation with LLM
    try:
        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AIAnalysisResponse,
                temperature=0.0
            ),
        )
        parsed_output = response.parsed
        sql_query = parsed_output.sql
        recommended_chart = parsed_output.recommended_chart
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")

    # 4. SQL Guardrail Validation
    sql_validation = validate_sql(sql_query, allowed_tables)
    if not sql_validation.allowed:
        log_security_event("POLICY_BLOCKED", req.question, sql_query, sql_validation.reason)
        raise HTTPException(status_code=403, detail=sql_validation.reason)

    # 5. Autonomous SQL Self-Correction Execution Loop
    max_retries = 2
    raw_results = None
    last_db_error = None

    for attempt in range(max_retries):
        try:
            with psycopg.connect(get_readonly_url()) as conn:
                with conn.cursor() as cursor:
                    wrapped_query = f"SELECT * FROM ({sql_query.rstrip(';')}) AS sub LIMIT 1000"
                    cursor.execute(wrapped_query)
                    raw_results = cursor.fetchall()
            break # Success, exit retry loop
        except Exception as db_err:
            last_db_error = str(db_err)
            if attempt < max_retries - 1:
                # Agent self-correction prompt back to Gemini
                correction_prompt = f"""
                The previous SQL query generated for the question '{req.question}' failed to execute on PostgreSQL.
                Failed SQL: {sql_query}
                Database Error: {last_db_error}
                
                Please fix the SQL query and return the corrected JSON response.
                """
                try:
                    retry_response = client.models.generate_content(
                        model=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
                        contents=correction_prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=AIAnalysisResponse,
                            temperature=0.0
                        ),
                    )
                    sql_query = retry_response.parsed.sql
                    recommended_chart = retry_response.parsed.recommended_chart
                except Exception:
                    break
            else:
                log_security_event("SQL_ERROR", req.question, sql_query, last_db_error)
                raise HTTPException(status_code=500, detail=f"Database execution error after self-correction: {last_db_error}")

    # 6. PII Redaction & Caching
    safe_results = redact_sql_results(raw_results)

    # 7. AI Executive Insight Generation
    insight_text = "Query successfully executed and verified by autonomous agent."
    try:
        insight_prompt = f"Given the user question '{req.question}' and query results sample {str(safe_results[:5])}, write a concise 1-sentence executive business insight."
        insight_res = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=insight_prompt,
        )
        if insight_res.text:
            insight_text = insight_res.text.strip()
    except Exception:
        pass

    set_cached_query(req.question, safe_results)

    return {
        "status": "success",
        "source": "database",
        "question": req.question,
        "sql": sql_query,
        "chart": recommended_chart,
        "results": safe_results,
        "insight": insight_text
    }
