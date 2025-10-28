/* eslint-disable @typescript-eslint/no-explicit-any */
// Backend API URL
// Prefer env NEXT_PUBLIC_API_URL. Fallback to common Nest default 5000.
// This fixes "Failed to fetch" when the backend is not on the correct port.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Debug: Log the API base URL
console.log("🔧 API_BASE_URL:", API_BASE_URL);

// Simple client-side auth helpers. We store the logged-in user in
// localStorage under `currentUser` (small, non-sensitive subset returned
// by the backend) and automatically forward the user's id as the
// `x-user-id` header for requests that need acting user resolution.
function safeParse(str: string | null) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function getCurrentUser() {
  if (typeof window === "undefined") return null;
  return safeParse(localStorage.getItem("currentUser"));
}

export function getCurrentUserId() {
  return getCurrentUser()?.id || null;
}

function injectAuthHeaders(headers?: Record<string, string> | undefined) {
  const out: Record<string, string> = headers ? { ...headers } : {};

  // JWT Authentication (NEW - SECURE)
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");
    if (token) {
      out["Authorization"] = `Bearer ${token}`;
    }
  }

  // Legacy x-user-id header (kept for backward compatibility, but JWT is primary)
  const id = getCurrentUserId();
  if (id) out["x-user-id"] = id;

  return out;
}

// ==================== Upload API ====================
export const uploadAPI = {
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${API_BASE_URL}/upload/avatar`, {
      method: "POST",
      headers: injectAuthHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload avatar");
    return res.json();
  },

  deleteAvatar: async (filename: string) => {
    const res = await fetch(`${API_BASE_URL}/upload/avatar/${filename}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete avatar");
    return res.json();
  },
};

