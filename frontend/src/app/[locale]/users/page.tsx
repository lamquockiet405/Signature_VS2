"use client";
import { useToast } from "@/components/ToastProvider";
import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  UserPlus,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Upload,
  Save,
} from "lucide-react";
import {
  usersAPI,
  uploadAPI,
  getCurrentUserId,
  isReadOnlyUser,
} from "@/lib/api";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  status?: string;
}

export default function UsersPage() {
  const toast = useToast();
  const t = useTranslations();
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    totalActiveUsers: 0,
    totalDraftUsers: 0,
  });
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role: "user",
    role_id: "",
    phone: "",
    avatar_url: "",
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    email: "",
    full_name: "",
    role: "user",
    phone: "",
    status: "active",
    password: "", // Optional - only if user wants to change password
    avatar_url: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [editErrorMessage, setEditErrorMessage] = useState<string>("");
  const [availableRoles, setAvailableRoles] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersAPI.getAll(currentPage, entriesPerPage);
      setAllUsers(data.users || []);
      setTotalUsers(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching users:", error);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, entriesPerPage]);

  const fetchUserStats = useCallback(async () => {
    try {
      const stats = await usersAPI.getStats();
      setUserStats({
        totalUsers: stats.totalUsers || 0,
        totalActiveUsers: stats.totalActiveUsers || 0,
        totalDraftUsers: stats.totalDraftUsers || 0,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // Fallback to pagination total for total users
      setUserStats({
        totalUsers: totalUsers,
        totalActiveUsers: 0,
        totalDraftUsers: 0,
      });
    }
  }, [totalUsers]);

  useEffect(() => {
    // Avoid calling guarded backend endpoints when the client is not
    // authenticated. The backend requires an acting user id (x-user-id)
    // for permission checks; calling without a signed-in user results in
    // a non-OK response and the generic "Failed to fetch users" error.
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      // Not signed in: stop loading and show a friendly prompt.
      setLoading(false);
      setAllUsers([]);
      setTotalUsers(0);
      setTotalPages(1);
      return;
    }

    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  // Fetch roles from roles table
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoadingRoles(true);
        // Use new usersAPI.getRoles() endpoint
        const res = await usersAPI.getRoles();
        console.log("📊 Roles API Response:", res);

        // API returns { roles: [...], total: number }
        const rolesFromDB = (res.roles || []).map(
          (r: { id: string; name: string; description?: string }) => ({
            id: r.id,
            name: r.name,
            description: r.description,
          })
        );

        console.log("✅ Available roles:", rolesFromDB);
        setAvailableRoles(rolesFromDB);

        // If current newUser.role is not in list, set to first available
        if (
          rolesFromDB.length > 0 &&
          !rolesFromDB.find(
            (r: { id: string; name: string; description?: string }) =>
              r.name === newUser.role
          )
        ) {
          setNewUser((prev) => ({
            ...prev,
            role: rolesFromDB[0].name,
            role_id: rolesFromDB[0].id,
          }));
        }
      } catch (e) {
        console.error("❌ Failed to load roles from database:", e);
        // Fallback to default roles
        setAvailableRoles([
          { id: "default-user", name: "user", description: "Basic user role" },
          {
            id: "default-admin",
            name: "admin",
            description: "Administrator role",
          },
        ]);
      } finally {
        setLoadingRoles(false);
      }
    };
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateUser = async () => {
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }
    // Clear previous error
    setErrorMessage("");

    try {
      // Validation - only require email and full_name now
      if (!newUser.email || !newUser.full_name) {
        setErrorMessage(
          "⚠️ Please fill in all required fields (Full name, Email)"
        );
        return;
      }

      // Generate username from email if not provided
      const username = newUser.username || newUser.email.split("@")[0];

      // Generate a default password if not provided
      const password = newUser.password || "DefaultPassword123!";

      // Create user data - only include avatar_url if it exists
      const userData: {
        username: string;
        email: string;
        password: string;
        role: string;
        role_id?: string;
        full_name: string;
        phone: string;
        avatar_url?: string;
      } = {
        username: username,
        email: newUser.email,
        password: password,
        role: newUser.role,
        full_name: newUser.full_name,
        phone: newUser.phone,
      };

      // Add role_id if available
      if (newUser.role_id) {
        userData.role_id = newUser.role_id;
      }

      // Only add avatar_url if user uploaded an avatar
      if (newUser.avatar_url) {
        userData.avatar_url = newUser.avatar_url;
      }

      await usersAPI.create(userData);

      // Success - close modal and reset
      setShowAddModal(false);
      setErrorMessage("");
      setNewUser({
        username: "",
        email: "",
        password: "",
        full_name: "",
        role: "user",
        role_id: "",
        phone: "",
        avatar_url: "",
      });
      setAvatarPreview("");
      fetchUsers();
      fetchUserStats(); // Refresh stats after creating user

      // Show success notification
      toast.success("User created successfully!");
    } catch (error: unknown) {
      console.error("Error creating user:", error);

      // Extract error message
      const err = error as { message?: string };
      const errMsg = err.message || "Failed to create user";

      // Show specific error message in modal
      if (errMsg.includes("already exists")) {
        setErrorMessage(
          "⚠️ This email already exists. Please use a different email."
        );
      } else if (errMsg.includes("required")) {
        setErrorMessage(
          "⚠️ Please fill in all required fields (Full name, Email)."
        );
      } else {
        setErrorMessage(`❌ ${errMsg}`);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await usersAPI.delete(userId);
      fetchUsers();
      fetchUserStats(); // Refresh stats after deleting user
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("File size must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload immediately
    try {
      setUploadingAvatar(true);
      const result = await uploadAPI.uploadAvatar(file);

      // Update form data with uploaded avatar URL
      setNewUser({ ...newUser, avatar_url: result.avatarUrl });
      setEditFormData({ ...editFormData, avatar_url: result.avatarUrl });

      console.log("Avatar uploaded:", result);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
      setAvatarPreview("");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name || "",
      role: user.role,
      phone: user.phone || "",
      status: user.status || "active",
      password: "", // Empty - user can optionally change password
      avatar_url: user.avatar_url || "",
    });
    setAvatarPreview(user.avatar_url || "");
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (isReadOnlyUser()) {
      setEditErrorMessage("Bạn không có quyền thực hiện hành động này");
      return;
    }
    // Clear previous error
    setEditErrorMessage("");

    try {
      if (!editFormData.username || !editFormData.email) {
        setEditErrorMessage("⚠️ Username and Email are required fields");
        return;
      }

      // Only send fields that have values
      const updateData: {
        username: string;
        email: string;
        full_name: string;
        role: string;
        phone: string;
        status: string;
        password?: string;
        avatar_url?: string;
      } = {
        username: editFormData.username,
        email: editFormData.email,
        full_name: editFormData.full_name,
        role: editFormData.role,
        phone: editFormData.phone,
        status: editFormData.status,
      };

      // Only include password if user entered a new one
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      // Include avatar_url if it exists
      if (editFormData.avatar_url) {
        updateData.avatar_url = editFormData.avatar_url;
      }

      console.log("Updating user with data:", updateData); // Debug log

      await usersAPI.update(editingUser.id, updateData);

      // Success - close modal and reset
      setShowEditModal(false);
      setEditingUser(null);
      setEditErrorMessage("");
      setEditFormData({
        username: "",
        email: "",
        full_name: "",
        role: "user",
        phone: "",
        status: "active",
        password: "",
        avatar_url: "",
      });
      setAvatarPreview("");
      fetchUsers();
      fetchUserStats(); // Refresh stats after updating user

      // Show success notification
      toast.success("User updated successfully!");
    } catch (error: unknown) {
      console.error("Error updating user:", error);

      // Extract error message
      const err = error as { message?: string };
      const errMsg = err.message || "Failed to update user";

      // Show specific error message in modal
      if (errMsg.includes("already exists")) {
        setEditErrorMessage(
          "⚠️ This username or email already exists. Please use different credentials."
        );
      } else if (errMsg.includes("required")) {
        setEditErrorMessage("⚠️ Please fill in all required fields.");
      } else {
        setEditErrorMessage(`❌ ${errMsg}`);
      }
    }
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

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email ? email.slice(0, 2).toUpperCase() : "??";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "text-green-600 bg-green-50";
      case "inactive":
        return "text-gray-600 bg-gray-50";
      case "pending":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-green-600 bg-green-50"; // Default to active
    }
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("users.title")}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">
            {t("navigation.overview")}
          </span>
          <span>&gt;</span>
          <span className="text-gray-900">{t("users.title")}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("dashboard.totalUsers")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {userStats.totalUsers}
          </h3>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("users.active")} {t("dashboard.totalUsers")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {userStats.totalActiveUsers}
          </h3>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {t("dashboard.totalDraftUsers")}
          </p>
          <h3 className="text-3xl font-bold text-gray-900">
            {userStats.totalDraftUsers}
          </h3>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("users.title")} {t("common.list")}
          </h2>
        </div>

        <div
          className="p-6 border border-gray-200 rounded-lg"
          style={{ margin: "20px" }}
        >
          {/* Controls */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
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
                  placeholder={t("users.searchUsers")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                <Download size={16} />
                {t("common.export")} CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <UserPlus size={16} />
                {t("users.addUser")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("users.userInformation")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("users.role")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("users.status")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    {t("users.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user, index) => {
                  const formattedDate = new Date(
                    user.created_at
                  ).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          {user.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={
                                user.avatar_url.startsWith("http")
                                  ? user.avatar_url
                                  : `http://localhost:5000${user.avatar_url}`
                              }
                              alt={user.full_name || user.username}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 ${getAvatarColor(
                                index
                              )} rounded-full flex items-center justify-center flex-shrink-0`}
                            >
                              <span className="text-white text-sm font-medium">
                                {getInitials(user.full_name, user.email)}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col space-y-2">
                            <span className="text-base font-semibold text-gray-900">
                              {user.full_name || user.username}
                            </span>
                            <div className="inline-flex items-center bg-teal-100 px-2 py-0.5 rounded w-fit">
                              <span className="text-sm text-gray-700">
                                {user.email}
                              </span>
                            </div>
                            <div className="inline-flex items-center bg-teal-100 px-2 py-0.5 rounded w-fit">
                              <span className="text-xs text-gray-700">
                                Thêm: {formattedDate}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${
                            (user.status || "active") === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              (user.status || "active") === "active"
                                ? "bg-green-500"
                                : "bg-gray-500"
                            }`}
                          ></span>
                          {(user.status || "active") === "active"
                            ? "Hoạt động"
                            : "Tạm ngưng"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleEditClick(user)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} className="text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">
              {t("common.show")} {(currentPage - 1) * entriesPerPage + 1}{" "}
              {t("common.to")}{" "}
              {Math.min(currentPage * entriesPerPage, totalUsers)}{" "}
              {t("common.of")} {totalUsers} {t("common.entries")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(Math.min(totalPages, 10))].map((_, i) => {
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

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("users.addNewUser")}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">
                      {errorMessage}
                    </p>
                  </div>
                  <button
                    onClick={() => setErrorMessage("")}
                    className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t("users.status")}
                </label>
                <select
                  value={newUser.role === "user" ? "active" : newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="active">{t("users.active")}</option>
                  <option value="inactive">{t("users.inactive")}</option>
                  <option value="pending">{t("documents.pending")}</option>
                </select>
              </div>

              {/* Avatar Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  {t("users.avatar")}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                      <Upload size={20} className="text-gray-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {t("documents.dragDropFile")}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      {t("documents.supportedFormats")}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      {t("documents.imagesHereOrBrowse")}
                    </p>
                    <label
                      htmlFor="avatar-upload-add"
                      className="inline-block text-sm text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      {t("common.browse")}
                    </label>
                  </div>
                  <input
                    id="avatar-upload-add"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar}
                  />
                </div>
                {avatarPreview && (
                  <div className="mt-3 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        avatarPreview.startsWith("data:")
                          ? avatarPreview
                          : `http://localhost:5000${avatarPreview}`
                      }
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                    />
                  </div>
                )}
                {uploadingAvatar && (
                  <p className="text-sm text-blue-600 mt-2 text-center">
                    Uploading avatar...
                  </p>
                )}
              </div>

              {/* Document Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  {t("documents.documentInformation")}
                </h3>

                {/* Full name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.fullName")}
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => {
                      setNewUser({ ...newUser, full_name: e.target.value });
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Lindsey Curtis"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.email")}
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => {
                      setNewUser({ ...newUser, email: e.target.value });
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="lindsey@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.role")}
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => {
                      const selectedRole = availableRoles.find(
                        (r) => r.name === e.target.value
                      );
                      setNewUser({
                        ...newUser,
                        role: e.target.value,
                        role_id: selectedRole?.id || "",
                      });
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    disabled={loadingRoles}
                  >
                    {availableRoles.map((role) => (
                      <option
                        key={role.id}
                        value={role.name}
                        className="capitalize"
                      >
                        {role.name}{" "}
                        {role.description ? `- ${role.description}` : ""}
                      </option>
                    ))}
                    {availableRoles.length === 0 && (
                      <option value={newUser.role}>{newUser.role}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                {t("common.cancel")}
                <X size={16} className="inline ml-2" />
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                {t("common.save")}
                <Save size={16} className="inline ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("users.editUser")}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Error Message */}
              {editErrorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">
                      {editErrorMessage}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditErrorMessage("")}
                    className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Avatar Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Avatar
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                      <Upload size={20} className="text-gray-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Drop file here
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      Drag and drop your PNG, JPG, WebP, SVG
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      images here or browse
                    </p>
                    <label
                      htmlFor="avatar-upload-edit"
                      className="inline-block text-sm text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Browse file
                    </label>
                  </div>
                  <input
                    id="avatar-upload-edit"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar}
                  />
                </div>
                {avatarPreview && (
                  <div className="mt-3 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        avatarPreview.startsWith("data:")
                          ? avatarPreview
                          : `http://localhost:5000${avatarPreview}`
                      }
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                    />
                  </div>
                )}
                {uploadingAvatar && (
                  <p className="text-sm text-blue-600 mt-2 text-center">
                    Uploading avatar...
                  </p>
                )}
              </div>

              {/* User Information */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  {t("users.userInformation")}
                </h3>

                {/* Username */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.username")} *
                  </label>
                  <input
                    type="text"
                    value={editFormData.username}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        username: e.target.value,
                      });
                      if (editErrorMessage) setEditErrorMessage(""); // Clear error when user types
                    }}
                    placeholder="johndoe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Full name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.fullName")}
                  </label>
                  <input
                    type="text"
                    value={editFormData.full_name}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        full_name: e.target.value,
                      });
                      if (editErrorMessage) setEditErrorMessage(""); // Clear error when user types
                    }}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.email")} *
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        email: e.target.value,
                      });
                      if (editErrorMessage) setEditErrorMessage(""); // Clear error when user types
                    }}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Password (Optional) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.password")} ({t("users.leaveEmptyToKeepCurrent")})
                  </label>
                  <input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        password: e.target.value,
                      });
                      if (editErrorMessage) setEditErrorMessage(""); // Clear error when user types
                    }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t("users.onlyFillIfWantToChangePassword")}
                  </p>
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.phone")}
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        phone: e.target.value,
                      });
                      if (editErrorMessage) setEditErrorMessage(""); // Clear error when user types
                    }}
                    placeholder="+84 901 234 567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Role */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.role")}
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loadingRoles}
                  >
                    {/* Ensure the current role is selectable even if it's not in availableRoles */}
                    {!availableRoles.find(
                      (r) => r.name === editFormData.role
                    ) && (
                      <option value={editFormData.role}>
                        {editFormData.role}
                      </option>
                    )}
                    {availableRoles.map((role) => (
                      <option
                        key={role.id}
                        value={role.name}
                        className="capitalize"
                      >
                        {role.name}{" "}
                        {role.description ? `- ${role.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("users.status")}
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">{t("users.active")}</option>
                    <option value="inactive">{t("users.inactive")}</option>
                    <option value="pending">{t("documents.pending")}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                {t("common.cancel")}
                <X size={16} className="inline ml-2" />
              </button>
              <button
                onClick={handleUpdateUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                {t("common.update")}
                <Save size={16} className="inline ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
