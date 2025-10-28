"use client";

import React, { useState, useEffect } from "react";
import { Edit, Trash2 } from "lucide-react";

interface Permission {
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  status: string;
  permissions: Permission[];
}

interface RoleFormData {
  name: string;
  description: string;
  status: string;
  permissions: Permission[];
}

const AVAILABLE_MODULES = [
  "overview",
  "document",
  "history",
  "users",
  "company info",
  "permissions",
  "document types",
  "authentication",
  "settings",
];

const ACTIONS = [
  "can_create",
  "can_read",
  "can_update",
  "can_delete",
  "can_approve",
];

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({
    name: "",
    description: "",
    status: "active",
    permissions: [],
  });

  // Fetch all roles
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/roles", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch roles");

      const data = await response.json();
      setRoles(data.data || data);
    } catch (error) {
      console.error("Error fetching roles:", error);
      alert("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize permissions for all modules
  const initializePermissions = (): Permission[] => {
    return AVAILABLE_MODULES.map((module) => ({
      module,
      can_create: false,
      can_read: false,
      can_update: false,
      can_delete: false,
      can_approve: false,
    }));
  };

  // Open modal for creating new role
  const handleCreateNew = () => {
    setSelectedRole(null);
    setFormData({
      name: "",
      description: "",
      status: "active",
      permissions: initializePermissions(),
    });
    setIsModalOpen(true);
  };

  // Open modal for editing existing role
  const handleEdit = (role: Role) => {
    setSelectedRole(role);

    // Merge existing permissions with all modules (in case new modules were added)
    const existingModules = role.permissions.map((p) => p.module);
    const missingModules = AVAILABLE_MODULES.filter(
      (m) => !existingModules.includes(m)
    );
    const missingPermissions = missingModules.map((module) => ({
      module,
      can_create: false,
      can_read: false,
      can_update: false,
      can_delete: false,
      can_approve: false,
    }));

    setFormData({
      name: role.name,
      description: role.description,
      status: role.status,
      permissions: [...role.permissions, ...missingPermissions],
    });
    setIsModalOpen(true);
  };

  // Delete role
  const handleDelete = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete role");

      alert("Role deleted successfully");
      fetchRoles();
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Failed to delete role. It may be in use by users.");
    }
  };

  // Handle form submission (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = selectedRole ? `/api/roles/${selectedRole.id}` : "/api/roles";
      const method = selectedRole ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save role");

      alert(`Role ${selectedRole ? "updated" : "created"} successfully`);
      setIsModalOpen(false);
      fetchRoles();
    } catch (error) {
      console.error("Error saving role:", error);
      alert("Failed to save role");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle permission checkbox change
  const handlePermissionChange = (
    module: string,
    action: keyof Permission,
    value: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.map((perm) =>
        perm.module === module ? { ...perm, [action]: value } : perm
      ),
    }));
  };

  // Toggle all permissions for a module
  const handleToggleModule = (module: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.map((perm) =>
        perm.module === module
          ? {
              ...perm,
              can_create: checked,
              can_read: checked,
              can_update: checked,
              can_delete: checked,
              can_approve: checked,
            }
          : perm
      ),
    }));
  };

  // Toggle all permissions for an action across all modules
  const handleToggleAction = (action: keyof Permission, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.map((perm) => ({
        ...perm,
        [action]: checked,
      })),
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Role Management</h1>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create New Role
        </button>
      </div>

      {/* Roles List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role Information
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map((role) => {
              // Calculate updated date
              const updatedDate = new Date(role.id).toLocaleDateString(
                "vi-VN",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }
              );

              return (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      <span className="text-base font-semibold text-gray-900">
                        {role.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {role.description || "Không có mô tả"}
                      </span>
                      <span className="text-xs text-gray-400">
                        Cập nhật: {updatedDate}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                        role.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          role.status === "active"
                            ? "bg-green-500"
                            : "bg-gray-500"
                        }`}
                      ></span>
                      {role.status === "active" ? "Hoạt động" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(role)}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                        title="Edit role"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {roles.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            No roles found. Create your first role to get started.
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}
      </div>

      {/* Modal for Create/Edit Role */}
      {isModalOpen && (
        <div className="modal-backdrop-overflow">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-8 mx-4">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold">
                  {selectedRole ? "Edit Role" : "Create New Role"}
                </h2>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {/* Basic Information */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Content Manager"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe the role's responsibilities..."
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Permissions Matrix */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Permissions</h3>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-sm text-gray-700 border-b border-r">
                            Module
                          </th>
                          {ACTIONS.map((action) => (
                            <th
                              key={action}
                              className="px-4 py-2 text-center font-medium text-sm text-gray-700 border-b border-r"
                            >
                              <div className="flex flex-col items-center">
                                <span className="capitalize mb-1">
                                  {action.replace("can_", "")}
                                </span>
                                <input
                                  type="checkbox"
                                  onChange={(e) =>
                                    handleToggleAction(
                                      action as keyof Permission,
                                      e.target.checked
                                    )
                                  }
                                  className="cursor-pointer"
                                  title={`Toggle all ${action.replace(
                                    "can_",
                                    ""
                                  )}`}
                                />
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-2 text-center font-medium text-sm text-gray-700 border-b">
                            All
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.permissions.map((perm) => (
                          <tr key={perm.module} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-sm text-gray-900 border-b border-r capitalize">
                              {perm.module}
                            </td>
                            {ACTIONS.map((action) => (
                              <td
                                key={action}
                                className="px-4 py-2 text-center border-b border-r"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    perm[action as keyof Permission] as boolean
                                  }
                                  onChange={(e) =>
                                    handlePermissionChange(
                                      perm.module,
                                      action as keyof Permission,
                                      e.target.checked
                                    )
                                  }
                                  className="cursor-pointer w-4 h-4"
                                />
                              </td>
                            ))}
                            <td className="px-4 py-2 text-center border-b">
                              <input
                                type="checkbox"
                                checked={ACTIONS.every(
                                  (action) => perm[action as keyof Permission]
                                )}
                                onChange={(e) =>
                                  handleToggleModule(
                                    perm.module,
                                    e.target.checked
                                  )
                                }
                                className="cursor-pointer w-4 h-4"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Saving..."
                    : selectedRole
                    ? "Update Role"
                    : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
