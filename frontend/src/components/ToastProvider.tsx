"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  createdAt?: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  // Notifications history for the bell dropdown
  history: ToastItem[];
  unreadCount: number;
  markAllRead: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function iconFor(type: ToastType) {
  const base = "w-4 h-4";
  switch (type) {
    case "success":
      return (
        <svg
          className={`${base} text-green-600`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "error":
      return (
        <svg
          className={`${base} text-red-600`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      );
    case "warning":
      return (
        <svg
          className={`${base} text-amber-600`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      );
    default:
      return (
        <svg
          className={`${base} text-blue-600`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
      );
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [history, setHistory] = useState<ToastItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const push = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = Date.now();
      const toast: ToastItem = { id, type, message, duration, createdAt };
      setToasts((prev) => [...prev, toast]);
      setHistory((prev) => [toast, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      // Auto dismiss
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      success: (m, d) => push("success", m, d),
      error: (m, d) => push("error", m, d),
      info: (m, d) => push("info", m, d),
      warning: (m, d) => push("warning", m, d),
      history,
      unreadCount,
      markAllRead: () => setUnreadCount(0),
      clearHistory: () => setHistory([]),
      removeFromHistory: (id: string) =>
        setHistory((prev) => prev.filter((x) => x.id !== id)),
    }),
    [push, history, unreadCount]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast stack container */}
      <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 w-[320px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 rounded-lg border shadow-sm p-3 bg-white ${
              t.type === "success"
                ? "border-green-200"
                : t.type === "error"
                ? "border-red-200"
                : t.type === "warning"
                ? "border-amber-200"
                : "border-blue-200"
            }`}
          >
            <div className="mt-0.5">{iconFor(t.type)}</div>
            <div className="text-sm text-gray-800 leading-5 flex-1">
              {t.message}
            </div>
            <button
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
