'use client';

import { useState } from 'react';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('http://localhost:8000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Something went wrong');
      }

      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🛡️ Dwarpal Secure Analytics</h1>
        <p className="text-gray-400 mb-8">Natural language data exploration with enterprise-grade guardrails.</p>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., How many customers are in the database?"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            ⚠️ <strong>Blocked / Error:</strong> {error}
          </div>
        )}

        {response && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Source:</span>
              <span className="ml-2 bg-blue-900/60 text-blue-300 text-xs px-2 py-1 rounded uppercase">
                {response.source}
              </span>
            </div>

            {response.sql && (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Generated SQL:</span>
                <pre className="bg-gray-900 p-3 rounded text-green-400 text-sm mt-1 overflow-x-auto">
                  {response.sql}
                </pre>
              </div>
            )}

            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Results:</span>
              <div className="bg-gray-900 p-4 rounded mt-1 overflow-x-auto max-h-96">
                <pre className="text-gray-200 text-sm">
                  {JSON.stringify(response.results, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
