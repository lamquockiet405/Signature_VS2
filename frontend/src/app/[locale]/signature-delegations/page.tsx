"use client";

import React, { useState, useEffect, useCallback } from "react";
import { documentSignaturesAPI } from "@/lib/api";
import CreateSignatureDelegationModal from "@/components/ui/CreateSignatureDelegationModal";
import SignatureDelegationsList from "@/components/ui/SignatureDelegationsList";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/components/ToastProvider";

interface SignatureStats {
  total: number;
  pending: number;
  signed: number;
  rejected: number;
  cancelled: number;
}

interface SignatureDelegation {
  id: string;
  document_id: string;
  delegator_id: string;
  delegate_id: string;
  signature_type: string;
  status: string;
  signature_data?: Record<string, unknown>;
  signed_at?: string;
  expires_at?: string;
  reason: string;
  created_at: string;
  document_name: string;
  delegator_name: string;
  delegate_name: string;
  delegator_email: string;
  delegate_email: string;
}

export default function SignatureDelegationsPage() {
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
      // Backend returns stats directly, not wrapped in a stats property
      setStats({
        total: Number(response.total || 0),
        pending: Number(response.pending || 0),
        signed: Number(response.signed || 0),
        rejected: Number(response.rejected || 0),
        cancelled: Number(response.cancelled || 0),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Set default stats on error to prevent UI issues
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
      // Set default stats on error
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

  const handleCreateSuccess = () => {
    fetchData();
    setShowCreateModal(false);
  };

  const handleSign = async (delegation: SignatureDelegation) => {
    try {
      // In a real implementation, this would open a signature pad or file
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Signature Delegations
          </h1>
          <p className="text-gray-600 mt-1">
            Manage document signing delegations and permissions
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Create Delegation
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.total}</h3>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Pending</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.pending}</h3>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Signed</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.signed}</h3>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Rejected</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.rejected}</h3>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Cancelled</p>
          <h3 className="text-3xl font-bold text-gray-900">
            {stats.cancelled}
          </h3>
        </div>
      </div>

      {/* Signature Delegations List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Delegations List
          </h2>
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

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
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
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
