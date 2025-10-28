"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useTranslations } from "next-intl";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Shield,
  Clock,
} from "lucide-react";
import { permissionsAPI } from "@/lib/api";

interface Permission {
  id: string;
  role_name: string;
  description: string;
  permissions: string[];
  permissions_count: number;
  status: string; // "active" or "inactive"
  created_at: string;
  updated_at: string;
}

export default function PermissionsPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<string | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch permissions
      // Default to showing only active permissions to hide revoked ones.
      // If the UI filter is set to something else, callers will change filterStatus
      const apiFilters: any = {};
      if (filterStatus !== "All") {
        apiFilters.status = filterStatus.toLowerCase();
      }

      const permissionsData = await permissionsAPI.getAll(1, 100, apiFilters);

      // Normalize permissions data from roles table
      const normalizedPermissions = (permissionsData.permissions || []).map(
        (permission: Record<string, unknown>) => {
          return {
            id: permission.id as string,
            role_name: (permission.role_name as string) || "Unnamed Role",
            description:
              (permission.description as string) ||
              "Custom permission role with specific access rights",
            permissions: Array.isArray(permission.permissions)
              ? permission.permissions
              : [],
            permissions_count: (permission.permissions_count as number) || 0,
            status: (permission.status as string) || "active",
            created_at:
              (permission.created_at as string) || new Date().toISOString(),
            updated_at:
              (permission.updated_at as string) ||
              (permission.created_at as string) ||
              new Date().toISOString(),
          };
        }
      );

      setPermissions(normalizedPermissions);
    } catch (error) {
      console.error("Error fetching data:", error);
      setPermissions([]);
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Re-fetch delegations when component mounts and when filterStatus changes
  useEffect(() => {
    fetchData();
  }, [fetchData, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "published":
        return "text-green-600 bg-green-50";
      case "expired":
        return "text-red-600 bg-red-50";
      case "pending":
        return "text-orange-600 bg-orange-50";
      case "draft":
        return "text-yellow-600 bg-yellow-50";
      case "completed":
        return "text-green-600 bg-green-50";
      case "revoked":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  const handleDelete = async () => {
    if (!permissionToDelete) return;

    try {
      setDeleting(true);

      // Delete role (permission) from roles table
      // Note: revoke method uses DELETE request, which is what we need for roles
      await permissionsAPI.revoke(permissionToDelete, "system");

      // Optimistically remove the deleted role from UI
      setPermissions((prev) => prev.filter((p) => p.id !== permissionToDelete));

      // Refresh data to ensure UI is in sync with server
      await fetchData();
      setShowDeleteModal(false);
      setPermissionToDelete(null);
      toast.success("Role deleted successfully!");
    } catch (error) {
      console.error("Error deleting role:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete role";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  // Filter permissions (roles)
  const filteredPermissions = permissions.filter((permission) => {
    const matchesSearch =
      permission.role_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permission.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterStatus === "All" || permission.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPermissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPermissions = filteredPermissions.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">{t("permissions.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("permissions.title")}
        </h1>
      </div>

      {/* Permission List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("permissions.permissionsList")}
          </h2>

          {/* Controls inline with title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => router.push("/permissions/add")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus size={16} />
              Add New
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role Information
                    <span className="ml-1">↕</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentPermissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      No permissions found
                    </td>
                  </tr>
                ) : (
                  currentPermissions.map((permission) => {
                    const formattedDate = new Date(
                      permission.updated_at || permission.created_at
                    ).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });

                    return (
                      <tr key={permission.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-2">
                            <span className="text-base font-semibold text-gray-900">
                              {permission.role_name}
                            </span>
                            <div className="inline-flex items-center bg-teal-100 px-2 py-0.5 rounded w-fit">
                              <span className="text-sm text-gray-700">
                                {permission.description}
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-teal-100 px-2 py-0.5 rounded w-fit">
                              <span className="text-xs text-gray-700">
                                Cập nhật: {formattedDate}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                              permission.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                permission.status === "active"
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                              }`}
                            ></span>
                            {permission.status === "active"
                              ? "Hoạt động"
                              : "Tạm ngưng"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setPermissionToDelete(permission.id);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 hover:bg-gray-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2
                                size={18}
                                className="text-gray-400 hover:text-gray-600"
                              />
                            </button>
                            <button
                              onClick={() => setSelectedPermission(permission)}
                              className="p-2 hover:bg-gray-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit
                                size={18}
                                className="text-gray-400 hover:text-gray-600"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredPermissions.length)} of{" "}
              {filteredPermissions.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {[1, 2, 3, "...", 8, 9, 10].map((page, index) => {
                if (page === "...") {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-gray-400"
                    >
                      ...
                    </span>
                  );
                }
                const pageNum = page as number;
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Role
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this role? All associated
              permissions will be removed. If any users are assigned this role,
              the deletion will fail.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Details Modal */}
      {selectedPermission && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPermission(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                Role Details
              </h2>
              <button
                onClick={() => setSelectedPermission(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Role Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Shield size={16} />
                  Role Name
                </label>
                <div className="text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                  {selectedPermission.role_name}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <User size={16} />
                  Description
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                  {selectedPermission.description}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Clock size={16} />
                  Status
                </label>
                <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                      selectedPermission.status
                    )}`}
                  >
                    {selectedPermission.status}
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Shield size={16} />
                  Granted Permissions
                </label>
                <div className="bg-gray-50 border border-gray-200 px-3 py-3 rounded-lg">
                  {selectedPermission.permissions &&
                  selectedPermission.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPermission.permissions.map((perm, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No permissions granted
                    </p>
                  )}
                </div>
              </div>

              {/* Created Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Clock size={16} />
                  Created On
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                  {new Date(selectedPermission.created_at).toLocaleString(
                    "en-GB"
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setSelectedPermission(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setPermissionToDelete(selectedPermission.id);
                  setSelectedPermission(null);
                  setShowDeleteModal(true);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
