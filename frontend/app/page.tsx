'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://dwarpal-aqs2.onrender.com').replace(/\/$/, '');

type ResultRow = Record<string, unknown> | unknown[];

interface QueryResponseData {
  success: boolean;
  question: string;
  sql?: string | null;
  rationale?: string | null;
  insight?: string | null;
  columns?: string[];
  rows?: ResultRow[];
  results?: ResultRow[];
  row_count?: number;
  status: string;
  message?: string | null;
  audit_hash?: string | null;
  source?: string;
  chart?: 'line' | 'bar';
}

const suggestions = [
  {
    category: 'EV Adoption',
    icon: '⚡',
    question: 'Which 5 states had the most 4W EV registrations in 2024?',
    description: 'Ranks top regions by 4-wheeler electric vehicle adoption.',
  },
  {
    category: 'Infrastructure',
    icon: '🔋',
    question: 'Show states ranked by public chargers and fast chargers',
    description: 'Compares public and fast charging distribution across states.',
  },
  {
    category: 'Commerce',
    icon: '📦',
    question: 'What are the top 5 product categories by number of products?',
    description: 'Analyzes inventory density across commercial product categories.',
  },
  {
    category: 'Privacy Guard',
    icon: '🛡️',
    question: 'Show customer orders with payment details and contact info',
    description: 'Tests automated PII masking on emails, phones, and addresses.',
  },
];

