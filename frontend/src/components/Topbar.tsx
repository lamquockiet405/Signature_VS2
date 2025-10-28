"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Bell, Moon, Menu, X, User, Settings, LogOut, LogIn } from "lucide-react";
import { useToast } from "./ToastProvider";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import { authAPI } from "@/lib/api";
import { useRouter } from "next/navigation";
import ClientOnly from "./ClientOnly";
import Link from "next/link";
import { usePermissions } from "@/contexts/PermissionsContext";

export default function Topbar() {
  const { history, unreadCount, markAllRead, removeFromHistory, clearHistory } =
    useToast();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("common");
  const router = useRouter();
  const { user, loading } = usePermissions();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 right-0 left-64 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left Section with Menu & Search */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          {/* Hamburger Menu Icon */}
          <button className="p-2 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors">
            <Menu size={20} className="text-gray-600" />
          </button>

          {/* Search Bar */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder={t("search")}
              className="w-full pl-10 pr-20 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded">
              ⌘ K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-4 relative">
          {/* Language Switcher */}
          <LanguageSwitcher />

          <button className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors">
            <Moon size={20} className="text-gray-600" />
          </button>
          <div className="relative">
            <button
              onClick={() => {
                setOpen((o) => !o);
                markAllRead();
              }}
              className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors relative"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[10px] leading-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-900">
                    {t("notifications")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => markAllRead()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {t("markAllRead")}
                    </button>
                    <button
                      onClick={() => clearHistory()}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {t("clearAll")}
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-auto divide-y divide-gray-100">
                  {history.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      {t("noData")}
                    </div>
                  ) : (
                    history.map((n) => (
                      <div key={n.id} className="p-3 flex items-start gap-2">
                        <div
                          className={`mt-1 w-2 h-2 rounded-full ${
                            n.type === "success"
                              ? "bg-green-500"
                              : n.type === "error"
                              ? "bg-red-500"
                              : n.type === "warning"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                        ></div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-800">
                            {n.message}
                          </div>
                          {n.createdAt && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(n.createdAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                        <button
                          aria-label="Dismiss"
                          className="text-gray-300 hover:text-gray-500"
                          onClick={() => removeFromHistory(n.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200 relative">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <ClientOnly fallback={<span className="text-white font-semibold text-sm">U</span>}>
                  <span className="text-white font-semibold text-sm">
                    {user ? (user?.full_name || user?.username || "U").charAt(0) : "?"}
                  </span>
                </ClientOnly>
              </div>
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <ClientOnly fallback={<span className="text-sm font-medium text-gray-900">User</span>}>
                    <span className="text-sm font-medium text-gray-900">
                      {user ? (user?.full_name || user?.username || "User") : "Guest"}
                    </span>
                  </ClientOnly>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      {user ? (
                        // Authenticated user menu
                        <>
                          {/* Profile Link */}
                          <Link
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <User size={16} className="text-gray-500" />
                            <span>Hồ sơ cá nhân</span>
                          </Link>
                          
                          {/* Settings Link */}
                          <Link
                            href="/settings"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Settings size={16} className="text-gray-500" />
                            <span>Cài đặt</span>
                          </Link>
                          
                          {/* Divider */}
                          <div className="border-t border-gray-100 my-1"></div>
                          
                          {/* Logout Button */}
                          <button
                            onClick={async () => {
                              try {
                                await authAPI.logout();
                                toast.success(t("success.logoutSuccess"));
                                router.push("/signin");
                              } catch {
                                window.location.href = "/signin";
                              }
                              setUserMenuOpen(false);
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                          >
                            <LogOut size={16} className="text-red-500" />
                            <span>Đăng xuất</span>
                          </button>
                        </>
                      ) : (
                        // Non-authenticated user menu
                        <>
                          {/* Login Button */}
                          <Link
                            href="/signin"
                            className="flex items-center gap-3 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <LogIn size={16} className="text-blue-500" />
                            <span>Đăng nhập</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
