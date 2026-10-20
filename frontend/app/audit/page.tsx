'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://dwarpal-aqs2.onrender.com').replace(/\/$/, '');

type AuditEntry = {
  id: number;
  timestamp: string | null;
  user_prompt: string;
  generated_sql: string | null;
  status: string;
  pii_redacted: boolean;
  prev_hash: string;
  entry_hash: string;
};

type AuditResponse = {
  is_intact: boolean;
  record_count: number;
  chain: AuditEntry[];
};

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ALLOWED' | 'BLOCKED' | 'ERROR'>('all');
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/audit`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || `Audit request failed (${response.status}).`);
        return body as AuditResponse;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof TypeError
              ? 'Could not reach the Dwarpal API. Ensure the backend service is running and accessible.'
              : reason instanceof Error
              ? reason.message
              : 'Could not load the audit trail.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredChain = data?.chain.filter((entry) => {
    if (filter !== 'all' && entry.status.toUpperCase() !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        entry.user_prompt.toLowerCase().includes(q) ||
        (entry.generated_sql && entry.generated_sql.toLowerCase().includes(q)) ||
        entry.entry_hash.toLowerCase().includes(q) ||
        entry.prev_hash.toLowerCase().includes(q)
      );
    }
    return true;
  }) ?? [];

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink)]">
      {/* Stripe Signature Atmospheric Gradient Mesh */}
      <div className="mesh-backdrop" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/75 border-b border-[var(--border-light)] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group text-decoration-none">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shadow-[0_2px_8px_rgba(83,58,253,0.3)]">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-base tracking-tight text-[var(--ink)]">Dwarpal</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--primary-subdued)] text-[var(--primary-deep)]">OS</span>
                </div>
                <span className="text-[9px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase">
                  Guarded Intelligence
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[var(--border-light)]">
              <Link href="/" className="btn-ghost-pill">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Query Studio
              </Link>
              <Link href="/audit" className="btn-ghost-pill active">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Audit Chain
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-[var(--ink-secondary)] hover:text-[var(--primary)] font-medium flex items-center gap-1.5 py-1 px-3 rounded-full border border-[var(--border-light)] hover:border-[var(--primary)] transition-all bg-white"
            >
              <span>← Back to Query Studio</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-10 pb-20">

        {/* Editorial Header */}
        <div className="max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[var(--border-light)] shadow-xs mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">
              Cryptographic Integrity Chain
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-[var(--ink)] leading-tight">
            Immutable Audit Trail
          </h1>

          <p className="mt-2 text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed">
            Every user prompt, synthesized SQL query, and execution outcome is hash-chained with SHA-256 to ensure transparent, non-repudiable auditability.
          </p>
        </div>

        {/* Chain Health Overview Strip (Stripe tnum tabular cards) */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
            <div className="craft-card p-4.5 bg-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] block">
                Chain Integrity Status
              </span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-3 h-3 rounded-full ${data.is_intact ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`text-xl font-semibold tracking-tight ${data.is_intact ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {data.is_intact ? 'Cryptographically Intact' : 'Tamper Detected'}
                </span>
              </div>
              <span className="text-xs text-[var(--ink-muted)] mt-1 block">
                {data.is_intact
                  ? 'All sequential block hashes match cryptographic root'
                  : 'Hash divergence found — review security logs'}
              </span>
            </div>

            <div className="craft-card p-4.5 bg-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] block">
                Total Audit Records
              </span>
              <div className="text-2xl font-semibold tracking-tight text-[var(--ink)] mt-1 tabular">
                {data.record_count}
              </div>
              <span className="text-xs text-[var(--ink-muted)] mt-1 block">
                SHA-256 blocks stored in persistent ledger
              </span>
            </div>

            <div className="craft-card p-4.5 bg-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] block">
                Chain Protocol
              </span>
              <div className="text-sm font-mono font-medium text-[var(--ink)] mt-2">
                SHA256(prev_hash + prompt + sql + status)
              </div>
              <span className="text-xs text-[var(--ink-muted)] mt-1 block">
                Deterministic hash forward link
              </span>
            </div>
          </div>
        )}

        {/* Filters and Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-[var(--border-light)] shadow-xs">
            {(['all', 'ALLOWED', 'BLOCKED', 'ERROR'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`btn-ghost-pill text-xs py-1 px-3.5 ${filter === mode ? 'active' : ''}`}
              >
                {mode === 'all' ? 'All Records' : mode === 'ALLOWED' ? 'Allowed' : mode === 'BLOCKED' ? 'Blocked' : 'Errors'}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompt, SQL, or hash…"
              className="w-full sm:w-64 text-xs bg-white border border-[var(--border-light)] rounded-full px-3.5 py-1.5 text-[var(--ink)] placeholder-[var(--ink-faint)] outline-none focus:border-[var(--primary)] transition-all shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="craft-card p-12 text-center bg-white/80">
            <svg className="w-8 h-8 animate-spin mx-auto text-[var(--primary)] mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-[var(--ink-secondary)]">Loading hash-chained audit events…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="craft-card p-5 border-rose-200 bg-rose-50/70 border mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-[var(--ruby)] flex items-center justify-center shrink-0 font-bold text-sm">
                !
              </div>
              <div>
                <span className="pill-tag pill-tag-ruby text-[10px]">AUDIT RETRIEVAL ERROR</span>
                <p className="text-sm font-semibold text-rose-900 mt-1">{error}</p>
                <p className="text-xs text-rose-700 mt-1">
                  Check if your backend database is initialized with the audit_log table.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Blocks Stream */}
        {!loading && data && (
          <div className="space-y-4">
            {filteredChain.length === 0 ? (
              <div className="craft-card p-12 text-center bg-white">
                <div className="text-2xl mb-2">∅</div>
                <h4 className="text-sm font-semibold text-[var(--ink)]">No audit records found</h4>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  {search || filter !== 'all'
                    ? 'No events match your active search or filter criteria.'
                    : 'Run a query in the Query Studio to record the first cryptographic audit event.'}
                </p>
              </div>
            ) : (
              filteredChain.map((entry, index) => {
                const isAllowed = entry.status.toUpperCase() === 'ALLOWED';
                const isBlocked = entry.status.toUpperCase() === 'BLOCKED';
                return (
                  <article
                    key={entry.id}
                    className="craft-card p-5 bg-white transition-all hover:border-[var(--border-interactive)] relative"
                  >
                    {/* Visual Chain Connector Line */}
                    {index < filteredChain.length - 1 && (
                      <div className="absolute left-8 bottom-[-16px] w-[1px] h-[16px] bg-[var(--border-light)] hidden sm:block z-0" />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-light)]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-semibold text-[var(--ink-muted)] bg-[var(--canvas-subtle)] px-2 py-0.5 rounded border border-[var(--border-light)]">
                          #{entry.id}
                        </span>
                        <span
                          className={`pill-tag ${
                            isAllowed
                              ? 'pill-tag-emerald'
                              : isBlocked
                              ? 'pill-tag-amber'
                              : 'pill-tag-ruby'
                          }`}
                        >
                          {entry.status}
                        </span>
                        {entry.pii_redacted && (
                          <span className="pill-tag pill-tag-indigo text-[10px]">
                            PII Redacted
                          </span>
                        )}
                      </div>

                      <time className="text-xs text-[var(--ink-muted)] font-mono tabular">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Timestamp unavailable'}
                      </time>
                    </div>

                    <div className="py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] block mb-1">
                        User Prompt
                      </span>
                      <p className="text-sm sm:text-base font-medium text-[var(--ink)] leading-snug">
                        {entry.user_prompt}
                      </p>
                    </div>

                    {entry.generated_sql && (
                      <div className="my-2">
                        <div className="dark-console-panel overflow-hidden">
                          <div className="px-3.5 py-1.5 bg-[#0e172e] border-b border-[#1e2942] flex items-center justify-between text-[11px] font-mono text-gray-400">
                            <span>Synthesized Read-Only SQL</span>
                            <button
                              onClick={() => copyToClipboard(entry.generated_sql || '')}
                              className="text-gray-300 hover:text-white cursor-pointer"
                            >
                              {copiedHash === entry.generated_sql ? '✓ Copied' : 'Copy SQL'}
                            </button>
                          </div>
                          <pre className="p-3 text-xs font-mono leading-relaxed text-indigo-100 overflow-x-auto whitespace-pre-wrap">
                            {entry.generated_sql}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Hashes Box */}
                    <div className="mt-3 pt-3 border-t border-[var(--border-light)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-[var(--canvas-subtle)] p-2 rounded border border-[var(--border-light)]">
                        <div className="flex items-center justify-between text-[10px] uppercase text-[var(--ink-muted)] font-semibold mb-0.5">
                          <span>Entry Hash</span>
                          <button
                            onClick={() => copyToClipboard(entry.entry_hash)}
                            className="text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            {copiedHash === entry.entry_hash ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <span className="text-[var(--ink)] text-[11px] break-all">
                          {entry.entry_hash}
                        </span>
                      </div>

                      <div className="bg-[var(--canvas-subtle)] p-2 rounded border border-[var(--border-light)]">
                        <div className="flex items-center justify-between text-[10px] uppercase text-[var(--ink-muted)] font-semibold mb-0.5">
                          <span>Previous Hash</span>
                          <button
                            onClick={() => copyToClipboard(entry.prev_hash)}
                            className="text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            {copiedHash === entry.prev_hash ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <span className="text-[var(--ink-muted)] text-[11px] break-all">
                          {entry.prev_hash}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            <div className="mt-8 p-4 rounded-xl bg-[var(--canvas-cream)] border border-[#ebd9b8] text-xs text-amber-950/80 leading-relaxed">
              <strong>Cryptographic Guarantee:</strong> SHA-256 hash chaining ensures that any retroactive modification of past queries, schemas, or results causes an immediate checksum cascade failure across all subsequent blocks, providing verifiable proof of audit integrity.
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
