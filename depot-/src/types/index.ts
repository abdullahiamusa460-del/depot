export type ID = string;

export type ThemeMode = "light" | "dark" | "system";

export type Role = "admin" | "staff";

export type Permission =
  | "dashboard.view"
  | "pos.sell"
  | "products.view"
  | "products.manage"
  | "categories.manage"
  | "inventory.view"
  | "inventory.adjust"
  | "sales.view"
  | "sales.viewFinancials"
  | "reports.view"
  | "settings.manage"
  | "staff.manage"
  | "backup.manage";

export interface StaffAccount {
  id: ID;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  permissions: Permission[];
  createdAt: string;
}

export interface StaffInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  active?: boolean;
}

export interface AuthSession {
  accountId: ID;
  role: Role;
  name: string;
  email: string;
  loginAt: string;
}

export type Unit =
  | "Bottle"
  | "Can"
  | "Piece"
  | "Pack"
  | "Crate"
  | "Carton"
  | "Case"
  | "Other";

export const UNITS: Unit[] = [
  "Bottle",
  "Can",
  "Piece",
  "Pack",
  "Crate",
  "Carton",
  "Case",
  "Other",
];

export type PaymentMethod = "Cash" | "Bank Transfer" | "POS" | "Other";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "POS",
  "Other",
];

export type StockReason =
  | "Stock received"
  | "Sale"
  | "Return"
  | "Damaged"
  | "Expired"
  | "Manual adjustment"
  | "Correction";

export const STOCK_REASONS: StockReason[] = [
  "Stock received",
  "Return",
  "Damaged",
  "Expired",
  "Manual adjustment",
  "Correction",
];

export interface Category {
  id: ID;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface Product {
  id: ID;
  name: string;
  brand: string;
  categoryId: ID;
  description: string;
  sku: string;
  barcode: string;
  image?: string;
  unit: Unit;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export interface InventoryTransaction {
  id: ID;
  productId: ID;
  productName: string;
  previousQty: number;
  change: number;
  newQty: number;
  type: StockReason;
  reason: string;
  createdAt: string;
}

export interface SaleItem {
  productId: ID;
  name: string;
  unit: Unit;
  quantity: number;
  unitPrice: number;
  cost: number;
  discount: number;
}

export interface Sale {
  id: ID;
  invoiceNo: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: PaymentMethod;
  customer: { name: string; phone: string };
  createdAt: string;
}

export interface CartLine {
  productId: ID;
  quantity: number;
  discount: number;
}

export interface BusinessSettings {
  shopName: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  currencySymbol: string;
  currencyCode: string;
  invoicePrefix: string;
  defaultPaymentMethod: PaymentMethod;
  receiptFooter: string;
  lowStockDefault: number;
  taxRate: number;
  paymentMethods: PaymentMethod[];
}

export interface Notification {
  id: ID;
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "danger";
  createdAt: string;
  read: boolean;
}

export type ToastLevel = "info" | "success" | "warning" | "danger";

export interface Toast {
  id: ID;
  title: string;
  message?: string;
  level: ToastLevel;
}

export interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    categories: unknown[];
    products: unknown[];
    sales: unknown[];
    inventoryTransactions: unknown[];
    settings: unknown;
  };
}
