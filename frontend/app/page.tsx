'use client';

import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://dwarpal-aqs2.onrender.com').replace(/\/$/, '');

type ResultRow = Record<string, unknown> | unknown[];

const suggestions = [
  { icon: '↗', label: 'EV adoption', question: 'Which 5 states had the most 4W EV registrations in 2024?' },
  { icon: '◉', label: 'Charging network', question: 'Show states ranked by public chargers and fast chargers' },
  { icon: '⌁', label: 'Commerce', question: 'What are the top 5 product categories by number of products?' },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="icon-mark">{children}</span>;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'json' | 'sql' | 'chart'>('table');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const handleSubmit = async (event: React.FormEvent | string) => {
    if (typeof event !== 'string') event.preventDefault();
    const query = (typeof event === 'string' ? event : question).trim();
    if (!query || loading) return;

    setQuestion('');
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
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${res.status}).`);
      setResponse(data);
      setQueryHistory((previous) => [query, ...previous.filter((item) => item !== query)].slice(0, 6));
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Unable to reach the Dwarpal API. Check that the Render service is live and NEXT_PUBLIC_API_URL points to it.'
        : err instanceof Error ? err.message : 'Query execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const results: ResultRow[] = response?.results ?? response?.rows ?? [];
  const columns = results.length
    ? Array.isArray(results[0])
      ? (results[0] as unknown[]).map((_, index) => `Column ${index + 1}`)
      : Object.keys(results[0] as Record<string, unknown>)
    : response?.columns ?? [];

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
    link.download = 'dwarpal-export.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderTable = () => {
    if (!results.length) {
      return <div className="empty-state"><span className="empty-orbit">◌</span><strong>No rows returned</strong><span>Your query ran successfully, but the database returned no records.</span></div>;
    }
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>{columns.map((column: string, index: number) => <th key={`${column}-${index}`}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
          <tbody>{results.map((row, rowIndex) => {
            const values = Array.isArray(row) ? row : Object.values(row);
            return <tr key={rowIndex}>{values.map((cell, cellIndex) => <td key={cellIndex}>{cell == null ? <span className="null-value">NULL</span> : String(cell)}</td>)}</tr>;
          })}</tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    if (!results.length || columns.length < 2) {
      return <div className="empty-state"><span className="empty-orbit">⌁</span><strong>More data needed</strong><span>A chart needs at least two result columns.</span></div>;
    }
    const chartData = results.map((row) => {
      const values = Array.isArray(row) ? row : Object.values(row);
      const numeric = Number(values[1]);
      return { label: String(values[0] ?? ''), amount: Number.isFinite(numeric) ? numeric : 0 };
    });
    const chartType = response?.chart === 'line' ? 'line' : 'bar';
    return <div className="chart-wrap"><div className="chart-caption"><span>RESULT DISTRIBUTION</span><span className="chart-type">{chartType} view</span></div><div className="chart-canvas"><ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? <LineChart data={chartData} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}><CartesianGrid stroke="#202b3b" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#8190a7', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#8190a7', fontSize: 11 }} axisLine={false} tickLine={false} /><RechartsTooltip contentStyle={{ background: '#101824', border: '1px solid #26354a', borderRadius: 12, color: '#f3f7ff' }} /><Legend /><Line type="monotone" dataKey="amount" name={columns[1]} stroke="#54e4c2" strokeWidth={3} dot={{ fill: '#54e4c2', r: 4 }} /></LineChart>
        : <BarChart data={chartData} margin={{ top: 12, right: 12, left: -15, bottom: 0 }}><CartesianGrid stroke="#202b3b" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#8190a7', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#8190a7', fontSize: 11 }} axisLine={false} tickLine={false} /><RechartsTooltip contentStyle={{ background: '#101824', border: '1px solid #26354a', borderRadius: 12, color: '#f3f7ff' }} /><Legend /><Bar dataKey="amount" name={columns[1]} fill="#5d83ff" radius={[6, 6, 0, 0]} /></BarChart>}
    </ResponsiveContainer></div></div>;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#workspace" className="brand"><span className="brand-symbol"><Icon>✳</Icon></span><span><strong>Dwarpal<span className="brand-os">OS</span></strong><small>INTELLIGENCE, GUARDED</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <button className="workspace-link active"><Icon>⌂</Icon><span>Query studio</span><span className="active-line" /></button>
        <a className="workspace-link" href="/audit"><Icon>◈</Icon><span>Audit trail</span></a>
        <div className="side-divider" />
        <div className="side-heading"><span className="side-label">RECENT QUERIES</span><span className="history-count">{queryHistory.length.toString().padStart(2, '0')}</span></div>
        {queryHistory.length ? <div className="recent-list">{queryHistory.map((item, index) => <button key={`${item}-${index}`} onClick={() => handleSubmit(item)} className="recent-query"><span className="recent-dot" /><span>{item}</span></button>)}</div> : <div className="no-history">Your query history<br />will appear here.</div>}
        <div className="sidebar-bottom">
          <div className="secure-card"><div className="secure-icon">⌑</div><div><strong>Protected session</strong><span>Read-only query mode</span></div><span className="secure-check">✓</span></div>
          <div className="user-chip"><div className="avatar">DW</div><div className="user-name"><strong>Dwarpal Analyst</strong><span>Workspace member</span></div><span className="user-menu">···</span></div>
        </div>
      </aside>

      <main id="workspace" className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Query studio</strong></div><div className="topbar-right"><div className="system-status"><span className="status-pulse" /> POLICY <span className="status-divider">·</span> GUARDED</div><a className="help-button" href="/audit" aria-label="View audit trail">?</a><div className="top-avatar">DW</div></div></header>
        <section className="workspace-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SECURE BUSINESS INTELLIGENCE</div><h1>Ask your data<span className="heading-period">.</span></h1><p>Explore your business with natural language. Queries are checked against your schema and read-only policy.</p></div><div className="live-pill"><span className="status-pulse" /> READ-ONLY POLICY</div></div>

          <form onSubmit={handleSubmit} className="query-composer">
            <div className="composer-top"><div className="composer-mark"><Icon>⌕</Icon></div><div className="composer-prompt"><span>QUERY YOUR WORKSPACE</span><span className="shortcut">NATURAL LANGUAGE <i>↗</i></span></div></div>
            <textarea aria-label="Ask a question about your data" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event as unknown as React.FormEvent); } }} placeholder="Ask a question about your business data…" rows={2} />
            <div className="composer-footer"><span className="composer-hint"><kbd>↵</kbd> to run <span>·</span> <kbd>⇧ ↵</kbd> for new line</span><button type="submit" disabled={loading || !question.trim()} className="run-button">{loading ? <><span className="button-spinner" /> Thinking</> : <>Run query <span>↗</span></>}</button></div>
          </form>

          {!response && !error && !loading && <section className="suggestion-section"><div className="section-kicker">NOT SURE WHERE TO START? <span>TRY A PROMPT</span></div><div className="suggestion-grid">{suggestions.map((item) => <button key={item.label} onClick={() => handleSubmit(item.question)} className="suggestion-card"><span className="suggestion-icon">{item.icon}</span><span><small>{item.label}</small><strong>{item.question}</strong></span><span className="suggestion-arrow">↗</span></button>)}</div></section>}

          {loading && <section className="loading-panel"><div className="loading-orb"><span /></div><div><strong>Working through your request</strong><p>Generating a safe query and retrieving your results…</p></div><div className="loading-steps"><span className="step-done">✓ Policy check</span><span className="step-active"><i /> Querying data</span></div></section>}

          {error && <section className="error-panel"><div className="error-icon">!</div><div><span className="error-label">QUERY COULD NOT RUN</span><strong>{error}</strong><p>{error.includes('Gemini API quota') ? 'Try again after the quota reset, or configure a model and billing plan with available capacity.' : 'Check your connection or adjust the question, then try again.'}</p></div><button onClick={() => setError(null)} aria-label="Dismiss error">×</button></section>}

          {response && <section className="results-section">
            {response.insight && <div className="insight-banner"><div className="insight-icon">✳</div><div><span>GENERATION NOTE</span><p>{response.insight}</p></div><div className="verified-tag"><span>✓</span> POLICY CHECKED</div></div>}
            <div className="results-heading"><div><div className="section-kicker">QUERY RESULTS</div><h2>Your data, at a glance</h2></div><button className="export-button" onClick={downloadCSV} disabled={!results.length}>↓ <span>Export CSV</span></button></div>
            <div className="metric-strip"><div className="metric-card"><span>ROWS RETURNED</span><strong>{response.row_count ?? results.length}</strong><small><i className="metric-dot" /> Live result set</small></div><div className="metric-card"><span>FIELDS</span><strong>{columns.length}</strong><small>Columns in this view</small></div><div className="metric-card"><span>EXECUTION STATUS</span><strong className="metric-success">{response.status === 'BLOCKED' ? 'Blocked' : 'Complete'}</strong><small><i className="metric-dot" /> Policy checked</small></div></div>
            <div className="results-card"><div className="results-toolbar"><div className="tab-list" role="tablist" aria-label="Result view">{([['table', 'Data grid'], ['chart', 'Visualize'], ['json', 'Raw JSON'], ...(response.sql ? [['sql', 'SQL'] as string[]] : [])] as string[][]).map(([id, label]) => <button role="tab" aria-selected={activeTab === id} key={id} onClick={() => setActiveTab(id as typeof activeTab)} className={`result-tab ${activeTab === id ? 'selected' : ''}`}>{label}</button>)}</div><div className="result-meta"><span className="meta-dot" /> {response.source === 'cache' ? 'Cached result' : 'Policy-approved SQL'}</div></div>
              <div className="results-body">{activeTab === 'table' && renderTable()}{activeTab === 'chart' && renderChart()}{activeTab === 'json' && <pre className="code-view">{JSON.stringify(results, null, 2)}</pre>}{activeTab === 'sql' && <div className="sql-view"><div className="code-label">EXECUTED SQL <span>READ ONLY</span></div><pre className="code-view">{response.sql}</pre></div>}</div>
              <div className="results-foot"><span>Selected result patterns redacted</span><span>{response.audit_hash ? `AUDIT ${response.audit_hash.slice(0, 12)}…` : 'QUERY SESSION'}</span></div>
            </div>
          </section>}
          <footer className="page-footer"><span>DWARPAL OS <i>·</i> SECURE ANALYTICS</span><span>BUILT FOR CLARITY. DESIGNED FOR TRUST.</span></footer>
        </section>
      </main>
    </div>
  );
}
