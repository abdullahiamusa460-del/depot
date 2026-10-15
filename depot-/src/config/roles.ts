import type { Role } from "../types";

export interface RoleMeta {
  label: string;
  short: string;
  badge: string;
  tone: "primary" | "info";
  blurb: string;
}

export const roleMeta: Record<Role, RoleMeta> = {
  admin: {
    label: "Administrator",
    short: "Admin",
    badge: "Full access",
    tone: "primary",
    blurb: "Manage the whole shop",
  },
  staff: {
    label: "Shop Staff",
    short: "Staff",
    badge: "Limited access",
    tone: "info",
    blurb: "Sell and handle stock",
  },
};

export const roleOrder: Role[] = ["admin", "staff"];
