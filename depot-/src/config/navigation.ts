import {
  ArrowDownUp,
  BarChart3,
  Boxes,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ReceiptText,
  ScanBarcode,
  Tags,
  DatabaseBackup,
  Settings2,
  Users,
} from "lucide-react";
import type { Permission, Role } from "../types";
import { rolePermissions } from "./permissions";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  description: string;
  permission: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        description: "Shop performance at a glance",
        permission: "dashboard.view",
      },
      {
        label: "Point of Sale",
        to: "/pos",
        icon: ScanBarcode,
        description: "Sell products fast",
        permission: "pos.sell",
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        label: "Products",
        to: "/products",
        icon: Package,
        description: "Manage beverage products",
        permission: "products.view",
      },
      {
        label: "Categories",
        to: "/categories",
        icon: Tags,
        description: "Organize your catalog",
        permission: "categories.manage",
      },
      {
        label: "Inventory",
        to: "/inventory",
        icon: Boxes,
        description: "Stock levels and history",
        permission: "inventory.view",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Sales",
        to: "/sales",
        icon: ReceiptText,
        description: "Transaction history",
        permission: "sales.view",
      },
      {
        label: "Reports",
        to: "/reports",
        icon: BarChart3,
        description: "Sales and stock analytics",
        permission: "reports.view",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Team & Permissions",
        to: "/team",
        icon: Users,
        description: "Manage staff accounts and access",
        permission: "staff.manage",
      },
      {
        label: "Settings",
        to: "/settings",
        icon: Settings2,
        description: "Shop and appearance settings",
        permission: "settings.manage",
      },
      {
        label: "Backup & Restore",
        to: "/backup",
        icon: DatabaseBackup,
        description: "Protect your data",
        permission: "backup.manage",
      },
    ],
  },
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);

export interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
}

export const quickActions: QuickAction[] = [
  { label: "New sale", to: "/pos", icon: ScanBarcode, permission: "pos.sell" },
  {
    label: "Add product",
    to: "/products",
    icon: Package,
    permission: "products.manage",
  },
  {
    label: "Receive stock",
    to: "/inventory",
    icon: ArrowDownUp,
    permission: "inventory.adjust",
  },
];

export function hasAnyPermission(
  permissions: Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

export function navItemsForPermissions(permissions: Permission[]): NavItem[] {
  return navItems.filter((item) => hasAnyPermission(permissions, item.permission));
}

export function navSectionsForPermissions(
  permissions: Permission[],
): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        hasAnyPermission(permissions, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function navItemsForRole(role: Role): NavItem[] {
  return navItemsForPermissions(rolePermissions[role]);
}

export function navSectionsForRole(role: Role): NavSection[] {
  return navSectionsForPermissions(rolePermissions[role]);
}

export function landingPathForPermissions(permissions: Permission[]): string {
  return navItemsForPermissions(permissions)[0]?.to ?? "/";
}

export function landingPathForRole(role: Role): string {
  return landingPathForPermissions(rolePermissions[role]);
}

export function quickActionsForPermissions(permissions: Permission[]): QuickAction[] {
  return quickActions.filter((action) =>
    hasAnyPermission(permissions, action.permission),
  );
}

export function quickActionsForRole(role: Role): QuickAction[] {
  return quickActionsForPermissions(rolePermissions[role]);
}
