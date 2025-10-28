"use client";

import React, { useState, useEffect } from "react";
import { FileText, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import SignatureDelegationsContent from "@/components/workspace/SignatureDelegationsContent";
import DocumentsContent from "@/components/workspace/DocumentsContent";
import { filesAPI, documentSignaturesAPI } from "@/lib/api";

type ViewMode = "documents" | "delegations";

interface WorkspaceStats {
  totalUploaded: number;
  totalCompleted: number;
  totalWaiting: number;
  totalRejected: number;
}

export default function WorkspacePage() {
  const t = useTranslations();
  const [viewMode, setViewMode] = useState<ViewMode>("documents");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<WorkspaceStats>({
    totalUploaded: 0,
    totalCompleted: 0,
    totalWaiting: 0,
    totalRejected: 0,
  });

  const fetchStats = async () => {
    try {
      // 1. Lấy total uploaded từ Files API
      const filesData = await filesAPI.getAll(1, 1000);
      const files = filesData.files || [];
      
      // 2. Lấy delegations data cho Completed/Waiting/Rejected
      const delegationsData = await documentSignaturesAPI.getAll(1, 1000);
      console.log("🔍 RAW Delegations Response:", delegationsData);
      console.log("🔍 Delegations Data Keys:", Object.keys(delegationsData || {}));
      
      // Backend trả về key "signatures" không phải "delegations"
      const delegations = delegationsData.signatures || delegationsData.delegations || delegationsData.data || [];

      // DEBUG: Log để kiểm tra
      console.log("📊 Total files uploaded:", files.length);
      console.log("📊 Total delegations:", delegations.length);
      
      if (delegations.length > 0) {
        console.log("📊 First delegation sample:", delegations[0]);
        console.log("📊 Delegation statuses:", delegations.map((d: any) => d.status));
        
        // Đếm từng loại status của delegations
        const statusCount: { [key: string]: number } = {};
        delegations.forEach((d: any) => {
          const status = d.status?.toLowerCase() || "unknown";
          statusCount[status] = (statusCount[status] || 0) + 1;
        });
        console.log("📊 Delegation status count:", statusCount);
      } else {
        console.warn("⚠️ No delegations found!");
      }

      const calculatedStats: WorkspaceStats = {
        // Total Uploaded = tổng số file đã upload
        totalUploaded: files.length,
        
        // Total Completed = các delegation đã ký (signed, completed)
        totalCompleted: delegations.filter(
          (d: any) => ["signed", "completed"].includes(d.status?.toLowerCase())
        ).length,
        
        // Total Waiting = các delegation đang đợi approval
        totalWaiting: delegations.filter(
          (d: any) => ["pending_approval", "waiting", "pending", "active", "approved"].includes(d.status?.toLowerCase())
        ).length,
        
        // Total Rejected = các delegation bị từ chối
        totalRejected: delegations.filter(
          (d: any) => ["rejected", "cancelled"].includes(d.status?.toLowerCase())
        ).length,
      };
      
      console.log("📊 Calculated stats:", calculatedStats);
      setStats(calculatedStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [viewMode]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workspace</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your documents and signature delegations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards - Shared between both views */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {t("documents.totalUploadedDocuments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.totalUploaded}
            </h3>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {t("documents.totalCompletedDocuments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.totalCompleted}
            </h3>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {t("documents.totalWaitingDocuments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.totalWaiting}
            </h3>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {t("documents.totalRejectedDocuments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.totalRejected}
            </h3>
          </div>
        </div>

        {/* Documents View */}
        {viewMode === "documents" && (
          <DocumentsContent
            showCreateModal={showCreateModal}
            onCloseModal={() => setShowCreateModal(false)}
            onViewChange={setViewMode}
          />
        )}

        {/* Delegations View */}
        {viewMode === "delegations" && (
          <SignatureDelegationsContent
            showCreateModal={showCreateModal}
            onCloseModal={() => setShowCreateModal(false)}
            onViewChange={setViewMode}
          />
        )}
      </div>
    </div>
  );
}
