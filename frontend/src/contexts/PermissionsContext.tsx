"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "@/lib/api";

interface Permission {
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role_name?: string;
  role_description?: string;
  is_super_admin?: boolean;
}

interface PermissionsContextType {
  user: User | null;
  permissions: Permission[];
  hasPermission: (module: string, action: string) => boolean;
  hasAnyPermission: () => boolean;
  loadPermissions: () => Promise<void>;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  user: null,
  permissions: [],
  hasPermission: () => false,
  hasAnyPermission: () => false,
  loadPermissions: async () => {},
  loading: true,
});

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      if (!token) {
        setUser(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      const data = await authAPI.getMe();
      console.log("📊 User permissions loaded:", data);
      console.log("👤 User:", data.user);
      console.log("🔑 Permissions array:", data.permissions);
      console.log("📋 Number of permissions:", data.permissions?.length || 0);

      setUser(data.user);
      setPermissions(data.permissions || []);
    } catch (error) {
      console.error("Failed to load permissions:", error);
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();

    // Listen for storage changes (login/logout from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "access_token") {
        loadPermissions();
      }
    };

    // Listen for custom login event
    const handleLoginEvent = () => {
      loadPermissions();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userLoggedIn", handleLoginEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userLoggedIn", handleLoginEvent);
    };
  }, []);

  const hasPermission = (module: string, action: string): boolean => {
    // Super admin has all permissions
    if (user?.is_super_admin) {
      return true;
    }

    // Normalize module name to lowercase
    const normalizedModule = module.toLowerCase();

    // Find permission for this module
    const perm = permissions.find(
      (p) => p.module.toLowerCase() === normalizedModule
    );

    if (!perm) {
      return false;
    }

    // Check specific action
    const actionKey = `can_${action}` as keyof Permission;
    return Boolean(perm[actionKey]);
  };

  const hasAnyPermission = (): boolean => {
    // Super admin always has permissions
    if (user?.is_super_admin) {
      return true;
    }

    // Check if user has at least one permission
    return permissions.some(
      (p) =>
        p.can_create ||
        p.can_read ||
        p.can_update ||
        p.can_delete ||
        p.can_approve
    );
  };

  return (
    <PermissionsContext.Provider
      value={{
        user,
        permissions,
        hasPermission,
        hasAnyPermission,
        loadPermissions,
        loading,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return context;
}