// ==================== Users API ====================
export const usersAPI = {
  getAll: async (page = 1, limit = 10, role?: string) => {
    // Pagination params: page and limit are sent to the backend as query params.
    // Backend will translate these into LIMIT / OFFSET in SQL.
    // Example request: GET /api/users?page=2&limit=20
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (role) params.append("role", role);

    const res = await fetch(`${API_BASE_URL}/users?${params}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  create: async (userData: any) => {
    // If the frontend has a logged-in user, prefer that as the acting user
    // unless the caller explicitly provided a currentUserId/userId in payload.
    const actingUserId =
      userData?.currentUserId || userData?.userId || getCurrentUserId();
    const headers = injectAuthHeaders({ "Content-Type": "application/json" });
    if (actingUserId) headers["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/users`, {
      method: "POST",
      headers,
      body: JSON.stringify(userData),
    });

    // Log response for debugging
    console.log("Create user response status:", res.status);
    const responseText = await res.text();
    console.log("Create user response body:", responseText);

    if (!res.ok) {
      console.error("Failed to create user. Status:", res.status);
      throw new Error(`Failed to create user: ${responseText}`);
    }

    return JSON.parse(responseText);
  },

  update: async (id: string, userData: any) => {
    const actingUserId =
      userData?.currentUserId || userData?.userId || getCurrentUserId();
    const headers = injectAuthHeaders({ "Content-Type": "application/json" });
    if (actingUserId) headers["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error("Failed to update user");
    return res.json();
  },

  delete: async (id: string, currentUserId?: string) => {
    const actingUserId = currentUserId || getCurrentUserId();
    const headers = injectAuthHeaders({ "Content-Type": "application/json" });
    if (actingUserId) headers["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ currentUserId: actingUserId }),
    });
    if (!res.ok) throw new Error("Failed to delete user");
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE_URL}/users/stats/summary`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch user statistics");
    return res.json();
  },

  getRoles: async () => {
    const res = await fetch(`${API_BASE_URL}/users/roles/list`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch roles");
    return res.json();
  },
};

// ==================== Auth API ====================
export const authAPI = {
  login: async (email: string, password: string) => {
    const loginUrl = `${API_BASE_URL}/auth/login`;
    console.log("🔐 Login URL:", loginUrl);
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    if (!res.ok) {
      let err = text || "Login failed";
      try {
        err = JSON.parse(text).error || err;
      } catch {}
      throw new Error(err);
    }
    const data = JSON.parse(text);
    // Persist minimal user info for client-side acting user resolution.
    try {
      if (typeof window !== "undefined" && data?.user) {
        // Store JWT token for authentication (CRITICAL for RBAC)
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);
        }

        // Store user permissions for client-side UI checks
        if (data.permissions) {
          localStorage.setItem("permissions", JSON.stringify(data.permissions));
        }

        // store only non-sensitive fields (server removes password_hash)
        const toStore = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role,
          full_name: data.user.full_name,
        };
        localStorage.setItem("currentUser", JSON.stringify(toStore));
      }
    } catch {
      // ignore storage errors
    }
    return data;
  },
  register: async (
    username: string,
    email: string,
    password: string,
    full_name?: string,
    role?: string
  ) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, full_name, role }),
    });
    const text = await res.text();
    if (!res.ok) {
      let err = text || "Register failed";
      try {
        err = JSON.parse(text).error || err;
      } catch {}
      throw new Error(err);
    }
    const data = JSON.parse(text);
    try {
      if (typeof window !== "undefined" && data?.user) {
        const toStore = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          role: data.user.role,
          full_name: data.user.full_name,
        };
        localStorage.setItem("currentUser", JSON.stringify(toStore));
      }
    } catch {}
    return data;
  },
  logout: async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token"); // Also remove legacy token if exists
        localStorage.removeItem("permissions");
      }
    } catch {}
  },
  getCurrentUser: () => {
    return getCurrentUser();
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch user info");
    }
    return res.json();
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch user profile");
    }
    return res.json();
  },

  checkPermission: async (module: string, action: string) => {
    const res = await fetch(
      `${API_BASE_URL}/auth/check-permission?module=${module}&action=${action}`,
      {
        headers: injectAuthHeaders(),
      }
    );
    if (!res.ok) {
      throw new Error("Failed to check permission");
    }
    return res.json();
  },
};

// Returns true when the current user has the basic 'user' role.
// UI can use this to disable write actions for read-only accounts.
export function isReadOnlyUser() {
  const u = getCurrentUser();
  return !!(u && typeof u === "object" && (u as any).role === "user");
}

// Returns true when the current user has the admin role. Use this in the UI
// to enable/allow full-access features client-side as a convenience. The
// backend PermissionsGuard still enforces authority server-side.
export function isAdmin() {
  const u = getCurrentUser();
  return !!(u && typeof u === "object" && (u as any).role === "admin");
}

export const hasFullAccess = isAdmin;

// ==================== Files API ====================
export const filesAPI = {
  upload: async (
    file: File,
    userId: string,
    description?: string,
    documentName?: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    if (description) formData.append("description", description);
    if (documentName) formData.append("documentName", documentName);

    console.log("Uploading to:", `${API_BASE_URL}/documents/upload`);
    console.log("FormData:", {
      file: file.name,
      userId,
      description,
      documentName,
    });

    // Forward acting user id as a header so the backend can resolve
    // authorization deterministically. Do not set Content-Type when
    // sending FormData; the browser will add the correct boundary.
    const headers = injectAuthHeaders();

    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    // Get response text for better error messages
    const responseText = await res.text();
    console.log("Upload response status:", res.status);
    console.log("Upload response body:", responseText);

    if (!res.ok) {
      let errorMsg = "Failed to upload file";
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {
        errorMsg = responseText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return JSON.parse(responseText);
  },

  // Note: this helper requests a page of files from the backend.
  // If you want backend-side time filtering (week/month/year), add a `period`
  // query param here and implement handling in backend `/files` route.
  getAll: async (page = 1, limit = 100, status = "active") => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      status: status,
    });

    const res = await fetch(`${API_BASE_URL}/documents?${params}`, {
      headers: injectAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            "You don't have permission to view files. Please contact your administrator or try logging in again."
        );
      }
      throw new Error("Failed to fetch files");
    }
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch file");
    return res.json();
  },

  update: async (id: string, updateData: any, userId?: string) => {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: "PUT",
      headers: injectAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...updateData, userId }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let errorMsg = "Failed to update file";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },

  delete: async (id: string, userId: string) => {
    console.log('🗑️ Calling delete API:', { url: `${API_BASE_URL}/documents/${id}`, userId });
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: "DELETE",
      headers: injectAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId }),
    });
    console.log('📥 Delete API response:', { status: res.status, ok: res.ok });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error('❌ Delete API error:', errorText);
      let errorMsg = "Failed to delete file";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },
};

// ==================== Company API ====================
export const companyAPI = {
  get: async () => {
    const res = await fetch(`${API_BASE_URL}/company`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch company info");
    return res.json();
  },

  update: async (companyData: any, userId?: string) => {
    const res = await fetch(`${API_BASE_URL}/company`, {
      method: "PUT",
      headers: injectAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...companyData, userId }),
    });
    if (!res.ok) throw new Error("Failed to update company info");
    return res.json();
  },
};

// ==================== Logs API ====================
export const logsAPI = {
  getAll: async (page = 1, limit = 50, filters: Record<string, any> = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    for (const key of Object.keys(filters)) {
      if (filters[key] !== undefined && filters[key] !== null) {
        params.append(key, String(filters[key]));
      }
    }

    const res = await fetch(`${API_BASE_URL}/logs?${params.toString()}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Failed to fetch logs");
    }
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/logs/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch log entry");
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE_URL}/logs/stats/summary`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch log statistics");
    return res.json();
  },

  getActionStats: async (period: string = "weekly") => {
    // period should be one of: 'weekly', 'monthly', 'yearly'.
    // Backend calculates period start/end and returns counts for current and previous.
    const params = new URLSearchParams({ period });
    const res = await fetch(`${API_BASE_URL}/logs/stats/actions?${params}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch action statistics");
    return res.json();
  },
};

