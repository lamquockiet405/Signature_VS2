"use client";

import React, { useState, useEffect } from "react";
import { documentSignaturesAPI, digitalSignatureAPI, delegationsAPI } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Check, X, Download, Eye, Edit, Pen, MoreVertical, Trash2 } from "lucide-react";
import OTPModal from "./OTPModal";

interface SignatureDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  permissions?: string;
  reason: string;
  status: string;
  created_at: string;
  expired_at?: string;
  revoked_at?: string;
  // Fields from JOIN with users table
  delegator_username?: string;
  delegator_name?: string;
  delegate_username?: string;
  delegate_name?: string;
  metadata?: any;
  // Legacy fields for backward compatibility
  document_id?: string;
  document_name?: string;
  signature_type?: string;
  signature_data?: Record<string, unknown>;
  signed_at?: string;
  expires_at?: string;
  delegator_email?: string;
  delegate_email?: string;
}

interface SignatureDelegationsListProps {
  filters?: {
    status?: string;
    signature_type?: string;
    document_id?: string;
    delegate_id?: string;
    delegator_id?: string;
  };
  onSign?: (delegation: SignatureDelegation) => void;
  onReject?: (delegation: SignatureDelegation) => void;
  onCancel?: (delegation: SignatureDelegation) => void;
}

