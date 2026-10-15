import type { Permission, Role } from "../types";

/**
 * Central permission definitions for the whole application.
 *
 * Every role check anywhere in the UI should go through these helpers (or the
 * `usePermissions()` hook / `<Can>` component that wrap them) instead of
 * hard-coding role names. Add a permission here and grant it to roles below and
 * the rest of the app can use it without further edits.
 */

export interface PermissionMeta {
  label: string;
  description: string;
  group: PermissionGroup;
}

export type PermissionGroup =
  | "Operations"
  | "Catalog"
  | "Business"
  | "Administration";

export const permissionGroups: PermissionGroup[] = [
  "Operations",
  "Catalog",
  "Business",
  "Administration",
];

export const permissionMeta: Record<Permission, PermissionMeta> = {
  "dashboard.view": {
    label: "View dashboard",
    description: "See shop performance summaries and alerts.",
    group: "Operations",
  },
  "pos.sell": {
    label: "Process sales (POS)",
    description:
      "Search products, build a cart, calculate totals and change, take payment and print receipts.",
    group: "Operations",
  },
  "products.view": {
    label: "View products",
    description: "Browse and search the product catalog.",
    group: "Catalog",
  },
  "products.manage": {
    label: "Manage products",
    description: "Add, edit and delete products, and change prices.",
    group: "Catalog",
  },
  "categories.manage": {
    label: "Manage categories",
    description: "Create, edit and delete product categories.",
    group: "Catalog",
  },
  "inventory.view": {
    label: "View inventory",
    description: "See stock levels and movement history.",
    group: "Catalog",
  },
  "inventory.adjust": {
    label: "Adjust inventory",
    description: "Receive and adjust stock quantities.",
    group: "Catalog",
  },
  "sales.view": {
    label: "View sales",
    description: "Review transactions and reprint receipts.",
    group: "Business",
  },
  "sales.viewFinancials": {
    label: "View financials",
    description: "See revenue, cost and profit figures.",
    group: "Business",
  },
  "reports.view": {
    label: "View reports",
    description: "Open sales and stock analytics.",
    group: "Business",
  },
  "settings.manage": {
    label: "Manage settings",
    description: "Change shop, sales, currency and appearance settings.",
    group: "Administration",
  },
  "staff.manage": {
    label: "Manage staff",
    description: "Create staff accounts and assign their permissions.",
    group: "Administration",
  },
  "backup.manage": {
    label: "Backup & restore",
    description: "Export, import and reset shop data.",
    group: "Administration",
  },
};

export const ALL_PERMISSIONS = Object.keys(permissionMeta) as Permission[];

/**
 * Default permission sets per role. Administrators always receive every
 * permission; staff receive the operational subset below. Individual staff
 * accounts can be granted or revoked additional permissions from the Team page.
 */
export const rolePermissions: Record<Role, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  staff: [
    "dashboard.view",
    "pos.sell",
    "products.view",
    "inventory.view",
    "sales.view",
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return [...rolePermissions[role]];
}

/**
 * Resolve the permission set for an account. Administrators always get every
 * permission (so a shop can never lock itself out); staff accounts use their
 * explicit grants, falling back to the role defaults when none are provided.
 */
export function effectivePermissions(
  role: Role,
  accountPermissions?: Permission[],
): Permission[] {
  if (role === "admin") return [...ALL_PERMISSIONS];
  if (accountPermissions && accountPermissions.length > 0) {
    return [...accountPermissions];
  }
  return permissionsForRole(role);
}

export function roleHasPermission(
  role: Role | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return rolePermissions[role].includes(permission);
}

export function isKnownPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function permissionLabel(permission: Permission): string {
  return permissionMeta[permission].label;
}
