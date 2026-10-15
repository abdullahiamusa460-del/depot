/**
 * Translation layer between the backend API DTOs (`src/lib/api.ts`) and the
 * frontend domain types (`src/types`).
 *
 * The backend uses lowercase enum values and slightly different field names, so
 * every value crossing the network boundary is mapped here in both directions.
 */

import type {
  ApiCategory,
  ApiProduct,
  ApiSale,
  ApiSettings,
  ApiTransaction,
  ApiUser,
} from "./api";
import type {
  AuthSession,
  BusinessSettings,
  Category,
  InventoryTransaction,
  PaymentMethod,
  Permission,
  Product,
  Sale,
  StaffAccount,
  StockReason,
  Unit,
} from "../types";
import { imageForSku } from "../config/productImages";

const UNIT_FROM_API: Record<string, Unit> = {
  bottle: "Bottle",
  can: "Can",
  piece: "Piece",
  pack: "Pack",
  crate: "Crate",
  carton: "Carton",
  case: "Case",
  other: "Other",
};

const UNIT_TO_API: Record<Unit, string> = {
  Bottle: "bottle",
  Can: "can",
  Piece: "piece",
  Pack: "pack",
  Crate: "crate",
  Carton: "carton",
  Case: "case",
  Other: "other",
};

const PAYMENT_FROM_API: Record<string, PaymentMethod> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  pos: "POS",
  other: "Other",
};

const PAYMENT_TO_API: Record<PaymentMethod, string> = {
  Cash: "cash",
  "Bank Transfer": "bank_transfer",
  POS: "pos",
  Other: "other",
};

const REASON_FROM_API: Record<string, StockReason> = {
  received: "Stock received",
  sale: "Sale",
  return: "Return",
  damaged: "Damaged",
  expired: "Expired",
  adjustment: "Manual adjustment",
  correction: "Correction",
};

const REASON_TO_API: Record<StockReason, string> = {
  "Stock received": "received",
  Sale: "sale",
  Return: "return",
  Damaged: "damaged",
  Expired: "expired",
  "Manual adjustment": "adjustment",
  Correction: "correction",
};

const CATEGORY_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export function toUnit(value: string | undefined): Unit {
  return UNIT_FROM_API[(value ?? "").toLowerCase()] ?? "Other";
}

export function fromUnit(value: Unit): string {
  return UNIT_TO_API[value] ?? "other";
}

export function toPaymentMethod(value: string | undefined): PaymentMethod {
  return PAYMENT_FROM_API[(value ?? "").toLowerCase()] ?? "Cash";
}

export function fromPaymentMethod(value: PaymentMethod): string {
  return PAYMENT_TO_API[value] ?? "cash";
}

export function toStockReason(value: string | undefined): StockReason {
  return REASON_FROM_API[(value ?? "").toLowerCase()] ?? "Manual adjustment";
}

export function fromStockReason(value: StockReason): string {
  return REASON_TO_API[value] ?? "adjustment";
}

function categoryRefId(ref: ApiProduct["category"]): string {
  if (ref && typeof ref === "object") return ref._id;
  return ref ?? "";
}

export function toCategory(dto: ApiCategory): Category {
  return {
    id: dto._id,
    name: dto.name,
    description: dto.description ?? "",
    color: colorForName(dto.name),
    createdAt: dto.createdAt,
  };
}

