"use client";

import {
  Home,
  FileText,
  Clock,
  Users,
  Info,
  Lock,
  Shield,
  FileCheck,
  Briefcase,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/contexts/PermissionsContext";

interface MenuItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  path: string;
  requirePermission?: boolean;
  module?: string;
  action?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const { hasPermission, user, loading } = usePermissions();

  const allMenuItems: MenuItem[] = [
    {
      icon: Home,
      label: t("overview"),
      path: "/",
      module: "overview",
      action: "read",
    },
    {
      icon: Briefcase,
      label: "Workspace",
      path: "/workspace",
      requirePermission: false, // Accessible to all users
    },
    {
      icon: Clock,
      label: t("history"),
      path: "/history",
      module: "history",
      action: "read",
    },
    {
      icon: Users,
      label: t("users"),
      path: "/users",
      module: "users",
      action: "read",
    },
    {
      icon: Info,
      label: t("companyInfo"),
      path: "/company",
      module: "company_info",
      action: "read",
    },
  ];

  const allSettingItems: MenuItem[] = [
    {
      icon: Lock,
      label: t("permissions"),
      path: "/permissions",
      module: "permissions",
      action: "read",
    },
    {
      icon: FileText,
      label: t("documentTypes"),
      path: "/document-types",
      module: "document",
      action: "read",
    },
    {
      icon: Shield,
      label: t("authentication"),
      path: "/authentication",
      requirePermission: false, // Authentication settings accessible to all
    },
  ];

  const allOthersItems: MenuItem[] = [
    {
      icon: FileCheck,
      label: t("verifyDocument"),
      path: "/verify",
      module: "verify",
      action: "read",
    },
  ];

  // Check if user is admin or super admin
  const isAdmin =
    user?.is_super_admin || user?.role_name?.toLowerCase() === "admin";

  // Filter menu items based on permissions
  // Show all items if loading or if user is admin
  const menuItems =
    loading || isAdmin
      ? allMenuItems
      : allMenuItems.filter((item) => {
          if (item.requirePermission === false) return true;
          if (item.module && item.action) {
            return hasPermission(item.module, item.action);
          }
          return false;
        });

  const settingItems =
    loading || isAdmin
      ? allSettingItems
      : allSettingItems.filter((item) => {
          if (item.requirePermission === false) return true;
          if (item.module && item.action) {
            return hasPermission(item.module, item.action);
          }
          return false;
        });

  const othersItems =
    loading || isAdmin
      ? allOthersItems
      : allOthersItems.filter((item) => {
          if (item.requirePermission === false) return true;
          if (item.module && item.action) {
            return hasPermission(item.module, item.action);
          }
          return false;
        });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">DS</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Digital Signature</h1>
        </div>

        <nav className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t("menu")}
            </p>
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t("setting")}
            </p>
            <ul className="space-y-1">
              {settingItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t("others")}
            </p>
            <ul className="space-y-1">
              {othersItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
}