const navItems = [
  {
    href: '/',
    label: 'Query Studio',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/audit',
    label: 'Audit Chain',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'sql' | 'json'>('table');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSubmit = async (event?: React.FormEvent | string) => {
    if (event && typeof event !== 'string') event.preventDefault();
    const query = (typeof event === 'string' ? event : question).trim();
    if (!query || loading) return;

    setQuestion(query);
    setLoading(true);
    setError(null);
    setResponse(null);
    setActiveTab('table');

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${res.status}).`);
      }
      setResponse(data);
      setQueryHistory((prev) => [query, ...prev.filter((q) => q !== query)].slice(0, 8));
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Unable to reach the Dwarpal API. Ensure the backend service is running and NEXT_PUBLIC_API_URL is configured.'
          : err instanceof Error
          ? err.message
          : 'Query execution failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const results: ResultRow[] = response?.results ?? response?.rows ?? [];
  const columns: string[] = results.length
    ? Array.isArray(results[0])
      ? (results[0] as unknown[]).map((_, index) => `Column ${index + 1}`)
      : Object.keys(results[0] as Record<string, unknown>)
    : response?.columns ?? [];

  const copySqlToClipboard = () => {
    if (!response?.sql) return;
    navigator.clipboard.writeText(response.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const downloadCSV = () => {
    if (!results.length) return;
    const escapeCSV = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      columns.map(escapeCSV).join(','),
      ...results.map((row) => {
        const values = Array.isArray(row) ? row : Object.values(row);
        return values.map(escapeCSV).join(',');
      }),
    ];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = `dwarpal-query-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderTable = () => {
    if (!results.length) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--canvas-subtle)] border border-[var(--border-light)] flex items-center justify-center text-[var(--ink-muted)] mb-3 text-lg">
            ∅
          </div>
          <h4 className="heading-sm text-[var(--ink)]">No rows returned</h4>
          <p className="micro text-[var(--ink-muted)] mt-1 max-w-sm">
            The database executed this query safely, but no records matched the given criteria.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto max-h-[460px] relative">
        <table className="stripe-table">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              {columns.map((column: string, index: number) => (
                <th key={`${column}-${index}`}>
                  {column.replaceAll('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, rowIndex) => {
              const values = Array.isArray(row) ? row : Object.values(row);
              return (
                <tr key={rowIndex}>
                  <td className="text-center text-[11px] text-[var(--ink-faint)] select-none">
                    {rowIndex + 1}
                  </td>
                  {values.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      {cell === null || cell === undefined ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-500 border border-gray-200">
                          NULL
                        </span>
                      ) : typeof cell === 'boolean' ? (
                        <span className={cell ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                          {cell ? 'true' : 'false'}
                        </span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    if (!results.length || columns.length < 2) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--canvas-subtle)] border border-[var(--border-light)] flex items-center justify-center text-[var(--ink-muted)] mb-3 text-lg">
            📈
          </div>
          <h4 className="heading-sm text-[var(--ink)]">Visualization unavailable</h4>
          <p className="micro text-[var(--ink-muted)] mt-1 max-w-sm">
            Charting requires at least two columns with numeric values in the result set.
          </p>
        </div>
      );
    }

    const chartData = results.map((row) => {
      const values = Array.isArray(row) ? row : Object.values(row);
      const numeric = Number(values[1]);
      return {
        label: String(values[0] ?? '').slice(0, 20),
        amount: Number.isFinite(numeric) ? numeric : 0,
      };
    });

    const isLine = response?.chart === 'line';

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="micro-cap text-[var(--ink-muted)]">Distribution View</span>
            <h4 className="heading-sm text-[var(--ink)] mt-0.5">
              {columns[0]} vs. {columns[1]}
            </h4>
          </div>
          <span className="pill-tag pill-tag-indigo">
            {isLine ? 'Trend line' : 'Bar series'}
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {isLine ? (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="#eceae4" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748d', fontSize: 11 }}
                  axisLine={{ stroke: '#eceae4' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748d', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#f7f4ed',
                    border: '1px solid #eceae4',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(13,37,61,0.08)',
                    fontSize: 12,
                    color: '#0d253d',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name={columns[1]}
                  stroke="#533afd"
                  strokeWidth={2.5}
                  dot={{ fill: '#533afd', r: 4 }}
                  activeDot={{ r: 6, fill: '#4434d4' }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="#eceae4" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748d', fontSize: 11 }}
                  axisLine={{ stroke: '#eceae4' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748d', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#f7f4ed',
                    border: '1px solid #eceae4',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(13,37,61,0.08)',
                    fontSize: 12,
                    color: '#0d253d',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="amount"
                  name={columns[1]}
                  fill="#533afd"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink)]">
      {/* Stripe Signature Atmospheric Gradient Mesh (upper third) */}
      <div className="mesh-backdrop" />

      {/* Floating Top Nav */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[var(--canvas)]/80 border-b border-[var(--border-light)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group text-decoration-none">
              <div className="w-8 h-8 rounded-[8px] bg-[var(--ink)] text-white flex items-center justify-center font-semibold text-sm">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="heading-sm text-[var(--ink)]">Dwarpal</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[var(--primary-subdued)] text-[var(--primary-deep)]">
                    OS
                  </span>
                </div>
                <span className="micro-cap text-[var(--ink-muted)]">Guarded Intelligence</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[var(--border-light)]">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`btn-ghost-pill ${item.href === '/' ? 'active' : ''}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--emerald-subtle)] border border-[var(--emerald-border)] text-emerald-800 text-[11px] font-semibold">
              <span className="pulse-emerald" />
              <span>Read-Only Policy Enforced</span>
            </div>

            <Link
              href="/audit"
              className="text-xs text-[var(--ink-secondary)] hover:text-[var(--primary)] font-medium flex items-center gap-1 py-1 px-2.5 rounded-full border border-[var(--border-light)] hover:border-[var(--primary)] transition-all"
            >
              <span>Audit logs</span>
              <span className="text-[11px]">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-12 pb-20">
        {/* Editorial Hero (Stripe display tier + Lovable cream canvas) */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--canvas-card)] border border-[var(--border-light)] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            <span className="micro-cap text-[var(--ink-secondary)]">
              Deterministic Guardrails &amp; SQL Synthesis
            </span>
          </div>

          <h1 className="display-hero text-[var(--ink)]">
            Ask your business data with verifiable trust.
          </h1>

          <p className="mt-4 body-md sm:body-lg text-[var(--ink-muted)]">
            Natural language queries translated to read-only SQL, strictly verified against your schema whitelist and recorded in an immutable audit chain.
          </p>
        </div>

        {/* AI Query Composer */}
        <div className="composer-box p-3.5 sm:p-5 mb-10">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-secondary)]">
                <span className="w-5 h-5 rounded-[6px] bg-[var(--primary-subdued)] text-[var(--primary-deep)] flex items-center justify-center text-xs">
                  ✨
                </span>
                <span>Natural Language Query</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill-tag pill-tag-emerald hidden sm:inline-flex">
                  ✓ Isolated Reader DB
                </span>
                <span className="pill-tag pill-tag-neutral text-[10px]">
                  Gemini 2.5 Flash
                </span>
              </div>
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g., Which 5 states had the most 4W EV registrations in 2024?"
              rows={3}
              className="w-full body-lg text-[var(--ink)] placeholder-[var(--ink-faint)] bg-transparent border-0 outline-none resize-none leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-light)] mt-1">
              <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--canvas-subtle)] border border-[var(--border-light)] text-[var(--ink-secondary)] font-mono">
                  ↵ Enter
                </kbd>
                <span>to run</span>
                <span className="text-[var(--ink-faint)]">·</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--canvas-subtle)] border border-[var(--border-light)] text-[var(--ink-secondary)] font-mono">
                  ⇧ + ↵
                </kbd>
                <span>for new line</span>
              </div>

              <div className="flex items-center gap-2">
                {question.trim() && (
                  <button
                    type="button"
                    onClick={() => setQuestion('')}
                    className="btn-ghost-pill text-xs py-1.5 px-3"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="btn-primary-pill"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Synthesizing…</span>
                    </>
                  ) : (
                    <>
                      <span>Run query</span>
                      <span className="text-sm">↗</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Suggestion Prompts Gallery (Lovable card grid) */}
        {!response && !error && !loading && (
          <div className="mb-14">
            <div className="flex items-center justify-between mb-3.5">
              <span className="micro-cap text-[var(--ink-muted)]">Sample Questions to Explore</span>
              <span className="micro text-[var(--ink-faint)]">Click any prompt to run immediately</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {suggestions.map((item) => (
                <button
                  key={item.category}
                  onClick={() => handleSubmit(item.question)}
                  className="craft-card craft-card-interactive text-left p-4 flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="pill-tag pill-tag-neutral text-[10px]">
                        {item.icon} {item.category}
                      </span>
                      <span className="text-[var(--ink-faint)] group-hover:text-[var(--primary)] transition-colors text-xs font-semibold">
                        ↗
                      </span>
                    </div>
                    <p className="body-md font-[400] text-[var(--ink)] leading-snug group-hover:text-[var(--primary)] transition-colors">
                      {item.question}
                    </p>
                  </div>
                  <p className="micro text-[var(--ink-muted)] mt-2.5 line-clamp-1">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Query History Bar */}
            {queryHistory.length > 0 && (
              <div className="mt-10 pt-6 border-t border-[var(--border-light)]">
                <span className="micro-cap text-[var(--ink-muted)] block mb-2.5">
                  Recent Queries in Session
                </span>
                <div className="flex flex-wrap gap-2">
                  {queryHistory.map((item, idx) => (
                    <button
                      key={`${item}-${idx}`}
                      onClick={() => handleSubmit(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--canvas-card)] border border-[var(--border-light)] text-[var(--ink-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all cursor-pointer"
                    >
                      <span className="text-[10px] text-[var(--ink-faint)]">↺</span>
                      <span className="truncate max-w-xs">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading Multi-Step Progress State */}
        {loading && (
          <div className="craft-card p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-subdued)] border border-indigo-200 flex items-center justify-center text-[var(--primary)]">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <h3 className="heading-sm text-[var(--ink)]">Executing guarded query pipeline</h3>
                <p className="micro text-[var(--ink-muted)] mt-0.5">
                  Verifying question against schema, generating read-only SQL, and enforcing policy guardrails…
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-[var(--border-light)] text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span>✓</span> Schema validation
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span>✓</span> Policy AST checker
              </div>
              <div className="flex items-center gap-1.5 text-indigo-700 font-medium animate-pulse">
                <span>⚡</span> SQL synthesis
              </div>
              <div className="flex items-center gap-1.5 text-[var(--ink-faint)]">
                <span>◌</span> Cryptographic audit
              </div>
            </div>
          </div>
        )}

        {/* Error / Blocked Alert */}
        {error && (
          <div className="craft-card p-5 mb-8 border-ruby-200 bg-[var(--ruby-subtle)]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-[var(--ruby)] flex items-center justify-center shrink-0 font-bold text-sm">
                !
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="pill-tag pill-tag-ruby text-[10px]">Policy Rejected / Error</span>
                  <span className="text-xs text-rose-800 font-semibold">
                    Request could not proceed
                  </span>
                </div>
                <p className="body-md font-[400] text-rose-900 mt-1.5">{error}</p>
                <p className="micro text-rose-700 mt-1">
                  {error.includes('quota')
                    ? 'The AI synthesis model hit temporary quota. Please wait a moment or verify your quota settings.'
                    : 'The policy engine blocks destructive queries (INSERT, UPDATE, DROP), unpermitted tables, and invalid schemas.'}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-700 text-lg leading-none cursor-pointer p-1"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Results Studio */}
        {response && (
          <div className="space-y-6 animate-fade-in">
            {/* Analyst Rationale (Lovable warm cream card) */}
            {response.insight && (
              <div className="craft-card craft-card-cream p-4 sm:p-5 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-[8px] bg-amber-100 border border-amber-300/60 text-amber-800 flex items-center justify-center shrink-0 text-sm">
                  💡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="micro-cap text-amber-900">Analyst Rationale</span>
                    <span className="pill-tag pill-tag-emerald">✓ Policy Approved</span>
                  </div>
                  <p className="body-md text-amber-950/90">{response.insight}</p>
                </div>
              </div>
            )}

            {/* Data Metric Strip (Stripe tnum tabular figures) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="craft-card p-4">
                <span className="micro-cap text-[var(--ink-muted)] block">Rows Returned</span>
                <div className="display-md text-[var(--ink)] mt-1 tabular">
                  {response.row_count ?? results.length}
                </div>
                <span className="micro text-[var(--ink-faint)] mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live database records
                </span>
              </div>

              <div className="craft-card p-4">
                <span className="micro-cap text-[var(--ink-muted)] block">Columns</span>
                <div className="display-md text-[var(--ink)] mt-1 tabular">{columns.length}</div>
                <span className="micro text-[var(--ink-faint)] mt-1">Schema projection</span>
              </div>

              <div className="craft-card p-4">
                <span className="micro-cap text-[var(--ink-muted)] block">Policy Verdict</span>
                <div className="display-md text-emerald-600 mt-1">
                  {response.status === 'BLOCKED' ? 'Blocked' : 'Allowed'}
                </div>
                <span className="micro text-[var(--ink-faint)] mt-1">Read-only verified</span>
              </div>

              <div className="craft-card p-4">
                <span className="micro-cap text-[var(--ink-muted)] block">Audit Block</span>
                <div className="body-tabular font-mono text-[var(--ink-secondary)] mt-2.5 truncate">
                  {response.audit_hash ? `#${response.audit_hash.slice(0, 10)}…` : 'Recorded'}
                </div>
                <a
                  href="/audit"
                  className="micro text-[var(--primary)] hover:underline mt-1 block font-medium"
                >
                  Verify in chain →
                </a>
              </div>
            </div>

            {/* Composited Dashboard Panel */}
            <div className="craft-card overflow-hidden">
              <div className="p-3 sm:px-5 sm:py-3.5 bg-[var(--canvas-subtle)] border-b border-[var(--border-light)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-[var(--canvas-card)] p-1 rounded-full border border-[var(--border-light)]">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`btn-ghost-pill text-xs py-1 px-3 ${activeTab === 'table' ? 'active' : ''}`}
                  >
                    Data Grid
                  </button>
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`btn-ghost-pill text-xs py-1 px-3 ${activeTab === 'chart' ? 'active' : ''}`}
                  >
                    Chart
                  </button>
                  {response.sql && (
                    <button
                      onClick={() => setActiveTab('sql')}
                      className={`btn-ghost-pill text-xs py-1 px-3 ${activeTab === 'sql' ? 'active' : ''}`}
                    >
                      Policy SQL
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('json')}
                    className={`btn-ghost-pill text-xs py-1 px-3 ${activeTab === 'json' ? 'active' : ''}`}
                  >
                    JSON
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadCSV}
                    disabled={!results.length}
                    className="btn-secondary-pill text-xs py-1.5 px-3"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div>
                {activeTab === 'table' && renderTable()}
                {activeTab === 'chart' && renderChart()}

                {/* Stripe Faux-IDE Dark Console Panel for SQL */}
                {activeTab === 'sql' && (
                  <div className="dark-console-panel m-4 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e172e] border-b border-[#1e2942]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                        <span className="text-[11px] font-mono text-gray-400 ml-2">
                          query.sql — read_only_transaction
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono uppercase text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                          AST Policy Checked
                        </span>
                        <button
                          onClick={copySqlToClipboard}
                          className="text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-700/80 px-2.5 py-1 rounded transition-colors cursor-pointer"
                        >
                          {copiedSql ? '✓ Copied' : 'Copy SQL'}
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 text-xs font-mono leading-relaxed text-indigo-100 overflow-x-auto whitespace-pre-wrap">
                      {response.sql}
                    </pre>
                    <div className="px-4 py-2 bg-[#090f20] border-t border-[#1e2942] flex items-center justify-between text-[11px] font-mono text-gray-400">
                      <span>SET default_transaction_read_only = on</span>
                      <span>DETERMINISTIC LIMIT 50 INJECTED</span>
                    </div>
                  </div>
                )}

                {activeTab === 'json' && (
                  <pre className="p-4 text-xs font-mono bg-[var(--code-bg)] text-gray-100 max-h-[460px] overflow-auto leading-relaxed">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                )}
              </div>

              <div className="px-5 py-3 bg-[var(--canvas-subtle)] border-t border-[var(--border-light)] flex flex-wrap items-center justify-between text-xs text-[var(--ink-muted)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Results verified &amp; PII-redacted before rendering</span>
                </div>
                {response.audit_hash && (
                  <div className="font-mono text-[11px]">
                    Hash: <span className="text-[var(--ink-secondary)]">{response.audit_hash}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-[var(--border-light)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--ink-muted)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">Dwarpal OS</span>
            <span>·</span>
            <span>Secure Business Intelligence Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Read-Only Postgres Isolation</span>
            <span>·</span>
            <span>AST Policy Guardrails</span>
            <span>·</span>
            <span>Cryptographic Chain</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