// ==================== Delegations API ====================
export const delegationsAPI = {
  getRoles: async (): Promise<{
    roles: { name: string; source: string }[];
  }> => {
    const res = await fetch(`${API_BASE_URL}/delegations/roles`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch delegation roles");
    return res.json();
  },

  create: async (delegationData: any) => {
    const userId = delegationData.delegator_id || delegationData.currentUserId;
    const res = await fetch(`${API_BASE_URL}/delegations`, {
      method: "POST",
      headers: injectAuthHeaders({
        "Content-Type": "application/json",
        "x-user-id": userId,
      }),
      body: JSON.stringify(delegationData),
    });
    if (!res.ok) throw new Error("Failed to create delegation");
    return res.json();
  },

  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });

    const res = await fetch(`${API_BASE_URL}/delegations?${params}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch delegations");
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/delegations/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch delegation");
    return res.json();
  },

  update: async (id: string, updateData: any, currentUserId?: string) => {
    const userId =
      currentUserId || updateData.currentUserId || updateData.delegator_id;
    const res = await fetch(`${API_BASE_URL}/delegations/${id}`, {
      method: "PUT",
      headers: injectAuthHeaders({
        "Content-Type": "application/json",
        "x-user-id": userId,
      }),
      body: JSON.stringify(updateData),
    });
    if (!res.ok) throw new Error("Failed to update delegation");
    return res.json();
  },

  revoke: async (id: string, currentUserId: string) => {
    const res = await fetch(`${API_BASE_URL}/delegations/${id}`, {
      method: "DELETE",
      headers: injectAuthHeaders({
        "Content-Type": "application/json",
        "x-user-id": currentUserId,
      }),
      body: JSON.stringify({ currentUserId }),
    });
    if (!res.ok) throw new Error("Failed to revoke delegation");
    return res.json();
  },
};

// ==================== Document Signatures API ====================
export const documentSignaturesAPI = {
  create: async (signatureData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // If client supplies a acting user id, forward it as a header to make
    // server-side authorization resolution deterministic.
    const actingUserId = signatureData?.currentUserId || signatureData?.userId;
    if (actingUserId) {
      baseHeaders["x-user-id"] = actingUserId;
    }

    const res = await fetch(`${API_BASE_URL}/document-signatures`, {
      method: "POST",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(signatureData),
    });

    if (!res.ok) {
      const errorResponse = await res
        .json()
        .catch(() => ({ message: "No JSON response", raw: res.statusText }));
      throw new Error(
        errorResponse.message ||
          errorResponse.error ||
          "Failed to create signature delegation"
      );
    }
    return res.json();
  },

  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });

    const res = await fetch(`${API_BASE_URL}/document-signatures?${params}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch signature delegations");
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/document-signatures/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch signature delegation");
    return res.json();
  },

  sign: async (id: string, signatureData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId = signatureData?.currentUserId || signatureData?.userId;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    console.log("🔐 Calling document-signatures sign API:", {
      url: `${API_BASE_URL}/document-signatures/${id}/sign`,
      delegationId: id,
      headers: baseHeaders,
      body: signatureData,
    });

    const res = await fetch(`${API_BASE_URL}/document-signatures/${id}/sign`, {
      method: "PUT",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(signatureData),
    });

    // Get response details for debugging
    const responseText = await res.text();
    console.log("📥 Sign API Response:", {
      status: res.status,
      statusText: res.statusText,
      body: responseText,
    });

    if (!res.ok) {
      let errorMsg = "Failed to sign document";
      try {
        const errorData = JSON.parse(responseText);
        errorMsg =
          errorData.message || errorData.error || JSON.stringify(errorData);
      } catch {
        errorMsg = responseText || errorMsg;
      }
      console.error("❌ Sign failed:", errorMsg);
      throw new Error(errorMsg);
    }

    return JSON.parse(responseText);
  },

  reject: async (id: string, reason?: string) => {
    const payload = { reason };
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId =
      (payload as any)?.currentUserId || (payload as any)?.userId;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    const res = await fetch(
      `${API_BASE_URL}/document-signatures/${id}/reject`,
      {
        method: "PUT",
        headers: injectAuthHeaders(baseHeaders),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) throw new Error("Failed to reject signature");
    return res.json();
  },

  update: async (id: string, updateData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId = updateData?.currentUserId || updateData?.userId;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/document-signatures/${id}`, {
      method: "PUT",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(updateData),
    });
    if (!res.ok) throw new Error("Failed to update signature delegation");
    return res.json();
  },

  cancel: async (id: string) => {
    // cancel endpoint expects a DELETE; to support authorization resolution
    // provide user id via header if present in a global client state later. For
    // now we simply call without a body. If callers need to pass currentUserId
    // they should call the API directly or update this helper.
    const res = await fetch(`${API_BASE_URL}/document-signatures/${id}`, {
      method: "DELETE",
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to cancel signature delegation");
    return res.json();
  },

  getStats: async (period: string = "week") => {
    const res = await fetch(
      `${API_BASE_URL}/document-signatures/stats/summary?period=${period}`,
      {
        headers: injectAuthHeaders(),
      }
    );
    if (!res.ok) throw new Error("Failed to fetch signature statistics");
    return res.json();
  },
};

// ==================== Permissions API ====================
export const permissionsAPI = {
  create: async (permissionData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId =
      permissionData?.currentUserId || permissionData?.user_id;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/permissions`, {
      method: "POST",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(permissionData),
    });
    if (!res.ok) throw new Error("Failed to create permission");
    return res.json();
  },

  getAll: async (page = 1, limit = 10, filters?: any) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });

    const res = await fetch(`${API_BASE_URL}/permissions?${params}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch permissions");
    return res.json();
  },

  getById: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/permissions/${id}`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch permission");
    return res.json();
  },

  update: async (id: string, updateData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId = updateData?.currentUserId || updateData?.user_id;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    const res = await fetch(`${API_BASE_URL}/permissions/${id}`, {
      method: "PUT",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(updateData),
    });
    if (!res.ok) throw new Error("Failed to update permission");
    return res.json();
  },

  revoke: async (id: string, currentUserId: string) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (currentUserId) baseHeaders["x-user-id"] = currentUserId;

    const res = await fetch(`${API_BASE_URL}/permissions/${id}`, {
      method: "DELETE",
      headers: injectAuthHeaders(baseHeaders),
    });
    if (!res.ok) throw new Error("Failed to revoke permission");
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE_URL}/permissions/stats/summary`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch permission statistics");
    return res.json();
  },
};

// ==================== Health Check ====================
export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/../health`);
  if (!res.ok) throw new Error("API health check failed");
  return res.json();
}

