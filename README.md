# Dwarpal OS

**A policy-guarded natural-language analytics prototype for PostgreSQL.** Ask a business question, inspect the generated SQL, and review tabular or charted results in a focused analytics workspace.

Dwarpal connects a Next.js interface to a FastAPI service, Google Gemini for SQL drafting, and Neon PostgreSQL for data and audit records. The API validates generated SQL against an explicit schema allowlist, permits read-only query forms, applies a result limit, and redacts selected patterns from returned values.

> This repository is an evolving prototype, not a production-ready enterprise security product. Read [Security boundaries](#security-boundaries) before connecting real or regulated data.

## What it does

- Converts a natural-language question into a PostgreSQL `SELECT` query with Gemini.
- Validates the generated statement with SQLGlot and the table allowlist in [`schema.yaml`](schema.yaml).
- Executes accepted SQL in a read-only transaction and caps returned rows at 1,000.
- Displays results as a data grid, a basic chart, JSON, or SQL, with CSV export.
- Records allowed, blocked, and failed requests in a SHA-256 hash-linked audit table; the audit page reports whether the chain verifies.
- Accepts either `prompt` or `question` in the query API request body.

## Architecture

```text
Browser
  └── Next.js (frontend/) ── POST /api/query ──> FastAPI (backend/main.py)
                                                  ├── Gemini: draft SQL
                                                  ├── policy.py + schema.yaml: validate SQL
                                                  ├── Neon PostgreSQL: read-only query
                                                  ├── pii_guard.py: redact selected result patterns
                                                  └── audit_chain.py: append audit event
```

The query policy is implemented in [`policy.py`](policy.py). The browser never receives database credentials or the Gemini API key. The backend uses `DWARPAL_READONLY_DB_URL` (or `NEON_READONLY_DB_URL`) for query execution. The audit writer uses `NEON_DB_URL`.

## Local development

### 1. Configure the backend

Use Python 3.13 and create a virtual environment from the repository root:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set the required environment variables in your shell or a local `.env` file at the repository root:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
NEON_DB_URL=postgresql://...        # Audit table read/write connection
DWARPAL_READONLY_DB_URL=postgresql://...  # Separate least-privilege query connection
```

`DWARPAL_READONLY_DB_URL` can be replaced by `NEON_READONLY_DB_URL`. If neither is set, the API can derive a `dwarpal_reader` URL from `NEON_DB_URL` and `DWARPAL_READER_PASSWORD`. Prefer a dedicated database role with only the required `SELECT` grants. The audit feature requires `NEON_DB_URL` and creates `audit_log_chain` on first write.

Run the API:

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API root is `http://127.0.0.1:8000/`; interactive OpenAPI docs are at `http://127.0.0.1:8000/docs`.

### 2. Run the frontend

In another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000`. The frontend defaults to the deployed API when `NEXT_PUBLIC_API_URL` is unset.

## API

### `POST /api/query`

Request:

```json
{ "question": "Which states have the most 4W EV registrations?" }
```

`prompt` is accepted as an alternative to `question`. A successful response includes `sql`, `rationale`, `columns`, `rows`/`results`, `row_count`, `status`, and an `audit_hash`. A policy-blocked request returns `success: false` and `status: "BLOCKED"`. Gemini quota exhaustion is returned as HTTP 429 with a readable explanation.

### `GET /api/audit`

Returns the newest audit entries, record count, and a chain integrity result. The `/audit` frontend route presents this information. Audit access is currently unauthenticated and must not be exposed as a private enterprise audit console without adding access control.

### `GET /health`

Returns a lightweight process health response. It does not test the database or Gemini connection.

## Data schema and sample questions

The table and column descriptions in [`schema.yaml`](schema.yaml) are passed to the SQL generation prompt and define which tables policy validation permits. The included sample data domains are India EV registrations/charging stations and Olist-style ecommerce dimensions/facts.

Examples:

- “Which state has the most 2W EV registrations?”
- “Show public chargers and fast chargers by state.”
- “What is the average review score?”
- “Show the top five product categories by number of products.”

Use column and table names from the configured schema. The validator applies a 1,000-row maximum to returned query results.

## Deployment

### Backend on Render

- Connect the GitHub repository as a Python web service.
- Set the repository root as the service root directory.
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Configure `GEMINI_API_KEY`, `GEMINI_MODEL`, `NEON_DB_URL`, and a read-only query URL (or the reader password fallback) in Render environment variables.
- Confirm `/health` responds after deployment.

### Frontend on Vercel

- Set the project root directory to `frontend`.
- Add `NEXT_PUBLIC_API_URL` with the deployed backend origin, for example `https://your-api.onrender.com` (no trailing slash required).
- Redeploy after changing environment variables; `NEXT_PUBLIC_*` values are embedded at build time.

The API currently uses wildcard CORS with credentials disabled. Restrict allowed origins to the deployed frontend domains before serving a real customer workload.

## Security boundaries

This project demonstrates defensive layers; it does not establish a complete enterprise security posture.

- **No authentication or tenant isolation:** query and audit endpoints are currently public. Add identity, authorization, and per-tenant data boundaries before exposing sensitive data.
- **CORS is permissive:** `allow_origins=["*"]` is useful during setup but should be narrowed for a real deployment.
- **SQL is model-generated:** deterministic validation reduces risk but is not a substitute for a database role restricted to the minimum tables and operations. Keep the query role read-only and limit network/database access.
- **PII filtering is best-effort:** `pii_guard.py` uses pattern-based redaction on returned values; it is not a comprehensive privacy system. The audit log stores the original prompt and generated SQL.
- **Audit chaining is tamper-evident, not immutable:** chain verification can detect changed or reordered linked entries, but a database administrator can rewrite the chain or delete it. Use protected append-only storage and external anchoring for stronger guarantees.
- **External model processing:** user questions and schema context are sent to the configured Gemini API. Do not send data that your organization is not permitted to share with that service.
- **Quota and availability:** Gemini quotas vary by project, model, and billing tier. HTTP 429 means the configured model quota is unavailable; configure billing/limits or another supported model as appropriate.

## Repository map

```text
backend/main.py       FastAPI application and query lifecycle
policy.py             SQL validation and table allowlist enforcement
schema.yaml           Allowed schema and generation examples
pii_guard.py          Pattern-based result redaction
audit_chain.py        Hash-linked audit event writer
verify_chain.py       Audit retrieval and chain verifier
frontend/app/         Next.js query studio and audit interface
requirements.txt      Python dependencies
```

## License

No license is currently specified. Contact the repository owner before reuse or redistribution.
