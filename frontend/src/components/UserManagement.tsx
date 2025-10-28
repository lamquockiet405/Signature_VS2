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
  permissions?: Permission[];
}

interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_id: string;
  role?: Role;
  status: string;
  created_at: string;
}

interface UserFormData {
  username: string;
  full_name: string;
  email: string;
  password?: string;
  role_id: string;
  status: string;
}

interface UserPermissions {
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<
    UserPermissions[]
  >([]);
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role_id: "",
    status: "active",
  });

  // Check if current user has specific permission
  const hasPermission = (module: string, action: string): boolean => {
    const perm = currentUserPermissions.find((p) => p.module === module);
    if (!perm) return false;

    switch (action) {
      case "create":
        return perm.can_create;
      case "read":
        return perm.can_read;
      case "update":
        return perm.can_update;
      case "delete":
        return perm.can_delete;
      case "approve":
        return perm.can_approve;
      default:
        return false;
    }
  };

  // Fetch current user's permissions
  useEffect(() => {
    fetchCurrentUserPermissions();
    fetchRoles();
    fetchUsers();
  }, []);

  const fetchCurrentUserPermissions = async () => {
    try {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId"); // Assuming userId is stored in localStorage

      const response = await fetch(`/api/roles/user/${userId}/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch permissions");

      const data = await response.json();
      setCurrentUserPermissions(data);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch users");

      const data = await response.json();
      setUsers(data.data || data);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
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
    }
  };

  const handleCreateNew = () => {
    if (!hasPermission("users", "create")) {
      alert("You do not have permission to create users");
      return;
    }

    setSelectedUser(null);
    setFormData({
      username: "",
      full_name: "",
      email: "",
      password: "",
      role_id: "",
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    if (!hasPermission("users", "update")) {
      alert("You do not have permission to edit users");
      return;
    }

    setSelectedUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      password: "", // Don't populate password for security
      role_id: user.role_id,
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!hasPermission("users", "delete")) {
      alert("You do not have permission to delete users");
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete user");

      alert("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = selectedUser ? `/api/users/${selectedUser.id}` : "/api/users";
      const method = selectedUser ? "PUT" : "POST";

      // Don't send password if it's empty during update
      const payload = { ...formData };
      if (selectedUser && !payload.password) {
        delete payload.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save user");

      alert(`User ${selectedUser ? "updated" : "created"} successfully`);
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user");
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedRolePermissions = (): Permission[] => {
    const selectedRole = roles.find((r) => r.id === formData.role_id);
    return selectedRole?.permissions || [];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        {hasPermission("users", "create") && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create New User
          </button>
        )}
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
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
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {user.role?.name || "No Role"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {hasPermission("users", "update") && (
                      <button
                        onClick={() => handleEdit(user)}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission("users", "delete") && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!hasPermission("users", "update") &&
                      !hasPermission("users", "delete") && (
                        <span className="text-gray-400">No actions</span>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            No users found. Create your first user to get started.
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}
      </div>

      {/* Modal for Create/Edit User */}
      {isModalOpen && (
        <div className="modal-backdrop-overflow">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 mx-4">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold">
                  {selectedUser ? "Edit User" : "Create New User"}
                </h2>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="johndoe"
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="john@example.com"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password {!selectedUser && "*"}
                    </label>
                    <input
                      type="password"
                      required={!selectedUser}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={
                        selectedUser
                          ? "Leave blank to keep current"
                          : "••••••••"
                      }
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      required
                      value={formData.role_id}
                      onChange={(e) =>
                        setFormData({ ...formData, role_id: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a role...</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
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
                </div>

                {/* Role Permissions Preview */}
                {formData.role_id && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Selected Role Permissions
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-md max-h-60 overflow-y-auto">
                      {getSelectedRolePermissions().length > 0 ? (
                        <div className="space-y-2">
                          {getSelectedRolePermissions().map(
                            (perm: Permission) => (
                              <div
                                key={perm.module}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="font-medium capitalize">
                                  {perm.module}:
                                </span>
                                <div className="flex gap-2 text-xs">
                                  {perm.can_create && (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                      Create
                                    </span>
                                  )}
                                  {perm.can_read && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                      Read
                                    </span>
                                  )}
                                  {perm.can_update && (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                      Update
                                    </span>
                                  )}
                                  {perm.can_delete && (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                                      Delete
                                    </span>
                                  )}
                                  {perm.can_approve && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                      Approve
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          No permissions configured for this role
                        </p>
                      )}
                    </div>
                  </div>
                )}
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
                    : selectedUser
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
