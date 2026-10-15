import { useApp } from "./useApp";
import type { AuthSession, Permission, Role } from "../types";

export interface PermissionsApi {
  session: AuthSession | null;
  role: Role | null;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
}

/**
 * Single source of truth for "may the current user do X?".
 * Never compare `role === "admin"` in feature code — use `can("some.permission")`.
 */
export function usePermissions(): PermissionsApi {
  const { session, role, permissions, can } = useApp();
  return { session, role, permissions, can };
}