// ==================== Digital Signature API ====================
export const digitalSignatureAPI = {
  sign: async (signData: any) => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const actingUserId = signData?.currentUserId || signData?.userId;
    if (actingUserId) baseHeaders["x-user-id"] = actingUserId;

    console.log("🔐 Calling digital signature API:", {
      url: `${API_BASE_URL}/digital-signature/sign`,
      headers: baseHeaders,
      body: signData,
    });

    const res = await fetch(`${API_BASE_URL}/digital-signature/sign`, {
      method: "POST",
      headers: injectAuthHeaders(baseHeaders),
      body: JSON.stringify(signData),
    });

    // Get response details for debugging
    const responseText = await res.text();
    console.log("📥 API Response:", {
      status: res.status,
      statusText: res.statusText,
      body: responseText,
    });

    if (!res.ok) {
      let errorMsg = "Failed to sign document";
      try {
        const errorData = JSON.parse(responseText);
        errorMsg =
          errorData.message || errorData.error || JSON.stringify(errorData);
      } catch {
        errorMsg = responseText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return JSON.parse(responseText);
  },

  downloadSigned: async (documentId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/digital-signature/download/${documentId}`,
      {
        headers: injectAuthHeaders(),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text || `Failed to download signed document (status ${res.status})`
      );
    }
    // Extract filename from Content-Disposition header if present
    const cd =
      res.headers.get("Content-Disposition") ||
      res.headers.get("content-disposition");
    let filename = "signed-document.pdf";
    if (cd) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      const extracted = decodeURIComponent(match?.[1] || match?.[2] || "");
      if (extracted) filename = extracted;
    }
    const blob = await res.blob();
    return { blob, filename };
  },

  verify: async (documentId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/digital-signature/verify/${documentId}`,
      {
        headers: injectAuthHeaders(),
      }
    );
    if (!res.ok) throw new Error("Failed to verify document");
    return res.json();
  },

  getHistory: async (documentId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/digital-signature/history/${documentId}`,
      {
        headers: injectAuthHeaders(),
      }
    );
    if (!res.ok) throw new Error("Failed to get signing history");
    return res.json();
  },

  checkHsmHealth: async () => {
    const res = await fetch(`${API_BASE_URL}/digital-signature/hsm-health`, {
      headers: injectAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to check HSM health");
    return res.json();
  },
};

// ==================== HSM File Signing API ====================
export const hsmFileSigningAPI = {
  /**
   * Gửi file lên HSM để ký số
   */
  signFile: async (request: {
    fileId: string;
    keyId?: string;
    signerInfo: {
      signerName: string;
      signerEmail?: string;
      reason?: string;
      location?: string;
    };
    metadata?: Record<string, any>;
  }) => {
    const res = await fetch(`${API_BASE_URL}/hsm-file-signing/sign`, {
      method: "POST",
      headers: injectAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let errorMsg = "Failed to sign file with HSM";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  },

  /**
   * Lấy danh sách chữ ký của user
   */
  getSignatures: async (page = 1, limit = 20) => {
    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/signatures?page=${page}&limit=${limit}`,
      {
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) throw new Error("Failed to get signatures");
    return res.json();
  },

  /**
   * Tải file đã ký
   */
  downloadSignedFile: async (signatureId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/download/${signatureId}`,
      {
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text || `Failed to download signed file (status ${res.status})`
      );
    }

    // Extract filename from Content-Disposition header if present
    const cd =
      res.headers.get("Content-Disposition") ||
      res.headers.get("content-disposition");
    let filename = "hsm-signed-file.pdf";
    if (cd) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      const extracted = decodeURIComponent(match?.[1] || match?.[2] || "");
      if (extracted) filename = extracted;
    }

    const blob = await res.blob();
    return { blob, filename };
  },

  /**
   * Tạo cặp key mới trong HSM
   */
  generateKey: async (keyRequest: {
    keyType: string;
    keySize?: number;
    label?: string;
    usage?: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/hsm-file-signing/keys/generate`, {
      method: "POST",
      headers: injectAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(keyRequest),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let errorMsg = "Failed to generate HSM key";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  },

  /**
   * Lấy danh sách keys của user
   */
  listKeys: async (
    filters: {
      status?: string;
      keyType?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.keyType) params.append("keyType", filters.keyType);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());

    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/keys?${params.toString()}`,
      {
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) throw new Error("Failed to list HSM keys");
    return res.json();
  },

  /**
   * Lấy thông tin chi tiết key
   */
  getKey: async (keyId: string) => {
    const res = await fetch(`${API_BASE_URL}/hsm-file-signing/keys/${keyId}`, {
      headers: injectAuthHeaders(),
    });

    if (!res.ok) throw new Error("Failed to get HSM key");
    return res.json();
  },

  /**
   * Xóa key
   */
  deleteKey: async (keyId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/keys/${keyId}/delete`,
      {
        method: "POST",
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let errorMsg = "Failed to delete HSM key";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  },

  /**
   * Lấy trạng thái HSM
   */
  getStatus: async () => {
    const res = await fetch(`${API_BASE_URL}/hsm-file-signing/status`, {
      headers: injectAuthHeaders(),
    });

    if (!res.ok) throw new Error("Failed to get HSM status");
    return res.json();
  },

  /**
   * Lấy danh sách HSM slots
   */
  listSlots: async () => {
    const res = await fetch(`${API_BASE_URL}/hsm-file-signing/slots`, {
      headers: injectAuthHeaders(),
    });

    if (!res.ok) throw new Error("Failed to list HSM slots");
    return res.json();
  },

  /**
   * Lấy logs từ HSM
   */
  getLogs: async (
    filters: {
      operation?: string;
      keyId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/logs?${params.toString()}`,
      {
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) throw new Error("Failed to get HSM logs");
    return res.json();
  },

  /**
   * Lấy signing logs từ HSM
   */
  getSigningLogs: async (
    filters: {
      keyId?: string;
      userId?: string;
      fileId?: string;
      verificationStatus?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const res = await fetch(
      `${API_BASE_URL}/hsm-file-signing/logs/signed?${params.toString()}`,
      {
        headers: injectAuthHeaders(),
      }
    );

    if (!res.ok) throw new Error("Failed to get HSM signing logs");
    return res.json();
  },
};
