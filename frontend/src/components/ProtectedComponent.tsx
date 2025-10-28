"use client";

import { ReactNode } from "react";
import { hasPermission } from "@/lib/permissions";

interface ProtectedComponentProps {
  module: string;
  action: "create" | "read" | "update" | "delete" | "approve";
  children: ReactNode;
  fallback?: ReactNode;
  hideIfNoPermission?: boolean;
}

/**
 * ProtectedComponent - Wrapper component for permission-based rendering
 *
 * @param module - Module name (e.g., 'users', 'document', 'roles')
 * @param action - Action type (create, read, update, delete, approve)
 * @param children - Content to render if user has permission
 * @param fallback - Content to render if user doesn't have permission
 * @param hideIfNoPermission - If true, render nothing when no permission (default behavior)
 *
 * @example
 * // Hide button if no permission
 * <ProtectedComponent module="users" action="create">
 *   <button>Create User</button>
 * </ProtectedComponent>
 *
 * @example
 * // Show disabled button if no permission
 * <ProtectedComponent
 *   module="users"
 *   action="create"
 *   fallback={<button disabled>Create User</button>}
 * >
 *   <button>Create User</button>
 * </ProtectedComponent>
 */
export function ProtectedComponent({
  module,
  action,
  children,
  fallback = null,
  hideIfNoPermission = true,
}: ProtectedComponentProps) {
  const canAccess = hasPermission(module, action);

  if (!canAccess) {
    return hideIfNoPermission ? null : <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * ProtectedButton - Convenient wrapper for buttons
 */
interface ProtectedButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  module: string;
  action: "create" | "read" | "update" | "delete" | "approve";
  children: ReactNode;
  showDisabled?: boolean;
}

export function ProtectedButton({
  module,
  action,
  children,
  showDisabled = false,
  ...buttonProps
}: ProtectedButtonProps) {
  const canAccess = hasPermission(module, action);

  if (!canAccess && !showDisabled) {
    return null;
  }

  return (
    <button {...buttonProps} disabled={!canAccess}>
      {children}
    </button>
  );
}
