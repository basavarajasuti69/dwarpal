'use client';

import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'json' | 'sql'>('table');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const suggestions = [
    "Show top 5 states by EV registrations",
    "Count total electric vehicles",
    "List 3 vehicle categories in the dataset",
    "Show synthetic customer email addresses"
  ];

  const handleSubmit = async (q?: string | React.FormEvent) => {
    if (q && typeof q === 'object' && 'preventDefault' in q) {
      q.preventDefault();
    }
    const targetQuery = typeof q === 'string' ? q : question;
    if (!targetQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://dwarpal-aqs2.onrender.com').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: targetQuery }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.rationale || 'Query execution failed');

      setResponse(data);
      if (!queryHistory.includes(targetQuery)) {
        setQueryHistory([targetQuery, ...queryHistory].slice(0, 5));
      }
    } catch (err: any) {
      setError(err instanceof TypeError
        ? 'Unable to reach the Dwarpal API. Check that the Render service is live and NEXT_PUBLIC_API_URL points to it.'
        : err.message || 'Query execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = () => {
    if (!response?.results || response.results.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    const keys = Object.keys(response.results[0]);
    csvContent += keys.join(",") + "\r\n";

    response.results.forEach((row: any) => {
      csvContent += Object.values(row).join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dwarpal_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-slate-800 bg-[#0c0c0e] flex-col hidden md:flex">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Dwarpal OS</h1>
          </div>
          <span className="text-[10px] font-mono bg-blue-950 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded">v1.0</span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Queries</h2>
            {queryHistory.length === 0 ? (
              <p className="text-sm text-slate-600 italic">No recent queries</p>
            ) : (
              <ul className="space-y-2">
                {queryHistory.map((q, idx) => (
                  <li key={idx} onClick={() => { setQuestion(q); handleSubmit(q); }} className="text-sm text-slate-400 hover:text-white cursor-pointer truncate py-1 px-2 hover:bg-slate-800/50 rounded transition-colors">
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">System Guards</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> PII Masking Engine
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> SHA-256 Audit Chain
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Read-Only Role Guard
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900/40 via-[#09090b] to-[#09090b]">
        
        {/* Command Bar */}
        <div className="p-6 border-b border-slate-800 bg-[#09090b]/80 backdrop-blur-md z-10">
          <form onSubmit={(e) => handleSubmit(e)} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a natural language query or analysis question..."
              className="w-full bg-[#121214] border border-slate-700/50 rounded-xl px-5 py-4 pr-32 text-white shadow-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-slate-600 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 top-2 bottom-2 bg-white text-black hover:bg-slate-200 px-5 rounded-lg font-semibold transition-all disabled:opacity-50 text-xs flex items-center gap-2"
            >
              {loading ? 'Executing...' : 'Run Query'}
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="max-w-4xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {suggestions.map((sugg, idx) => (
              <button key={idx} onClick={() => { setQuestion(sugg); handleSubmit(sugg); }} className="whitespace-nowrap px-3 py-1 rounded-md bg-slate-800/40 border border-slate-700/50 text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                {sugg}
              </button>
            ))}
          </div>
        </div>

        {/* Content View Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {error && (
              <div className="bg-red-950/30 border border-red-500/30 p-4 rounded-xl flex items-start gap-3">
                <span className="text-red-400 font-bold">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-300 text-sm">Execution Blocked</h3>
                  <p className="text-xs text-red-200/70 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {response && (
              <>
                {/* Insight Box */}
                {response.insight && (
                  <div className="bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-slate-900 border border-blue-500/30 p-4 rounded-xl flex items-start justify-between shadow-lg">
                    <div>
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Agent Rationale & Insight</h4>
                      <p className="text-xs text-slate-200 leading-relaxed">{response.insight}</p>
                    </div>
                    {response.audit_hash && (
                      <div className="text-right ml-4 min-w-max">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-1 rounded block">
                          SHA-256: {response.audit_hash.slice(0, 10)}...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Data Window */}
                <div className="bg-[#121214] border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
                  <div className="bg-[#18181b] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-slate-800/50">
                      <button onClick={() => setActiveTab('table')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${activeTab === 'table' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Data Grid ({response.row_count || 0})</button>
                      <button onClick={() => setActiveTab('chart')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${activeTab === 'chart' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Visualize</button>
                      <button onClick={() => setActiveTab('json')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${activeTab === 'json' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Raw JSON</button>
                      {response.sql && <button onClick={() => setActiveTab('sql')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${activeTab === 'sql' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>SQL Statement</button>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={downloadCSV} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-md transition-colors shadow">
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {/* Panel Content */}
                  <div className="p-4 max-h-[500px] overflow-auto">
                    {activeTab === 'table' && response.results && (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/50">
                            {Object.keys(response.results[0] || {}).map((key) => (
                              <th key={key} className="px-3 py-2 font-semibold text-slate-400 uppercase tracking-wider">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {response.results.map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                              {Object.values(row).map((val: any, j: number) => (
                                <td key={j} className="px-3 py-2 text-slate-300">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {activeTab === 'json' && (
                      <div className="relative">
                        <button onClick={() => copyToClipboard(JSON.stringify(response.results, null, 2))} className="absolute right-2 top-2 text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 text-slate-300">
                          {copied ? 'Copied!' : 'Copy JSON'}
                        </button>
                        <pre className="text-slate-300 text-xs font-mono leading-relaxed">{JSON.stringify(response.results, null, 2)}</pre>
                      </div>
                    )}

                    {activeTab === 'sql' && (
                      <div className="relative">
                        <button onClick={() => copyToClipboard(response.sql)} className="absolute right-2 top-2 text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 text-slate-300">
                          {copied ? 'Copied!' : 'Copy SQL'}
                        </button>
                        <pre className="text-blue-400 text-xs font-mono leading-relaxed bg-blue-950/20 p-3 rounded border border-blue-900/30">{response.sql}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
