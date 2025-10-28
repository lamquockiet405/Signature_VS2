"use client";

import { usePermissions } from "@/contexts/PermissionsContext";

interface ProtectedProps {
  module: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Protected Component - Only render children if user has permission
 * Usage: <Protected module="documents" action="create">...</Protected>
 */
export function Protected({
  module,
  action,
  children,
  fallback,
}: ProtectedProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return fallback || null;
  }

  if (!hasPermission(module, action)) {
    return fallback || null;
  }

  return <>{children}</>;
}

/**
 * ProtectedButton - Disable button if user doesn't have permission
 * Usage: <ProtectedButton module="documents" action="create">...</ProtectedButton>
 */
export function ProtectedButton({
  module,
  action,
  children,
  className = "",
  onClick,
  ...props
}: ProtectedProps & {
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}) {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(module, action);

  return (
    <button
      className={`${className} ${
        !allowed ? "opacity-50 cursor-not-allowed" : ""
      }`}
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      title={!allowed ? "Bạn không có quyền thực hiện hành động này" : ""}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * NoPermissionMessage - Show when user has no permissions at all
 */
export function NoPermissionMessage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="mb-4">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Không có quyền truy cập
        </h2>
        <p className="text-gray-600 mb-4">
          Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ với quản
          trị viên để được cấp quyền.
        </p>
        <div className="text-sm text-gray-500">
          Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ bộ phận hỗ trợ.
        </div>
      </div>
    </div>
  );
}

/**
 * PagePermissionGuard - Wrap entire page to check permission
 * Shows message if no permission
 */
export function PagePermissionGuard({
  module,
  action,
  children,
}: ProtectedProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasPermission(module, action)) {
    return <NoPermissionMessage />;
  }

  return <>{children}</>;
}
