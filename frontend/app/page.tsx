'use client';

import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'json' | 'sql' | 'chart'>('table');
  const [history, setHistory] = useState<Message[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const suggestions = [
    "How many users are active?",
    "Show me the latest 10 audit logs",
    "Count the total number of blocked queries"
  ];

  const handleSubmit = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const query = typeof e === 'string' ? e : question;
    if (!query.trim()) return;

    setQuestion('');
    setLoading(true);
    setError(null);
    setResponse(null);
    setActiveTab('table');

    const updatedHistory: Message[] = [...history, { role: 'user', content: query }];

    try {
      const res = await fetch('http://localhost:8000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: query, 
          history: updatedHistory 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');

      setResponse(data);
      setHistory([
        ...updatedHistory, 
        { role: 'assistant', content: data.insight || 'Query executed successfully.' }
      ]);

      if (!queryHistory.includes(query)) {
        setQueryHistory([query, ...queryHistory].slice(0, 5));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!response?.results || response.results.length === 0) return;
    const isArrayOfArrays = Array.isArray(response.results[0]);
    let csvContent = "data:text/csv;charset=utf-8,";
    
    response.results.forEach((row: any) => {
      const rowString = isArrayOfArrays ? row.join(",") : Object.values(row).join(",");
      csvContent += rowString + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dwarpal_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTable = () => {
    if (!response?.results || response.results.length === 0) {
      return <div className="text-slate-500 flex items-center justify-center h-48">No data returned from database.</div>;
    }
    
    const isArrayOfArrays = Array.isArray(response.results[0]);
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              {isArrayOfArrays ? 
                response.results[0].map((_: any, i: number) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Col {i + 1}</th>
                )) : 
                Object.keys(response.results[0]).map((key) => (
                  <th key={key} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{key}</th>
                ))
              }
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {response.results.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                {isArrayOfArrays ? 
                  row.map((cell: any, j: number) => (
                    <td key={j} className="px-4 py-3 text-sm text-slate-300">{String(cell)}</td>
                  )) : 
                  Object.values(row).map((cell: any, j: number) => (
                    <td key={j} className="px-4 py-3 text-sm text-slate-300">{String(cell)}</td>
                  ))
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    if (!response?.results || response.results.length === 0) {
      return <div className="text-slate-500 flex items-center justify-center h-48">No data to visualize.</div>;
    }

    const isArrayOfArrays = Array.isArray(response.results[0]);
    let chartData = [];
    let xKey = 'name';
    let yKey = 'value';

    if (isArrayOfArrays) {
      if (response.results[0].length < 2) return <div className="text-slate-500 flex items-center justify-center h-48">Requires at least 2 columns to generate a chart.</div>;
      chartData = response.results.map((row: any[]) => ({
        name: String(row[0]),
        value: typeof row[1] === 'number' ? row[1] : parseFloat(row[1]) || 0
      }));
    } else {
      const keys = Object.keys(response.results[0]);
      if (keys.length < 2) return <div className="text-slate-500 flex items-center justify-center h-48">Requires at least 2 columns to generate a chart.</div>;
      xKey = keys[0];
      yKey = keys[1];
      chartData = response.results.map((row: any) => ({
        ...row,
        [yKey]: typeof row[yKey] === 'number' ? row[yKey] : parseFloat(row[yKey]) || 0
      }));
    }

    const chartType = response.chart || 'bar';

    return (
      <div className="h-96 w-full p-4 bg-[#09090b]">
        <div className="text-xs text-slate-500 mb-2 uppercase tracking-widest">AI Recommended View: <span className="text-blue-400 font-bold">{chartType} chart</span></div>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xKey} stroke="#888" />
              <YAxis stroke="#888" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }} />
              <Legend />
              <Line type="monotone" dataKey={yKey} stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xKey} stroke="#888" />
              <YAxis stroke="#888" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }} />
              <Legend />
              <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-72 border-r border-slate-800 bg-[#0c0c0e] flex-col hidden md:flex">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">Dwarpal OS</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Queries</h2>
            {queryHistory.length === 0 ? (
              <p className="text-sm text-slate-600 italic">No recent queries</p>
            ) : (
              <ul className="space-y-2">
                {queryHistory.map((q, idx) => (
                  <li key={idx} onClick={() => handleSubmit(q)} className="text-sm text-slate-400 hover:text-white cursor-pointer truncate transition-colors py-1 px-2 hover:bg-slate-800 rounded">
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Agent Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Self-Correction Active
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Context Memory ON
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900/40 via-[#09090b] to-[#09090b]">
        
        {/* Command Bar */}
        <div className="p-6 border-b border-slate-800 bg-[#09090b]/80 backdrop-blur-md z-10">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
               <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question or request a follow-up refinement..."
              className="w-full bg-[#121214] border border-slate-700/50 rounded-xl px-12 py-4 text-white shadow-xl focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-slate-600"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 top-2 bottom-2 bg-white text-black hover:bg-slate-200 px-6 rounded-lg font-semibold transition-all disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {loading ? 'Agent Working...' : 'Run Query'}
            </button>
          </form>
          
          {!response && !error && !loading && (
             <div className="max-w-4xl mx-auto mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
               <span className="text-xs text-slate-500 font-semibold py-1.5 pr-2 whitespace-nowrap">SUGGESTED:</span>
               {suggestions.map((sugg, idx) => (
                 <button key={idx} onClick={() => handleSubmit(sugg)} className="whitespace-nowrap px-3 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/50 text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                   {sugg}
                 </button>
               ))}
             </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {loading && (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-slate-800/50 rounded-lg w-1/3"></div>
                <div className="h-48 bg-slate-800/20 rounded-xl border border-slate-800/50"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-950/30 border border-red-500/30 p-5 rounded-xl flex items-start gap-4">
                <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                <div>
                  <h3 className="font-semibold text-red-300">Agent Execution Blocked</h3>
                  <p className="text-sm text-red-200/70 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Results Window */}
            {response && (
              <>
                {response.insight && (
                  <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3 shadow-lg">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Autonomous Agent Insight</h4>
                      <p className="text-sm text-slate-200 leading-relaxed">{response.insight}</p>
                    </div>
                  </div>
                )}

                <div className="bg-[#121214] border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                  
                  <div className="bg-[#18181b] border-b border-slate-800 px-4 py-3 flex items-center justify-between overflow-x-auto">
                    <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-slate-800/50 min-w-max">
                      <button onClick={() => setActiveTab('table')} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === 'table' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Data Grid</button>
                      <button onClick={() => setActiveTab('chart')} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === 'chart' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300 flex items-center gap-1'}`}>
                        Visualize
                      </button>
                      <button onClick={() => setActiveTab('json')} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === 'json' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Raw JSON</button>
                      {response.sql && <button onClick={() => setActiveTab('sql')} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === 'sql' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>SQL Execution</button>}
                    </div>
                    
                    <div className="flex items-center gap-3 ml-4 min-w-max">
                      <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {response.source === 'cache' ? 'Served from Cache' : 'Verified Agent Query'}
                      </span>
                      <button onClick={downloadCSV} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-lg shadow-blue-500/20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[600px] overflow-y-auto">
                    {activeTab === 'table' && renderTable()}
                    {activeTab === 'chart' && renderChart()}
                    
                    {activeTab === 'json' && (
                      <div className="p-4 bg-[#09090b]">
                        <pre className="text-slate-300 text-xs font-mono leading-relaxed overflow-x-auto">
                          {JSON.stringify(response.results, null, 2)}
                        </pre>
                      </div>
                    )}

                    {activeTab === 'sql' && (
                      <div className="p-6 bg-[#09090b]">
                        <div className="mb-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">Executed Statement (Self-Corrected if needed):</div>
                        <pre className="text-blue-400 text-sm font-mono leading-relaxed bg-blue-950/20 p-4 rounded-lg border border-blue-900/30 overflow-x-auto">
                          {response.sql}
                        </pre>
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
