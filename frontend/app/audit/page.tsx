'use client';

import { useEffect, useState } from 'react';

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

type AuditResponse = { is_intact: boolean; record_count: number; chain: AuditEntry[] };

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/audit`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || `Audit request failed (${response.status}).`);
        return body as AuditResponse;
      })
      .then((body) => { if (active) setData(body); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof TypeError
          ? 'Could not reach the Dwarpal API. Check that the backend is deployed and configured.'
          : reason instanceof Error ? reason.message : 'Could not load the audit trail.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand"><span className="brand-symbol"><span className="icon-mark">✳</span></span><span><strong>Dwarpal<span className="brand-os">OS</span></strong><small>INTELLIGENCE, GUARDED</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <a className="workspace-link" href="/"><span className="icon-mark">⌂</span><span>Query studio</span></a>
        <a className="workspace-link active" href="/audit"><span className="icon-mark">◈</span><span>Audit trail</span><span className="active-line" /></a>
        <div className="sidebar-bottom"><div className="secure-card"><div className="secure-icon">⌑</div><div><strong>Integrity check</strong><span>Hash-linked records</span></div></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><a href="/">Workspace</a><b>/</b><strong>Audit trail</strong></div><a className="audit-back" href="/">← Query studio</a></header>
        <section className="workspace-content audit-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> GOVERNANCE &amp; TRACEABILITY</div><h1>Audit trail<span className="heading-period">.</span></h1><p>Review query decisions and verify the hash-linked audit records.</p></div></div>
          {loading && <div className="audit-state"><span className="button-spinner" /> Loading audit records…</div>}
          {error && <div className="error-panel"><div className="error-icon">!</div><div><span className="error-label">AUDIT TRAIL UNAVAILABLE</span><strong>{error}</strong><p>Audit records require the backend audit database to be configured.</p></div></div>}
          {data && <>
            <div className="audit-summary"><div className="metric-card"><span>RECORDS</span><strong>{data.record_count}</strong><small>Hash-linked query events</small></div><div className="metric-card"><span>CHAIN CHECK</span><strong className={data.is_intact ? 'metric-success' : 'audit-failed'}>{data.is_intact ? 'Intact' : 'Mismatch'}</strong><small>{data.is_intact ? 'All returned entries verified' : 'One or more entries failed verification'}</small></div></div>
            {data.chain.length ? <div className="audit-list">{data.chain.map((entry) => <article className="audit-entry" key={entry.id}><div className="audit-entry-top"><span className={`audit-status ${entry.status.toLowerCase()}`}>{entry.status}</span><time>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Time unavailable'}</time><span className="audit-id">#{entry.id}</span></div><h2>{entry.user_prompt}</h2>{entry.generated_sql && <pre className="code-view">{entry.generated_sql}</pre>}<div className="audit-hashes"><span>ENTRY <code>{entry.entry_hash}</code></span><span>PREVIOUS <code>{entry.prev_hash}</code></span></div></article>)}</div> : <div className="audit-state">No audit entries have been recorded yet.</div>}
            <p className="audit-note">Hash chaining makes later edits detectable when the chain is verified. It does not prevent database administrators from changing or deleting records.</p>
          </>}
        </section>
      </main>
    </div>
  );
}
