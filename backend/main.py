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

# Pydantic models for Multi-Agent Orchestration
class PlannerResponse(BaseModel):
    sql: str
    rationale: str
    recommended_chart: str  # 'bar', 'line', 'pie', 'metric'

class CriticResponse(BaseModel):
    is_approved: bool
    critique_feedback: str
    corrected_sql: Optional[str] = None

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

    # 3. PLANNER AGENT
    planner_prompt = f"""
    You are the Planner Agent. Your job is to analyze the user's question and schema, then draft a precise PostgreSQL query.
    Schema: {allowed_tables}
    Recent Conversation History:
    {context_str}
    User Question: {req.question}
    """

    try:
        planner_res = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=planner_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PlannerResponse,
                temperature=0.0
            ),
        )
        draft_sql = planner_res.parsed.sql
        chart_type = planner_res.parsed.recommended_chart
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Planner Agent failed: {str(e)}")

    # 4. CRITIC AGENT (Auditing the draft SQL)
    critic_prompt = f"""
    You are the Critic Agent, an expert database administrator and security auditor.
    Review this draft SQL query for safety, syntax validity against PostgreSQL, and adherence to allowed tables ({allowed_tables}).
    Draft SQL: {draft_sql}
    User Question: {req.question}
    
    If the SQL is valid and safe, set is_approved to true. If there are syntax errors or risks, set is_approved to false and provide corrected_sql.
    """

    try:
        critic_res = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=critic_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CriticResponse,
                temperature=0.0
            ),
        )
        critic_output = critic_res.parsed
        sql_query = critic_output.corrected_sql if not critic_output.is_approved and critic_output.corrected_sql else draft_sql
    except Exception:
        sql_query = draft_sql

    # 5. SQL Guardrail Validation
    sql_validation = validate_sql(sql_query, allowed_tables)
    if not sql_validation.allowed:
        log_security_event("POLICY_BLOCKED", req.question, sql_query, sql_validation.reason)
        raise HTTPException(status_code=403, detail=sql_validation.reason)

    # 6. Autonomous SQL Self-Correction Execution Loop
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
            break 
        except Exception as db_err:
            last_db_error = str(db_err)
            if attempt < max_retries - 1:
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
                            response_schema=PlannerResponse,
                            temperature=0.0
                        ),
                    )
                    sql_query = retry_response.parsed.sql
                    chart_type = retry_response.parsed.recommended_chart
                except Exception:
                    break
            else:
                log_security_event("SQL_ERROR", req.question, sql_query, last_db_error)
                raise HTTPException(status_code=500, detail=f"Database execution error: {last_db_error}")

    # 7. PII Redaction & Caching
    safe_results = redact_sql_results(raw_results)

    # 8. AI Executive Insight Generation
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
        "chart": chart_type,
        "results": safe_results,
        "insight": insight_text
    }
