import type { ReactNode } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import type { Permission } from "../../types";

export interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render an action (button, column, section) based on a
 * centralized permission instead of hard-coding a role check.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}
