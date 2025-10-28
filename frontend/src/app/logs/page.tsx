import React from "react";
import LogsTable from "../../components/LogsTable";

export default function LogsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">System Logs</h1>
      <LogsTable />
    </div>
  );
}
