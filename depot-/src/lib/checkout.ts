import type { Product, SaleItem } from "../types";
import { cartSubtotal } from "./cart";

/**
 * Single source of truth for sale maths. Both the payment dialog preview and
 * the recorded sale go through this so what the cashier sees always matches
 * what is stored.
 */
export interface SaleTotalsInput {
  discount?: number;
  applyTax?: boolean;
  taxRate?: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

export function computeSaleTotals(
  items: SaleItem[],
  input: SaleTotalsInput = {},
): SaleTotals {
  const subtotal = cartSubtotal(items);
  const discount = Math.min(Math.max(0, input.discount ?? 0), subtotal);
  const taxable = subtotal - discount;
  const rate = input.taxRate ?? 0;
  const tax = input.applyTax && rate > 0 ? Math.round(taxable * (rate / 100)) : 0;
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export interface StockCheckResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate that every cart line can actually be sold: the product still
 * exists, is active, and there is enough stock on hand.
 */
export function validateSaleStock(
  items: SaleItem[],
  products: Product[],
): StockCheckResult {
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return { ok: false, error: `${item.name} is no longer available.` };
    }
    if (!product.active) {
      return { ok: false, error: `${item.name} is inactive and cannot be sold.` };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { ok: false, error: `${item.name} has an invalid quantity.` };
    }
    if (item.quantity > product.stock) {
      return {
        ok: false,
        error: `Only ${product.stock} ${product.unit.toLowerCase()}(s) of ${product.name} in stock.`,
      };
    }
  }
  return { ok: true };
}
