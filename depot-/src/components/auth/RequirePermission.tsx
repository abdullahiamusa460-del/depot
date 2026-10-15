import type { ReactNode } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import type { Permission } from "../../types";
import { AccessDenied } from "./AccessDenied";

export interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const { can } = usePermissions();
  if (!can(permission)) return <AccessDenied permission={permission} />;
  return <>{children}</>;
}