export function toProduct(dto: ApiProduct): Product {
  const categoryId = categoryRefId(dto.category);
  const sku = dto.sku ?? "";
  return {
    id: dto._id,
    name: dto.name,
    brand: dto.brand ?? "",
    categoryId,
    description: dto.description ?? "",
    sku,
    barcode: dto.barcode ?? "",
    image: dto.imageUrl || imageForSku(sku),
    unit: toUnit(dto.sellingUnit),
    price: dto.price,
    cost: dto.costPrice,
    stock: dto.stock,
    minStock: dto.minStock,
    active: dto.status !== "inactive",
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function toSale(dto: ApiSale): Sale {
  return {
    id: dto._id,
    invoiceNo: dto.invoiceNumber,
    items: (dto.items ?? []).map((item) => ({
      productId: item.product,
      name: item.name,
      unit: toUnit(item.sellingUnit),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      cost: item.costPrice,
      discount: item.discount,
    })),
    subtotal: dto.subtotal,
    discount: dto.discount,
    tax: dto.tax ?? 0,
    total: dto.total,
    amountPaid: dto.amountPaid,
    change: dto.change,
    paymentMethod: toPaymentMethod(dto.paymentMethod),
    customer: {
      name: dto.customer?.name ?? "",
      phone: dto.customer?.phone ?? "",
    },
    createdAt: dto.createdAt,
  };
}

export function toTransaction(dto: ApiTransaction): InventoryTransaction {
  const ref = dto.product;
  const productId = ref && typeof ref === "object" ? ref._id : (ref ?? "");
  const productName = ref && typeof ref === "object" ? ref.name : "";
  return {
    id: dto._id,
    productId,
    productName,
    previousQty: dto.previousQuantity,
    change: dto.quantityChange,
    newQty: dto.newQuantity,
    type: toStockReason(dto.type),
    reason: dto.reason ?? "",
    createdAt: dto.createdAt,
  };
}

export function toSettings(dto: ApiSettings): BusinessSettings {
  const methods = (dto.paymentMethods ?? []).map(toPaymentMethod);
  return {
    shopName: dto.shopName ?? "",
    logo: dto.logoUrl || undefined,
    address: dto.address ?? "",
    phone: dto.phone ?? "",
    email: dto.email ?? "",
    website: dto.website ?? "",
    currencySymbol: dto.currencySymbol ?? "$",
    currencyCode: dto.currency ?? "USD",
    invoicePrefix: dto.invoicePrefix ?? "INV",
    defaultPaymentMethod: toPaymentMethod(dto.defaultPaymentMethod),
    receiptFooter: dto.receiptFooter ?? "",
    lowStockDefault: dto.lowStockDefault ?? 10,
    taxRate: dto.taxPercent ?? 0,
    paymentMethods: methods.length > 0 ? methods : ["Cash", "Bank Transfer"],
  };
}

export function toStaffAccount(dto: ApiUser, permissions: Permission[]): StaffAccount {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.role,
    active: dto.active,
    permissions,
    createdAt: dto.createdAt,
  };
}

export function toSession(dto: ApiUser): AuthSession {
  return {
    accountId: dto.id,
    role: dto.role,
    name: dto.name,
    email: dto.email,
    loginAt: new Date().toISOString(),
  };
}

export function productInputToApi(input: {
  name: string;
  brand: string;
  categoryId: string;
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
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: input.name,
    brand: input.brand,
    category: input.categoryId || undefined,
    description: input.description,
    sku: input.sku || undefined,
    barcode: input.barcode || undefined,
    sellingUnit: fromUnit(input.unit),
    price: input.price,
    costPrice: input.cost,
    stock: input.stock,
    minStock: input.minStock,
    status: input.active ? "active" : "inactive",
  };
  if (input.image !== undefined) {
    // Relative asset paths, http(s) links and locally stored `data:image/…`
    // photos all pass through; an empty string clears the stored image.
    body.imageUrl = input.image.trim();
  }
  return body;
}

export function categoryInputToApi(input: {
  name: string;
  description: string;
}): { name: string; description: string } {
  return { name: input.name, description: input.description };
}

export function settingsPatchToApi(
  patch: Partial<BusinessSettings>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.shopName !== undefined) body.shopName = patch.shopName;
  if (patch.logo !== undefined) body.logoUrl = patch.logo;
  if (patch.address !== undefined) body.address = patch.address;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.website !== undefined) body.website = patch.website;
  if (patch.currencyCode !== undefined) body.currency = patch.currencyCode;
  if (patch.currencySymbol !== undefined)
    body.currencySymbol = patch.currencySymbol;
  if (patch.invoicePrefix !== undefined)
    body.invoicePrefix = patch.invoicePrefix;
  if (patch.defaultPaymentMethod !== undefined)
    body.defaultPaymentMethod = fromPaymentMethod(patch.defaultPaymentMethod);
  if (patch.receiptFooter !== undefined) body.receiptFooter = patch.receiptFooter;
  if (patch.lowStockDefault !== undefined)
    body.lowStockDefault = patch.lowStockDefault;
  if (patch.taxRate !== undefined) body.taxPercent = patch.taxRate;
  if (patch.paymentMethods !== undefined)
    body.paymentMethods = patch.paymentMethods.map(fromPaymentMethod);
  return body;
}