export default function SignatureDelegationsList({
  filters = {},
  onSign,
  onReject,
  onCancel,
}: SignatureDelegationsListProps) {
  const toast = useToast();
  const [delegations, setDelegations] = useState<SignatureDelegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Reject modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRejectDelegation, setSelectedRejectDelegation] =
    useState<SignatureDelegation | null>(null);

  // OTP modal states
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"sign" | "approve">("sign");
  const [selectedDelegation, setSelectedDelegation] = useState<SignatureDelegation | null>(null);

  // Detail modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDelegationDetail, setSelectedDelegationDetail] = useState<SignatureDelegation | null>(null);

  // Dropdown menu states
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null);
    };

    if (openDropdownId) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [openDropdownId]);

  // Get current user ID on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token =
          localStorage.getItem("access_token") || localStorage.getItem("token");
        if (!token) return;

        const response = await fetch("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const userId = data?.user?.id || data?.id;
          setCurrentUserId(userId);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchDelegations = async (page = 1) => {
    try {
      setLoading(true);
      const response = await documentSignaturesAPI.getAll(
        page,
        pagination.limit,
        filters
      );
      setDelegations(response.signatures || []);
      setPagination(response.pagination || pagination);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch signature delegations"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleDownload = async (documentId: string) => {
    try {
      const { blob, filename } = await digitalSignatureAPI.downloadSigned(
        documentId
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        `Failed to download: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleSignClick = (delegation: SignatureDelegation) => {
    // Check if delegation has expired
    const expiresDate = delegation.expires_at || delegation.expired_at;
    if (expiresDate && isExpired(expiresDate)) {
      toast.error(
        `This delegation has expired on ${formatDate(expiresDate)}. Cannot sign expired delegation.`
      );
      return;
    }

    // Check if this is a role-based delegation (not document-based)
    const isRoleDelegation = delegation.reason?.startsWith("Role:");

    if (isRoleDelegation) {
      toast.warning(
        "This is a role delegation, not a document signature. Role delegations grant permissions and cannot be signed like documents."
      );
      return;
    }

    // For document-based delegations, require document_id
    if (!delegation.document_id) {
      toast.warning(
        "This delegation is not linked to a document. Document ID is missing. Please contact the delegator to provide a document ID."
      );
      return;
    }

    // Open OTP modal for authentication
    setSelectedAction("sign");
    setSelectedDelegation(delegation);
    setShowOTPModal(true);
  };

  // Handle approve delegation (for approval workflow)
  const handleApprove = (delegation: SignatureDelegation) => {
    // Check if delegation has expired
    const expiresDate = delegation.expires_at || delegation.expired_at;
    if (expiresDate && isExpired(expiresDate)) {
      toast.error(
        `This delegation has expired on ${formatDate(expiresDate)}. Cannot approve expired delegation.`
      );
      return;
    }

    // Open OTP modal for authentication
    setSelectedAction("approve");
    setSelectedDelegation(delegation);
    setShowOTPModal(true);
  };

  // Handle OTP success - proceed with sign or approve
  const handleOTPSuccess = async (otpToken: string) => {
    if (!selectedDelegation) return;

    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        toast.error("Please login first");
        return;
      }

      if (selectedAction === "sign") {
        // Proceed with signing
        toast.info("Signing document...");

        const response = await fetch(
          `http://localhost:5000/api/document-signatures/${selectedDelegation.id}/sign`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "x-user-id": currentUserId || "",
            },
            body: JSON.stringify({
              documentId: selectedDelegation.document_id,
              userId: currentUserId,
              totpToken: otpToken, // Include TOTP token
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || err.error || "Failed to sign document");
        }

        if (selectedDelegation.status === "pending_approval") {
          toast.success("Signature attempt recorded. Waiting for delegator approval.");
        } else {
          toast.success("Document signed successfully!");
        }

        fetchDelegations(pagination.page);
        if (onSign) {
          onSign(selectedDelegation);
        }
      } else if (selectedAction === "approve") {
        // Proceed with approval
        toast.info("Approving delegation...");

        const response = await fetch(
          `http://localhost:5000/api/workflows/${selectedDelegation.id}/approve`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "x-user-id": currentUserId || "",
            },
            body: JSON.stringify({
              approver_id: currentUserId,
              totpToken: otpToken, // Include TOTP token
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to approve delegation");
        }

        toast.success("Delegation approved successfully! You can now sign it.");
        fetchDelegations(pagination.page);
      }
    } catch (error) {
      console.error(`${selectedAction} error:`, error);
      toast.error(
        `Failed to ${selectedAction}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setShowOTPModal(false);
      setSelectedDelegation(null);
    }
  };

  // Handle reject delegation (for approval workflow)
  // Open reject modal
  const handleRejectWorkflow = (delegation: SignatureDelegation) => {
    // Check if delegation has expired
    const expiresDate = delegation.expires_at || delegation.expired_at;
    if (expiresDate && isExpired(expiresDate)) {
      toast.error(
        `This delegation has expired on ${formatDate(expiresDate)}. Cannot reject expired delegation.`
      );
      return;
    }

    setSelectedRejectDelegation(delegation);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // Submit reject with reason
  const handleSubmitReject = async () => {
    if (!selectedRejectDelegation) return;

    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      // Get token from localStorage (consistent with the rest of the app)
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");

      if (!token) {
        toast.error("Please login first");
        window.location.href = "/login";
        return;
      }

      // Get current user info
      const userResponse = await fetch("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) {
        toast.error("Session expired. Please login again.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "/login";
        return;
      }

      const currentUser = await userResponse.json();

      // Handle different response structures
      const user = currentUser.user || currentUser.data || currentUser;
      const userId = user?.id || user?.userId;

      if (!userId) {
        toast.error("Cannot identify current user. Please login again.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "/login";
        return;
      }

      // Check if current user is the delegate or delegator
      const isDelegate = userId === selectedRejectDelegation.delegate_id;
      const isDelegator = userId === selectedRejectDelegation.delegator_id;
      
      if (!isDelegate && !isDelegator) {
        toast.error("Only the delegate or delegator can reject this delegation");
        return;
      }

      // Try new workflow reject endpoint first
      let response = await fetch(
        `http://localhost:5000/api/workflows/${selectedRejectDelegation.id}/reject`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({
            reason: rejectReason.trim(),
            comment: rejectReason.trim(),
          }),
        }
      );

      // If new endpoint fails, try legacy endpoint
      if (!response.ok) {
        response = await fetch(
          `http://localhost:5000/api/document-signatures/${selectedRejectDelegation.id}/reject`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({
              delegate_id: userId,
              reason: rejectReason.trim(),
            }),
          }
        );
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject delegation");
      }

      toast.success("Delegation rejected successfully");
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedRejectDelegation(null);
      fetchDelegations(pagination.page);
      
      if (onReject) {
        onReject(selectedRejectDelegation);
      }
    } catch (error) {
      console.error("Reject error:", error);
      toast.error(
        `Failed to reject: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Handle sign approved delegation
  const handleSignApproved = async (delegation: SignatureDelegation) => {
    try {
      // Get token from localStorage (consistent with the rest of the app)
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");

      if (!token) {
        toast.error("Please login first");
        window.location.href = "/login";
        return;
      }

      // Get current user info
      const userResponse = await fetch("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userResponse.ok) {
        toast.error("Session expired. Please login again.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "/login";
        return;
      }

      const currentUser = await userResponse.json();

      // Handle different response structures
      const user = currentUser.user || currentUser.data || currentUser;
      const userId = user?.id || user?.userId;

      if (!userId) {
        toast.error("Cannot identify current user. Please login again.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        window.location.href = "/login";
        return;
      }

      // Check if current user is the delegate
      if (userId !== delegation.delegate_id) {
        toast.error("Only the delegate can sign this delegation");
        return;
      }

      // Direct sign without confirmation dialog

      const response = await fetch(
        `http://localhost:5000/api/workflows/${delegation.id}/sign`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            delegate_id: userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sign delegation");
      }

      toast.success("Document signed successfully!");
      fetchDelegations(pagination.page);
      if (onSign) {
        onSign(delegation);
      }
    } catch (error) {
      console.error("Sign error:", error);
      toast.error(
        `Failed to sign: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: "bg-yellow-100 text-yellow-800",
      pending_approval: "bg-orange-100 text-orange-800",
      approved: "bg-blue-100 text-blue-800",
      signed: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
      expired: "bg-gray-100 text-gray-800",
    };

    const statusLabels = {
      pending: "Pending",
      pending_approval: "Pending Approval",
      approved: "Approved",
      signed: "Signed",
      rejected: "Rejected",
      cancelled: "Cancelled",
      expired: "Expired",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusClasses[status as keyof typeof statusClasses] ||
          "bg-gray-100 text-gray-800"
        }`}
      >
        {statusLabels[status as keyof typeof statusLabels] ||
          status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getSignatureTypeBadge = (type: string) => {
    const typeClasses = {
      delegation: "bg-blue-100 text-blue-800",
      approval: "bg-purple-100 text-purple-800",
      direct: "bg-green-100 text-green-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          typeClasses[type as keyof typeof typeClasses] ||
          "bg-gray-100 text-gray-800"
        }`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  // Handle view delegation details
  const handleViewDetail = async (delegationId: string) => {
    try {
      const response = await delegationsAPI.getById(delegationId);
      setSelectedDelegationDetail(response);
      setShowDetailModal(true);
      setOpenDropdownId(null);
    } catch (error) {
      console.error("Error fetching delegation details:", error);
      toast.error("Failed to load delegation details");
      setOpenDropdownId(null);
    }
  };

  // Handle delete delegation
  const handleDeleteDelegation = async (delegation: SignatureDelegation) => {
    if (!currentUserId) {
      toast.error("Please login first");
      setOpenDropdownId(null);
      return;
    }

    // Confirm before deleting
    if (!window.confirm(`Are you sure you want to delete this delegation? This action cannot be undone.`)) {
      setOpenDropdownId(null);
      return;
    }

    try {
      toast.info("Deleting delegation...");
      await delegationsAPI.revoke(delegation.id, currentUserId);
      toast.success("Delegation deleted successfully");
      setOpenDropdownId(null);
      fetchDelegations(pagination.page);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setOpenDropdownId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchDelegations(newPage);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchDelegations(pagination.page)}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[40%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="w-[20%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delegator
                </th>
                <th className="w-[20%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delegate
                </th>
                <th className="w-[20%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {delegations.map((delegation) => {
                const expiresDate = delegation.expires_at || delegation.expired_at;
                const isDelegationExpired = !!(expiresDate && isExpired(expiresDate));
                
                return (
                <tr key={delegation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {delegation.document_name || delegation.reason || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">ID: {delegation.id?.slice(0, 8) || "N/A"}...</div>
                      </div>

                      <div className="text-sm">
                        <span className="text-gray-500">
                          Created: {delegation.created_at ? formatDate(delegation.created_at) : "-"}
                        </span>
                        <span className="mx-2 text-gray-500">•</span>
                        <span className={isDelegationExpired ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          Expires:{' '}
                          {delegation.expires_at || delegation.expired_at
                            ? formatDate((delegation.expires_at || delegation.expired_at)!)
                            : 'Never'}
                        </span>
                        {isDelegationExpired && (
                          <span className="ml-2 text-xs text-red-500 font-medium">(Expired)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {getSignatureTypeBadge(delegation.signature_type || "standard")}
                        {getStatusBadge(delegation.status)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap align-middle">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-sm text-gray-900">
                        {delegation.delegator_name || "N/A"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {delegation.delegator_email || "N/A"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap align-middle">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-sm text-gray-900">
                        {delegation.delegate_name || "N/A"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {delegation.delegate_email || "N/A"}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap align-middle text-sm font-medium">
                    <div className="flex gap-2 justify-center items-center">
                      {/* APPROVAL WORKFLOW: Status = pending_approval */}
                      {/* Delegate must SIGN first (submit signature attempt) */}
                      {delegation.status === "pending_approval" && (
                        <>
                          {/* If delegate has NOT signed yet, show Sign & Reject buttons */}
                          {!delegation.metadata?.signatureDraft &&
                            currentUserId === delegation.delegate_id && (
                            <>
                              <button
                                onClick={() => handleSignClick(delegation)}
                                disabled={isDelegationExpired}
                                className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                                  isDelegationExpired
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                                }`}
                                title={isDelegationExpired ? "Delegation has expired" : "Sign this delegation"}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          )}


                          {/* If delegate has already signed, show waiting message */}
                          {delegation.metadata?.signatureDraft &&
                            currentUserId === delegation.delegate_id && (
                              <span className="inline-flex items-center px-3 py-1.5 text-xs text-orange-600 bg-orange-50 rounded font-medium">
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
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Waiting for Approval
                              </span>
                            )}

                          {/* If delegate has already attempted to sign, show Approve to the delegator */}
                          {delegation.metadata?.signatureDraft &&
                            currentUserId === delegation.delegator_id && (
                              <button
                                onClick={() => handleApprove(delegation)}
                                disabled={isDelegationExpired}
                                className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                                  isDelegationExpired
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                                }`}
                                title={isDelegationExpired ? "Delegation has expired" : "Approve and finalize signature"}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                        </>
                      )}

                      {/* APPROVAL WORKFLOW: Status = approved (ready to sign) */}
                      {/* Only show Sign button to the delegate */}
                      {delegation.status === "approved" &&
                        currentUserId === delegation.delegate_id && (
                          <button
                            onClick={() => handleSignApproved(delegation)}
                            disabled={isDelegationExpired}
                            className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                              isDelegationExpired
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                            title={isDelegationExpired ? "Delegation has expired" : "Sign this document"}
                          >
                            <Pen className="w-4 h-4" />
                          </button>
                        )}

                      {/* Sign & Reject buttons for pending/active delegations */}
                      {/* Hide Sign button for role-based delegations */}
                      {/* Only show Sign button to the delegate */}
                      {(delegation.status === "pending" || delegation.status === "active") &&
                        currentUserId === delegation.delegate_id && (
                          <>
                            {/* Only show Sign button for document-based delegations */}
                            {!delegation.reason?.startsWith("Role:") &&
                              delegation.document_id && (
                                <button
                                  onClick={() => handleSignClick(delegation)}
                                  disabled={isDelegationExpired}
                                  className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                                    isDelegationExpired
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                                  }`}
                                  title={isDelegationExpired ? "Delegation has expired" : "Sign this document"}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}


                            {/* Show info badge for role delegations */}
                            {delegation.reason?.startsWith("Role:") && (
                              <span className="inline-flex items-center px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded font-medium">
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
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Role Permission
                              </span>
                            )}

                            {onReject && (
                              <button
                                onClick={() => onReject(delegation)}
                                disabled={isDelegationExpired}
                                className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                                  isDelegationExpired
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                                }`}
                                title={isDelegationExpired ? "Delegation has expired" : "Reject this delegation"}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            {onCancel && (
                              <button
                                onClick={() => onCancel(delegation)}
                                disabled={isDelegationExpired}
                                className={`inline-flex items-center justify-center p-2 border rounded transition-colors ${
                                  isDelegationExpired
                                    ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
                                }`}
                                title={isDelegationExpired ? "Delegation has expired" : "Cancel this delegation"}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}

                      {/* Reject button for both Delegate and Delegator */}
                      {/* Show reject button for delegate in pending_approval, pending, active states */}
                      {/* Show reject button for delegator in pending, active, pending_approval states */}
                      {((currentUserId === delegation.delegate_id && 
                         (delegation.status === "pending_approval" || 
                          delegation.status === "pending" || 
                          delegation.status === "active")) ||
                        (currentUserId === delegation.delegator_id && 
                         (delegation.status === "pending" || 
                          delegation.status === "active" || 
                          delegation.status === "pending_approval"))) && (
                        <button
                          onClick={() => handleRejectWorkflow(delegation)}
                          disabled={isDelegationExpired}
                          className={`inline-flex items-center justify-center p-2 border border-transparent rounded text-white transition-colors ${
                            isDelegationExpired
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                          }`}
                          title={isDelegationExpired ? "Delegation has expired" : "Reject this delegation"}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      {/* Download button for signed delegations */}
                      {delegation.status === "signed" &&
                        delegation.document_id && (
                          <button
                            onClick={() =>
                              handleDownload(delegation.document_id as string)
                            }
                            className="inline-flex items-center justify-center p-2 border border-transparent rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            title="Download signed document"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

                      {/* Dropdown menu for actions */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(delegation.id === openDropdownId ? null : delegation.id);
                          }}
                          className="inline-flex items-center justify-center p-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openDropdownId === delegation.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetail(delegation.id);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Detail
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDelegation(delegation);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Delegation
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Revoked/Rejected status info */}
                      {(delegation.status === "revoked" ||
                        delegation.status?.toLowerCase() === "revoked") && (
                        <span className="inline-flex items-center px-3 py-1.5 text-xs text-gray-500 italic">
                          No actions available
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {delegations.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No signature delegations
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                No signature delegations found matching your criteria.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRejectDelegation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Reject Delegation
                </h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
                    setSelectedRejectDelegation(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Document:{" "}
                  <span className="font-medium text-gray-900">
                    {selectedRejectDelegation.document_name ||
                      selectedRejectDelegation.reason ||
                      "N/A"}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Delegator:{" "}
                  <span className="font-medium text-gray-900">
                    {selectedRejectDelegation.delegator_name || "N/A"}
                  </span>
                </p>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="rejectReason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Reason for rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a detailed reason for rejecting this delegation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  rows={4}
                  autoFocus
                />
                {!rejectReason.trim() && (
                  <p className="mt-1 text-xs text-gray-500">
                    Rejection reason is required
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
                    setSelectedRejectDelegation(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReject}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject Delegation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      <OTPModal
        isOpen={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setSelectedDelegation(null);
        }}
        onSuccess={handleOTPSuccess}
        action={selectedAction}
      />

      {/* Detail Modal */}
      {showDetailModal && selectedDelegationDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Delegation Details
                </h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedDelegationDetail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="border-b pb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Delegation ID</p>
                      <p className="text-sm font-medium text-gray-900">{selectedDelegationDetail.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="mt-1">
                        {getStatusBadge(selectedDelegationDetail.status)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delegator Info */}
                <div className="border-b pb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Delegator (From)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.delegator_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.delegator_email || selectedDelegationDetail.delegator_username || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delegate Info */}
                <div className="border-b pb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Delegate (To)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.delegate_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.delegate_email || selectedDelegationDetail.delegate_username || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Document Info */}
                {selectedDelegationDetail.document_id && (
                  <div className="border-b pb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Document</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Document Name</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedDelegationDetail.document_name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Document ID</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedDelegationDetail.document_id}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason */}
                {selectedDelegationDetail.reason && (
                  <div className="border-b pb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Reason</h4>
                    <p className="text-sm text-gray-700">
                      {selectedDelegationDetail.reason}
                    </p>
                  </div>
                )}

                {/* Permissions */}
                {selectedDelegationDetail.permissions && (
                  <div className="border-b pb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Permissions</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {typeof selectedDelegationDetail.permissions === 'string' 
                          ? selectedDelegationDetail.permissions 
                          : JSON.stringify(selectedDelegationDetail.permissions, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="border-b pb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Timeline</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.created_at ? formatDate(selectedDelegationDetail.created_at) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expires At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedDelegationDetail.expires_at || selectedDelegationDetail.expired_at
                          ? formatDate((selectedDelegationDetail.expires_at || selectedDelegationDetail.expired_at)!)
                          : "Never"}
                      </p>
                    </div>
                    {selectedDelegationDetail.signed_at && (
                      <div>
                        <p className="text-sm text-gray-500">Signed At</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(selectedDelegationDetail.signed_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                {selectedDelegationDetail.metadata && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Information</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {typeof selectedDelegationDetail.metadata === 'string' 
                          ? selectedDelegationDetail.metadata 
                          : JSON.stringify(selectedDelegationDetail.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedDelegationDetail(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
