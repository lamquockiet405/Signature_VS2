"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  X,
  FileDown,
  UserCheck,
  FileText,
  Users,
  PenTool,
  Download,
} from "lucide-react";
import Link from "next/link";
import UploadModal from "@/components/UploadModal";
import CreateSignatureDelegationModal from "@/components/ui/CreateSignatureDelegationModal";
import SplitButton from "@/components/ui/SplitButton";
import TOTPModal from "@/components/ui/TOTPModal";
import { filesAPI, getCurrentUserId, hsmFileSigningAPI } from "@/lib/api";

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

interface DocumentsContentProps {
  showCreateModal?: boolean;
  onCloseModal?: () => void;
  onViewChange?: (view: "documents" | "delegations") => void;
}

export default function DocumentsContent({
  showCreateModal: externalShowCreateModal = false,
  onCloseModal: externalOnCloseModal,
  onViewChange,
}: DocumentsContentProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    type: "",
    status: "",
  });
  const [isTOTPModalOpen, setIsTOTPModalOpen] = useState(false);
  const [documentToSign, setDocumentToSign] = useState<Document | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await filesAPI.getAll(1, 1000);

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

  // Sync upload modal with external prop
  useEffect(() => {
    if (externalShowCreateModal !== isUploadModalOpen) {
      setIsUploadModalOpen(externalShowCreateModal);
    }
  }, [externalShowCreateModal]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };
    
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownId]);

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
    fetchData(); // Refresh data after workflow creation
  };

  const handleViewDocument = (doc: Document) => {
    setOpenDropdownId(null);
    // Navigate to document details page with locale
    router.push(`/${locale}/documents/${doc.id}`);
  };

  const handleEditDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setEditFormData({
      name: doc.name,
      type: doc.type,
      status: doc.status,
    });
    setIsEditModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleDeleteDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setIsDeleteModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSignDocument = (doc: Document) => {
    setDocumentToSign(doc);
    setIsTOTPModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        alert("User not logged in");
        return;
      }

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      
      // Call download API - use correct endpoint
      const response = await fetch(`http://localhost:5000/api/documents/${doc.id}/download`, {
        method: "GET",
        headers: {
          "x-user-id": userId,
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      // Get filename from response headers or use document name
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : doc.name;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log("✅ Document downloaded successfully");
      
    } catch (error) {
      console.error("❌ Download error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download document";
      alert(`❌ Download failed: ${errorMessage}`);
    }
  };

  const handleTOTPSuccess = async (totpToken: string) => {
    if (!documentToSign) return;

    try {
      setIsSigning(true);
      
      // Get current user info
      const userId = getCurrentUserId();
      if (!userId) {
        alert("User not logged in");
        return;
      }

      console.log("🔐 Starting direct document signing with TOTP verification...");
      console.log("📄 Document ID:", documentToSign.id);
      console.log("👤 User ID:", userId);
      console.log("🔑 TOTP Token:", totpToken ? "Provided" : "Not provided");

      // Validate TOTP token format (6 digits)
      if (!/^\d{6}$/.test(totpToken)) {
        throw new Error("TOTP token must be 6 digits");
      }

      // Call direct signing API
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/documents/${documentToSign.id}/sign-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          totpToken: totpToken,
          metadata: {
            name: "Direct Signer",
            reason: "Direct document signing",
            location: "Unknown",
            contact: "Unknown",
            organizationUnit: "Unknown",
            organizationName: "Unknown",
            userAgent: navigator.userAgent,
            securityLevel: 'high',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to sign document");
      }

      const signResult = await response.json();
      console.log("✅ Document signed successfully:", signResult);
      
      // Show success message
      alert("✅ Document signed successfully!\n\nFile has been digitally signed with TOTP verification via direct signing.");
      
      // Refresh data
      fetchData();
      
    } catch (error) {
      console.error("❌ Direct signing error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sign document";
      alert(`❌ Direct signing failed: ${errorMessage}`);
    } finally {
      setIsSigning(false);
      setIsTOTPModalOpen(false);
      setDocumentToSign(null);
    }
  };



  const handleSaveEdit = async () => {
    if (selectedDocument) {
      try {
        const userId = getCurrentUserId();
        if (!userId) {
          alert("User not logged in");
          return;
        }

        console.log("Updating document:", {
          id: selectedDocument.id,
          data: {
            original_name: editFormData.name,
            status: editFormData.status,
          },
          userId,
        });

        // Update document via API
        const result = await filesAPI.update(selectedDocument.id, {
          original_name: editFormData.name,
          status: editFormData.status,
        }, userId);

        console.log("Update result:", result);

        setIsEditModalOpen(false);
        setSelectedDocument(null);
        fetchData(); // Refresh data after update
        alert("Document updated successfully");
      } catch (error) {
        console.error("Error updating document:", error);
        if (error instanceof Error) {
          alert(`Failed to update document: ${error.message}`);
        } else {
          alert("Failed to update document");
        }
      }
    }
  };

  const confirmDelete = async () => {
    if (selectedDocument) {
      try {
        const userId = getCurrentUserId();
        if (!userId) {
          alert("User not logged in");
          return;
        }

        console.log("Deleting document:", {
          id: selectedDocument.id,
          userId,
        });

        const result = await filesAPI.delete(selectedDocument.id, userId);
        console.log("Delete result:", result);

        setIsDeleteModalOpen(false);
        setSelectedDocument(null);
        fetchData(); // Refresh data after deletion
        alert("Document deleted successfully");
      } catch (error) {
        console.error("Error deleting document:", error);
        if (error instanceof Error) {
          alert(`Failed to delete document: ${error.message}`);
        } else {
          alert("Failed to delete document");
        }
      }
    }
  };

  const toggleDropdown = (docId: string) => {
    setOpenDropdownId(openDropdownId === docId ? null : docId);
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
    <div>
      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <SplitButton
            options={[
              {
                id: "documents",
                label: "Documents",
                icon: <FileText className="w-4 h-4" />,
                onClick: () => onViewChange && onViewChange("documents"),
              },
              {
                id: "delegations",
                label: "Delegations",
                icon: <Users className="w-4 h-4" />,
                onClick: () => onViewChange && onViewChange("delegations"),
              },
            ]}
            defaultOption="documents"
            variant="outline"
            size="md"
          />
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
              <button 
                className="inline-flex items-center justify-center p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title={`${t("common.export")} CSV`}
              >
                <FileDown size={20} />
              </button>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center justify-center p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title={t("documents.uploadNewDocument")}
              >
                <Upload size={20} />
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
                    Actions
                  </th>
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
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-gray-700 bg-teal-100 px-2 py-0.5 rounded">
                            {doc.type} • {doc.uploaded}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              doc.status
                            )}`}
                          >
                            {doc.status}
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
                    <td className="px-4 py-4 relative">
                      <div className="flex items-center gap-1">
                        {/* Show download button if document is signed, otherwise show sign button */}
                        {doc.status.toLowerCase() === 'signed' || doc.status.toLowerCase() === 'completed' ? (
                          <button
                            onClick={() => handleDownloadDocument(doc)}
                            className="inline-flex items-center justify-center p-2 border border-transparent rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            title="Tải xuống tài liệu đã ký"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSignDocument(doc)}
                            disabled={isSigning}
                            className="inline-flex items-center justify-center p-2 border border-transparent rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Ký tài liệu trực tiếp với xác thực TOTP (không cần delegation)"
                          >
                            <PenTool className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleCreateWorkflow(doc.id)}
                          className="inline-flex items-center justify-center p-2 border border-transparent rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          title="Create workflow authorization"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(doc.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <MoreHorizontal size={18} className="text-gray-400" />
                        </button>
                      </div>
                      
                      {/* Dropdown Menu */}
                      {openDropdownId === doc.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <button
                            onClick={() => handleViewDocument(doc)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Eye size={16} className="text-blue-500" />
                            <span>View Details</span>
                          </button>
                          <button
                            onClick={() => handleEditDocument(doc)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                          >
                            <Edit size={16} className="text-green-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100 rounded-b-lg"
                          >
                            <Trash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
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
        onClose={() => {
          setIsUploadModalOpen(false);
          externalOnCloseModal?.();
        }}
        onUploadSuccess={fetchData}
      />

      {/* Workflow Modal */}
      <CreateSignatureDelegationModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSuccess={handleWorkflowSuccess}
        documentId={selectedDocumentId}
      />

      {/* TOTP Modal for Enhanced Security Signing */}
      <TOTPModal
        isOpen={isTOTPModalOpen}
        onClose={() => {
          setIsTOTPModalOpen(false);
          setDocumentToSign(null);
        }}
        onSuccess={handleTOTPSuccess}
        action="sign"
        title="Xác thực ký tài liệu với 2FA"
        description="Nhập mã 6 chữ số từ Google Authenticator để ký tài liệu an toàn"
      />


      {/* Edit Document Modal */}
      {isEditModalOpen && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Document
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={editFormData.type}
                  onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PDF">PDF</option>
                  <option value="DOC">DOC</option>
                  <option value="DOCX">DOCX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="signed">Signed</option>
                  <option value="waiting">Waiting</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Delete Document
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete <span className="font-semibold">"{selectedDocument.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
