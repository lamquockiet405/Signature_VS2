"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import UploadModal from "@/components/UploadModal";
import CreateSignatureDelegationModal from "@/components/ui/CreateSignatureDelegationModal";
import { filesAPI } from "@/lib/api";

interface Document {
  id: string;
  name: string;
  type: string;
  signer: string;
  uploaded: string;
  status: string;
}

interface BackendFile {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  uploader_name: string;
  created_at: string;
  status: string;
}

interface DocumentStats {
  totalUploaded: number;
  totalCompleted: number;
  totalWaiting: number;
  totalRejected: number;
}

export default function DocumentsPage() {
  const t = useTranslations();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await filesAPI.getAll(1, 1000); // Tăng limit để hiển thị tất cả documents

      // Transform backend files data to match frontend Document interface
      const transformedDocs: Document[] = (data.files || []).map(
        (file: BackendFile) => ({
          id: file.id,
          name: file.original_name || file.filename,
          type:
            file.file_type ||
            (file.original_name?.toLowerCase().endsWith(".pdf")
              ? "PDF"
              : "DOC"),
          signer: file.uploader_name || "Unknown",
          uploaded: new Date(file.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          status: file.status || "waiting",
        })
      );

      setDocuments(transformedDocs);

      // Calculate stats from documents
      const stats: DocumentStats = {
        totalUploaded: transformedDocs.length,
        totalCompleted: transformedDocs.filter(
          (d) => d.status.toLowerCase() === "completed" || d.status.toLowerCase() === "signed"
        ).length,
        totalWaiting: transformedDocs.filter(
          (d) => d.status.toLowerCase() === "waiting" || d.status.toLowerCase() === "pending" || d.status.toLowerCase() === "pending_approval"
        ).length,
        totalRejected: transformedDocs.filter(
          (d) => d.status.toLowerCase() === "rejected"
        ).length,
      };
      setDocumentStats(stats);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "signed":
        return "text-green-700 bg-green-100 font-medium";
      case "waiting":
      case "pending":
        return "text-orange-700 bg-orange-100 font-medium";
      case "pending_approval":
        return "text-yellow-700 bg-yellow-100 font-medium";
      case "approved":
        return "text-blue-700 bg-blue-100 font-medium";
      case "rejected":
        return "text-red-700 bg-red-100 font-medium";
      case "active":
        return "text-teal-700 bg-teal-100 font-medium";
      default:
        return "text-gray-700 bg-gray-100 font-medium";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreateWorkflow = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsWorkflowModalOpen(true);
  };

  const handleWorkflowSuccess = () => {
    setIsWorkflowModalOpen(false);
    setSelectedDocumentId(undefined);
    // Optionally refresh data or show success message
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

  // Filter documents based on search
  const filteredDocuments = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.signer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex);

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
          {t("documents.title")}
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("documents.totalUploadedDocuments")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {documentStats?.totalUploaded || 0}
          </h3>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("documents.totalCompletedDocuments")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {documentStats?.totalCompleted || 0}
          </h3>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("documents.totalWaitingDocuments")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {documentStats?.totalWaiting || 0}
          </h3>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("documents.totalRejectedDocuments")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {documentStats?.totalRejected || 0}
          </h3>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("documents.documentsList")}
          </h2>
        </div>

        <div
          className="p-6 border border-gray-200 rounded-lg"
          style={{ margin: "20px" }}
        >
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
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

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder={t("documents.searchDocuments")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>{t("documents.last7Days")}</option>
                <option>{t("documents.last30Days")}</option>
                <option>{t("documents.last90Days")}</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                <Upload size={16} />
                {t("common.export")} CSV
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-left gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm ml-auto"
              >
                <Upload size={16} />
                {t("documents.uploadNewDocument")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("documents.documentName")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("documents.signer")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("documents.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentDocuments.map((doc, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/documents/${encodeURIComponent(doc.id)}`}
                          className="text-base font-semibold text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                        >
                          {doc.name}
                        </Link>
                        <div className="mt-1">
                          <span className="text-sm text-gray-700 bg-teal-100 px-2 py-0.5 rounded">
                            {doc.type} • {doc.uploaded}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 ${getAvatarColor(
                            index
                          )} rounded-full flex items-center justify-center`}
                        >
                          <span className="text-xs font-medium text-white">
                            {getInitials(doc.signer)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900">
                          {doc.signer}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          doc.status
                        )}`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleCreateWorkflow(doc.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Create workflow authorization"
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Create Workflow
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreHorizontal size={18} className="text-gray-400" />
                      </button>
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
              {Math.min(endIndex, filteredDocuments.length)} {t("common.of")}{" "}
              {filteredDocuments.length} {t("common.entries")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(totalPages)].map((_, i) => {
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

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={fetchData}
      />

      {/* Workflow Modal */}
      <CreateSignatureDelegationModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSuccess={handleWorkflowSuccess}
        documentId={selectedDocumentId}
      />
    </div>
  );
}
