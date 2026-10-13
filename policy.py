"""Dwarpal policy engine: decides whether an LLM-written SQL query may run.

The LLM proposes, this code decides. Everything here is deterministic.
"""
from dataclasses import dataclass

import sqlglot
import yaml
from sqlglot import exp

MAX_ROWS = 1000

BLOCKED_PREFIXES = ("pg_", "lo_", "dblink")
BLOCKED_FUNCTIONS = {
    "set_config", "current_setting", "query_to_xml",
    "table_to_xml", "database_to_xml",
}

# Statement types that must never appear anywhere in the query tree.
FORBIDDEN_NODES = tuple(
    getattr(exp, name)
    for name in ("Insert", "Update", "Delete", "Drop", "Create", "Alter",
                 "Merge", "Command", "Into", "Lock", "Set")
    if hasattr(exp, name)
)


@dataclass
class PolicyResult:
    allowed: bool
    sql: str | None  # the rewritten, safe SQL (None if rejected)
    reason: str


def load_allowed_tables(path: str = "schema.yaml") -> set[str]:
    with open(path) as f:
        schema = yaml.safe_load(f)
    return {t["name"] for t in schema["tables"]}


def _reject(reason: str) -> PolicyResult:
    return PolicyResult(False, None, reason)


def validate_sql(sql: str, allowed_tables: set[str], max_rows: int = MAX_ROWS) -> PolicyResult:
    if not sql or not sql.strip():
        return _reject("Empty query.")

    allowed = {t.lower() for t in allowed_tables}

    try:
        statements = sqlglot.parse(sql, read="postgres")
    except sqlglot.errors.ParseError as e:
        return _reject(f"Could not parse SQL: {str(e)[:120]}")

    statements = [s for s in statements if s is not None]
    if len(statements) != 1:
        return _reject("Exactly one SQL statement is allowed.")

    stmt = statements[0]
    if not isinstance(stmt, (exp.Select, exp.Union)):
        return _reject("Only SELECT queries are allowed.")

    if FORBIDDEN_NODES and stmt.find(*FORBIDDEN_NODES):
        return _reject("Query contains a forbidden operation.")

    for func in stmt.find_all(exp.Anonymous):
        name = func.name.lower()
        if name.startswith(BLOCKED_PREFIXES) or name in BLOCKED_FUNCTIONS:
            return _reject(f"Function '{name}' is not allowed.")

    cte_names = {cte.alias_or_name.lower() for cte in stmt.find_all(exp.CTE)}
    for table in stmt.find_all(exp.Table):
        name = table.name.lower()
        if name in cte_names and not table.db:
            continue
        if table.db and table.db.lower() != "public":
            return _reject(f"Schema '{table.db}' is not allowed.")
        if name not in allowed:
            return _reject(f"Table '{table.name or '(function)'}' is not allowed.")

    limit = stmt.args.get("limit")
    if limit is None:
        stmt = stmt.limit(max_rows)
    else:
        value = limit.expression
        if not (isinstance(value, exp.Literal) and value.is_int) or int(value.name) > max_rows:
            stmt = stmt.limit(max_rows)

    return PolicyResult(True, stmt.sql(dialect="postgres"), "OK")


import re

RESTRICTED_NAMES = re.compile(r"\b(staging_\w+|pipeline_run_log)\b", re.IGNORECASE)


def check_question(question: str) -> PolicyResult:
    """Block questions that name a restricted table, before the LLM sees them.

    The LLM may silently rewrite such a request into a query on an allowed
    table, which the SQL validator would then (correctly) accept.
    """
    match = RESTRICTED_NAMES.search(question or "")
    if match:
        return _reject(f"Question refers to restricted table '{match.group(1)}'.")
    return PolicyResult(True, None, "OK")
