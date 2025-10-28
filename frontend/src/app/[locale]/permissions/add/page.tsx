"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { X, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { permissionsAPI } from "@/lib/api";

export default function AddPermissionPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [newRole, setNewRole] = useState({
    status: "Published",
    roleName: "",
    description: "",
    permissions: {
      overview: { create: true, read: true, update: false, delete: true },
      document: {
        create: true,
        read: true,
        update: false,
        delete: true,
        approve: true,
      },
      history: { create: true, read: true, update: false, delete: true },
      users: { create: true, read: true, update: false, delete: true },
      companyInfo: { create: true, read: true, update: false, delete: true },
      permissions: { create: true, read: true, update: false, delete: true },
      documentTypes: { create: true, read: true, update: false, delete: true },
      authentication: { create: true, read: true, update: false, delete: true },
      settings: { create: true, read: true, update: false, delete: true },
    },
  });

  const togglePermission = (
    section: keyof typeof newRole.permissions,
    action: string
  ) => {
    setNewRole({
      ...newRole,
      permissions: {
        ...newRole.permissions,
        [section]: {
          ...newRole.permissions[section],
          [action]:
            !newRole.permissions[section][
              action as keyof (typeof newRole.permissions)[typeof section]
            ],
        },
      },
    });
  };

  const selectAllForSection = (section: keyof typeof newRole.permissions) => {
    const allActions = Object.keys(newRole.permissions[section]);
    const allSelected = allActions.every(
      (action) =>
        newRole.permissions[section][
          action as keyof (typeof newRole.permissions)[typeof section]
        ]
    );

    // If all selected, deselect all. Otherwise, select all
    const newValue = !allSelected;
    const updatedSection: Record<string, boolean> = {};
    allActions.forEach((action) => {
      updatedSection[action] = newValue;
    });

    setNewRole({
      ...newRole,
      permissions: {
        ...newRole.permissions,
        [section]: updatedSection,
      },
    });
  };

  const handleSave = async () => {
    // Validation
    if (!newRole.roleName.trim()) {
      toast.error("Please enter role name");
      return;
    }

    // Convert permissions to array of strings (module_action format)
    const permissionsArray: string[] = [];
    Object.entries(newRole.permissions).forEach(([section, actionsRaw]) => {
      const actions = actionsRaw as Record<string, unknown>;
      Object.entries(actions).forEach(([action, enabled]) => {
        if (enabled) {
          // Convert to uppercase module_action format (e.g., "OVERVIEW_CREATE")
          const moduleName = section.toUpperCase();
          const actionUpper = action.toUpperCase();
          permissionsArray.push(`${moduleName}_${actionUpper}`);
        }
      });
    });

    // Validate at least one permission selected
    if (permissionsArray.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    try {
      setSaving(true);

      // Map status to lowercase for backend
      const statusMap: Record<string, string> = {
        Published: "active",
        Draft: "inactive",
        Completed: "active",
        Pending: "inactive",
      };

      // Create role in roles table via permissions API
      await permissionsAPI.create({
        role_name: newRole.roleName,
        description: newRole.description,
        status: statusMap[newRole.status] || "active",
        permissions: permissionsArray,
      });

      toast.success("Role created successfully!");
      console.log(
        "Created role:",
        newRole.roleName,
        "with permissions:",
        permissionsArray
      );
      router.push("/permissions");
    } catch (error: unknown) {
      console.error("Error creating role:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create role: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Add new permission</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            onClick={() => router.push("/permissions")}
            className="hover:text-gray-700 cursor-pointer"
          >
            Permissions
          </span>
          <span>&gt;</span>
          <span className="text-gray-900">Add New</span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Roles Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">Roles</h3>

          <div className="space-y-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={newRole.status}
                onChange={(e) =>
                  setNewRole({ ...newRole, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Role Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={newRole.roleName}
                onChange={(e) =>
                  setNewRole({ ...newRole, roleName: e.target.value })
                }
                placeholder="Enter name of role"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
                placeholder="Enter description of role"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push("/permissions")}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
                <X size={16} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save"}
                <Save size={16} />
              </button>
            </div>
          </div>
        </div>
        {/* Right Column - Permissions Checkboxes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-6">
            Permissions
          </h3>

          <div className="space-y-6">
            {/* Overview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Overview
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(newRole.permissions.overview).every(
                      (v) => v
                    )}
                    onChange={() => selectAllForSection("overview")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.overview[
                          action as keyof typeof newRole.permissions.overview
                        ]
                      }
                      onChange={() => togglePermission("overview", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Document */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Document
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(newRole.permissions.document).every(
                      (v) => v
                    )}
                    onChange={() => selectAllForSection("document")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-3">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.document[
                          action as keyof typeof newRole.permissions.document
                        ]
                      }
                      onChange={() => togglePermission("document", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRole.permissions.document.approve}
                  onChange={() => togglePermission("document", "approve")}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Approve</span>
              </label>
            </div>

            {/* History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">History</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(newRole.permissions.history).every(
                      (v) => v
                    )}
                    onChange={() => selectAllForSection("history")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.history[
                          action as keyof typeof newRole.permissions.history
                        ]
                      }
                      onChange={() => togglePermission("history", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Users */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Users</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(newRole.permissions.users).every(
                      (v) => v
                    )}
                    onChange={() => selectAllForSection("users")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.users[
                          action as keyof typeof newRole.permissions.users
                        ]
                      }
                      onChange={() => togglePermission("users", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Company Info */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Company Info
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(
                      newRole.permissions.companyInfo
                    ).every((v) => v)}
                    onChange={() => selectAllForSection("companyInfo")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.companyInfo[
                          action as keyof typeof newRole.permissions.companyInfo
                        ]
                      }
                      onChange={() => togglePermission("companyInfo", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Permissions
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(
                      newRole.permissions.permissions
                    ).every((v) => v)}
                    onChange={() => selectAllForSection("permissions")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.permissions[
                          action as keyof typeof newRole.permissions.permissions
                        ]
                      }
                      onChange={() => togglePermission("permissions", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Document types */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Document types
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(
                      newRole.permissions.documentTypes
                    ).every((v) => v)}
                    onChange={() => selectAllForSection("documentTypes")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.documentTypes[
                          action as keyof typeof newRole.permissions.documentTypes
                        ]
                      }
                      onChange={() => togglePermission("documentTypes", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Authentication */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Authentication
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(
                      newRole.permissions.authentication
                    ).every((v) => v)}
                    onChange={() => selectAllForSection("authentication")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.authentication[
                          action as keyof typeof newRole.permissions.authentication
                        ]
                      }
                      onChange={() =>
                        togglePermission("authentication", action)
                      }
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Settings
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Object.values(newRole.permissions.settings).every(
                      (v) => v
                    )}
                    onChange={() => selectAllForSection("settings")}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Select All</span>
                </label>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {["create", "read", "update", "delete"].map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        newRole.permissions.settings[
                          action as keyof typeof newRole.permissions.settings
                        ]
                      }
                      onChange={() => togglePermission("settings", action)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {action}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
