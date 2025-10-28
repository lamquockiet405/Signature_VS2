"use client";

import React, { useEffect, useState } from "react";
import { logsAPI } from "../lib/api";

type LogRow = {
  id: string;
  user_id: string | number | null;
  action: string;
  module: string | null;
  description: string | null;
  metadata: any;
  created_at: string;
};

export default function LogsTable() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await logsAPI.getAll(p, 50);
      // backend returns { logs: [...], pagination: { ... } } or array depending on impl
      const rows = Array.isArray(res) ? res : res.logs || res.data || [];
      setLogs(rows);
      setPage(p);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Activity Logs</h2>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      <div className="overflow-auto">
        <table className="w-full text-sm table-auto">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">User</th>
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Module</th>
              <th className="px-2 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-2 py-2 align-top">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-2 py-2 align-top">
                  {String(l.user_id || "System")}
                </td>
                <td className="px-2 py-2 align-top">{l.action}</td>
                <td className="px-2 py-2 align-top">{l.module || "-"}</td>
                <td className="px-2 py-2 align-top">
                  {l.description || JSON.stringify(l.metadata || {})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          className="px-3 py-1 bg-gray-100 rounded"
          onClick={() => fetchLogs(Math.max(1, page - 1))}
          disabled={loading || page === 1}
        >
          Previous
        </button>
        <div>Page {page}</div>
        <button
          className="px-3 py-1 bg-gray-100 rounded"
          onClick={() => fetchLogs(page + 1)}
          disabled={loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
