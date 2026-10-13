# Dwarpal OS 🛡️🤖
### Enterprise-Grade, Secure, Autonomous AI Analytics SaaS Platform

Dwarpal OS is a production-ready, highly secure natural language-to-SQL business intelligence platform. It bridges the gap between raw relational databases and conversational AI by combining strict security guardrails, automated data masking, autonomous self-correction loops, and interactive visualizations.

---

## 🚀 Key Features

* **Natural Language to SQL**: Powered by Google Gemini (`gemini-3.8-flash`) to generate accurate PostgreSQL queries from plain English questions.
* **Autonomous Self-Correction Agent**: If a generated query causes a database syntax error, the agent catches the exception, self-corrects the SQL with Gemini, and retries automatically.
* **Database Guardrails & Policy Engine**: Strictly permits only `SELECT` operations and blocks destructive commands (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`).
* **PII Redaction Guard**: Automatically masks sensitive personal identifiable information (like emails and phone numbers) from raw query results before rendering.
* **Interactive Data Visualization**: Dynamically routes query shapes to the appropriate chart type using Recharts (Bar charts, Line charts, etc.).
* **Data Portability**: One-click CSV export utility for all result sets.
* **Execution Caching**: Fast query response caching to eliminate redundant database and LLM calls.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js (App Router), Tailwind CSS, Recharts
* **Backend**: FastAPI (Python), Uvicorn, Pydantic, Psycopg
* **Database**: PostgreSQL (Hosted on Neon DB via restricted read-only role `dwarpal_reader`)
* **AI Model**: Google Gemini API (`gemini-3.8-flash`)

---

## 📁 Project Structure

```text
dwarpal/
├── backend/
│   ├── main.py          # FastAPI application & autonomous agent loop
│   ├── policy.py        # Schema validation & security guardrails
│   ├── pii_guard.py     # Data masking and redaction
│   ├── audit.py         # Security event logging
│   └── cache.py         # Execution caching layer
├── frontend/
│   ├── app/page.tsx     # Next.js workspace UI, data grids, and charts
│   └── package.json     # Frontend dependencies
├── schema.yaml          # Enriched database schema mapping
└── requirements.txt     # Python backend dependencies
⚙️ Local Setup & Installation
1. Clone the Repository
Bash
git clone [https://github.com/basavarajasuti69/dwarpal.git](https://github.com/basavarajasuti69/dwarpal.git)
cd dwarpal
2. Backend Setup
Bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
Create a .env file in your root folder with:

Code snippet
NEON_DB_URL=your_neon_database_connection_string
DWARPAL_READER_PASSWORD=your_secure_reader_password
GEMINI_MODEL=gemini-3.8-flash
Start the FastAPI server:

Bash
uvicorn backend.main:app --reload --port 8000
3. Frontend Setup
Open a new terminal window:

Bash
cd frontend
npm install
npm run dev
Open http://localhost:3000 in your browser to access the Dwarpal OS workspace.
Once pasted into the GitHub editor, click the green **Commit changes...** button at the top right, and your repository homepage will look complete and professional!
