"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
} from "lucide-react";
import { logsAPI } from "@/lib/api";

interface HistoryItem {
  dateTime: string;
  user: string;
  avatar: string;
  action: string;
  documentName: string;
  status: string;
}

interface BackendLog {
  id: string;
  user_name?: string;
  username?: string;
  full_name?: string;
  email?: string;
  action: string;
  details: string;
  created_at: string;
}

export default function HistoryPage() {
  const t = useTranslations();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(
    null
  );

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await logsAPI.getAll();

        // Transform logs data to history format
        const historyData: HistoryItem[] = (data.logs || []).map(
          (log: BackendLog) => {
            // Extract text after colon (:) if exists, otherwise use full details
            const details = log.details || "N/A";
            const documentName = details.includes(":")
              ? details.split(":").slice(1).join(":").trim()
              : details;

            // Format date and time
            const date = new Date(log.created_at);
            const formattedDateTime = `${date
              .getDate()
              .toString()
              .padStart(2, "0")}/${(date.getMonth() + 1)
              .toString()
              .padStart(2, "0")}/${date.getFullYear()} ${date
              .getHours()
              .toString()
              .padStart(2, "0")}:${date
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;

            return {
              dateTime: formattedDateTime,
              user: log.full_name || log.username || log.email || "Unknown",
              avatar: (log.full_name || log.username || "UK")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2),
              action: log.action,
              documentName: documentName,
              status: "completed", // Default status for logs
            };
          }
        );

        setHistory(historyData);
      } catch (error) {
        console.error("Error fetching history:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "text-green-700 bg-green-100 font-medium";
      case "waiting":
        return "text-orange-700 bg-orange-100 font-medium";
      case "rejected":
        return "text-red-700 bg-red-100 font-medium";
      case "active":
        return "text-teal-700 bg-teal-100 font-medium";
      default:
        return "text-gray-700 bg-gray-100 font-medium";
    }
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    return colors[index % colors.length];
  };

  // Filter history based on search
  const filteredHistory = history.filter(
    (item) =>
      item.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.documentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentHistory = filteredHistory.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("history.title")}
        </h1>
      </div>

      {/* History List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("history.historyList")}
          </h2>
        </div>

        <div
          className="p-6 border border-gray-200 rounded-lg"
          style={{ margin: "20px" }}
        >
          {/* Controls */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{t("common.show")}</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-600">
                {t("common.entries")}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder={t("history.searchLogs")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>{t("history.allType")}</option>
                <option>{t("history.upload")}</option>
                <option>{t("history.sign")}</option>
                <option>{t("verify.title")}</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>{t("history.allUser")}</option>
                <option>Lindsey Curtis</option>
                <option>Kaiya George</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>{t("history.allStatus")}</option>
                <option>{t("dashboard.completed")}</option>
                <option>{t("dashboard.pending")}</option>
                <option>{t("documents.rejected")}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("history.documentName")}
                    <span className="ml-1">↕</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("history.action")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.status")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentHistory.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-gray-900 mb-1">
                          {item.documentName}
                        </span>
                        <div className="inline-flex items-center gap-2 bg-teal-100 px-2 py-0.5 rounded w-fit">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 ${getAvatarColor(
                                index
                              )} rounded-full flex items-center justify-center flex-shrink-0`}
                            >
                              <span className="text-white text-xs font-medium">
                                {item.avatar}
                              </span>
                            </div>
                            <span className="text-sm text-gray-700">
                              {item.user}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700">•</span>
                          <span className="text-sm text-gray-700">
                            {item.dateTime}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setSelectedHistory(item)}
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          title="View details"
                        >
                          <Eye
                            size={18}
                            className="text-gray-400 hover:text-gray-600"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">
              {t("common.show")} {startIndex + 1} {t("common.to")}{" "}
              {Math.min(endIndex, filteredHistory.length)} {t("common.of")}{" "}
              {filteredHistory.length} {t("common.entries")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(Math.min(totalPages, 10))].map((_, i) => {
                const page = i + 1;
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return (
                    <span key={page} className="px-2">
                      ...
                    </span>
                  );
                }
                return null;
              })}
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Details Modal */}
      {selectedHistory && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => setSelectedHistory(null)}
        >
          <div
            className="bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("history.historyDetails")}
              </h2>
              <button
                onClick={() => setSelectedHistory(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Row 1: Date/Time & User */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("history.dateTime")}
                  </label>
                  <div className="text-sm text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    {selectedHistory.dateTime}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("history.user")}
                  </label>
                  <div className="text-sm text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    {selectedHistory.user}
                  </div>
                </div>
              </div>

              {/* Row 2: Action & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("history.action")}
                  </label>
                  <div className="text-sm text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    {selectedHistory.action}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("documents.status")}
                  </label>
                  <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        selectedHistory.status
                      )}`}
                    >
                      {selectedHistory.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Document Name & Document File */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("history.documentName")}
                  </label>
                  <div className="text-sm text-gray-900 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    Audit Reports
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    {t("history.documentFile")}
                  </label>
                  <div className="flex items-center justify-between bg-white border border-gray-200 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-900">
                      {selectedHistory.documentName}
                    </span>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <Download size={16} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Description - Full Width */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  {t("history.actionDescription")}
                </label>
                <div className="text-sm text-gray-600 bg-white border border-gray-200 px-3 py-3 rounded-lg leading-relaxed">
                  Document {selectedHistory.documentName} was signed by{" "}
                  {selectedHistory.user} using digital certificate #12405-245A
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
