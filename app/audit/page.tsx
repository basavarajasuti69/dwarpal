'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuditPage() {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/audit')
      .then((res) => res.json())
      .then((data) => {
        setAuditData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-200 font-sans p-8 selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 transition-colors">
              ← Workspace
            </Link>
            <h1 className="text-xl font-bold text-white tracking-tight">Cryptographic Audit Chain Inspector</h1>
          </div>
          {auditData && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${auditData.is_intact ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' : 'bg-red-950/60 border-red-800 text-red-400'}`}>
                {auditData.is_intact ? '✅ SHA-256 CHAIN INTACT' : '❌ CHAIN COMPROMISED'}
              </span>
              <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                {auditData.record_count} Verified Blocks
              </span>
            </div>
          )}
        </div>

        {/* Audit Stream Table */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">Loading audit chain records...</div>
        ) : (
          <div className="bg-[#121214] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#18181b] text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">User Prompt</th>
                    <th className="px-4 py-3">Executed / Intercepted SQL</th>
                    <th className="px-4 py-3">Previous Block Hash</th>
                    <th className="px-4 py-3">Current Entry Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {auditData?.chain?.map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{entry.timestamp}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.status === 'ALLOWED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-red-950 text-red-400 border border-red-800/50'}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200 font-sans max-w-xs truncate">{entry.prompt}</td>
                      <td className="px-4 py-3 text-blue-400 max-w-xs truncate">{entry.sql}</td>
                      <td className="px-4 py-3 text-slate-500 text-[10px] truncate max-w-[120px]">{entry.prev_hash}</td>
                      <td className="px-4 py-3 text-emerald-400 text-[10px] truncate max-w-[120px]">{entry.entry_hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
