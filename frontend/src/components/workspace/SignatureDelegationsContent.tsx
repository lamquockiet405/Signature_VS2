"use client";

import React, { useState, useEffect, useCallback } from "react";
import { documentSignaturesAPI } from "@/lib/api";
import CreateSignatureDelegationModal from "@/components/ui/CreateSignatureDelegationModal";
import SignatureDelegationsList from "@/components/ui/SignatureDelegationsList";
import SplitButton from "@/components/ui/SplitButton";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/components/ToastProvider";
import { RefreshCw, Upload, UserPlus, FileText, Users } from "lucide-react";

interface SignatureDelegationsContentProps {
  showCreateModal?: boolean;
  onCloseModal?: () => void;
  onViewChange?: (view: "documents" | "delegations") => void;
}

interface SignatureStats {
  total: number;
  pending: number;
  signed: number;
  rejected: number;
  cancelled: number;
}

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

export default function SignatureDelegationsContent({
  showCreateModal: externalShowCreateModal = false,
  onCloseModal: externalOnCloseModal,
  onViewChange,
}: SignatureDelegationsContentProps) {
  const toast = useToast();
  const { user } = usePermissions();
  const isAdmin = user?.role_name?.toLowerCase().includes("admin") || false;

  const [stats, setStats] = useState<SignatureStats>({
    total: 0,
    pending: 0,
    signed: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    signature_type: "",
  });
  const [period, setPeriod] = useState("week");

  const fetchStats = useCallback(async () => {
    try {
      const response = await documentSignaturesAPI.getStats(period);
      setStats({
        total: Number(response.total || 0),
        pending: Number(response.pending || 0),
        signed: Number(response.signed || 0),
        rejected: Number(response.rejected || 0),
        cancelled: Number(response.cancelled || 0),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats({
        total: 0,
        pending: 0,
        signed: 0,
        rejected: 0,
        cancelled: 0,
      });
    }
  }, [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchStats();
    } catch (error) {
      console.error("Error fetching data:", error);
      setStats({
        total: 0,
        pending: 0,
        signed: 0,
        rejected: 0,
        cancelled: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync modal with external prop
  useEffect(() => {
    if (externalShowCreateModal !== showCreateModal) {
      setShowCreateModal(externalShowCreateModal);
    }
  }, [externalShowCreateModal]);

  const handleCreateSuccess = () => {
    fetchData();
    setShowCreateModal(false);
    externalOnCloseModal?.();
  };

  const handleSign = async (delegation: SignatureDelegation) => {
    try {
      const signatureData = {
        signature: "Digital signature data",
        timestamp: new Date().toISOString(),
        coordinates: { x: 100, y: 100, width: 200, height: 50 },
        userId: delegation.delegate_id,
      };

      await documentSignaturesAPI.sign(delegation.id, signatureData);
      fetchData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error signing document: ${errorMessage}`);
    }
  };

  const handleReject = async (delegation: SignatureDelegation) => {
    // Direct reject without prompt
    const reason = "Rejected by user";
    try {
      await documentSignaturesAPI.reject(delegation.id, reason);
      fetchData();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error rejecting signature: ${errorMessage}`);
    }
  };

  const handleCancel = async (delegation: SignatureDelegation) => {
    if (confirm("Are you sure you want to cancel this signature delegation?")) {
      try {
        await documentSignaturesAPI.cancel(delegation.id);
        fetchData();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error(`Error cancelling delegation: ${errorMessage}`);
      }
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      signature_type: "",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Signature Delegations List */}
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
            defaultOption="delegations"
            variant="outline"
            size="md"
          />
        </div>

        <div
          className="p-6 border border-gray-200 rounded-lg"
          style={{ margin: "20px" }}
        >
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="year">Last year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="signed">Signed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filters.signature_type}
                onChange={(e) =>
                  handleFilterChange("signature_type", e.target.value)
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="delegation">Delegation</option>
                <option value="approval">Approval</option>
                <option value="direct">Direct</option>
              </select>
            </div>

            <div className="flex items-end gap-3 ml-auto">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>

              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                title="Refresh data"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                title="Export to CSV"
              >
                <Upload size={16} />
                Export CSV
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Create new delegation"
                >
                  <UserPlus size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Delegations Table */}
          <SignatureDelegationsList
            filters={filters}
            onSign={handleSign}
            onReject={handleReject}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Create Modal - Only for Admin */}
      {isAdmin && (
        <CreateSignatureDelegationModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            externalOnCloseModal?.();
          }}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
