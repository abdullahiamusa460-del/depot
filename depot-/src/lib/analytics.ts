import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleItem,
  type Unit,
} from "../types";
import { lineTotal } from "./cart";
import { toDateKey } from "./format";

export interface Range {
  from: Date;
  to: Date;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function inRange(iso: string, range: Range): boolean {
  const time = new Date(iso).getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
}

export function filterSales(sales: Sale[], range: Range): Sale[] {
  return sales.filter((sale) => inRange(sale.createdAt, range));
}

export function sumRevenue(sales: Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.total, 0);
}

export function sumCost(sales: Sale[]): number {
  return sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + item.cost * item.quantity, 0),
    0,
  );
}

export function sumUnits(sales: Sale[]): number {
  return sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
}

export function averageTransaction(sales: Sale[]): number {
  if (sales.length === 0) return 0;
  return sumRevenue(sales) / sales.length;
}

export interface DailyPoint {
  key: string;
  label: string;
  value: number;
  transactions: number;
}

export function dailySeries(sales: Sale[], from: Date, to: Date): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  const cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor.getTime() <= last.getTime()) {
    const key = toDateKey(cursor.toISOString());
    map.set(key, {
      key,
      label: cursor.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      value: 0,
      transactions: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const sale of sales) {
    const key = toDateKey(sale.createdAt);
    const point = map.get(key);
    if (point) {
      point.value += sale.total;
      point.transactions += 1;
    }
  }
  return [...map.values()];
}

export interface ProductStat {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export function productStats(sales: Sale[]): ProductStat[] {
  const map = new Map<string, ProductStat>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = map.get(item.productId);
      const revenue = lineTotal(item);
      const profit = (item.unitPrice - item.cost) * item.quantity - item.discount;
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += revenue;
        existing.profit += profit;
      } else {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          revenue,
          profit,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function paymentBreakdown(
  sales: Sale[],
  methods: PaymentMethod[],
): { label: PaymentMethod; value: number }[] {
  const map = new Map<PaymentMethod, number>();
  methods.forEach((method) => map.set(method, 0));
  for (const sale of sales) {
    map.set(sale.paymentMethod, (map.get(sale.paymentMethod) ?? 0) + sale.total);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * The three core payment methods are always summarised (even at zero) so the
 * layout stays stable; any other method that actually took money is appended so
 * no takings are hidden.
 */
export const PRIMARY_PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "POS",
  "Bank Transfer",
];

export interface PaymentSummaryRow {
  method: PaymentMethod;
  total: number;
  transactions: number;
  /** Share of the total takings, as a whole percentage. */
  share: number;
}

export interface PaymentSummary {
  rows: PaymentSummaryRow[];
  total: number;
  transactions: number;
  average: number;
}

export function paymentSummary(sales: Sale[]): PaymentSummary {
  const totals = new Map<PaymentMethod, { total: number; transactions: number }>();
  for (const sale of sales) {
    const entry = totals.get(sale.paymentMethod) ?? { total: 0, transactions: 0 };
    entry.total += sale.total;
    entry.transactions += 1;
    totals.set(sale.paymentMethod, entry);
  }

  const order: PaymentMethod[] = [];
  for (const method of [...PRIMARY_PAYMENT_METHODS, ...PAYMENT_METHODS]) {
    if (!order.includes(method)) order.push(method);
  }

  const rows: PaymentSummaryRow[] = order
    .filter(
      (method) => PRIMARY_PAYMENT_METHODS.includes(method) || totals.has(method),
    )
    .map((method) => {
      const entry = totals.get(method);
      return {
        method,
        total: entry?.total ?? 0,
        transactions: entry?.transactions ?? 0,
        share: 0,
      };
    });

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const transactions = rows.reduce((sum, row) => sum + row.transactions, 0);
  for (const row of rows) {
    row.share = total > 0 ? Math.round((row.total / total) * 100) : 0;
  }

  return {
    rows,
    total,
    transactions,
    average: transactions > 0 ? total / transactions : 0,
  };
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  value: number;
}

export function categoryStats(
  categories: { id: string; name: string }[],
  products: Product[],
  sales: Sale[],
): CategoryStat[] {
  const productCategory = new Map(products.map((p) => [p.id, p.categoryId]));
  const totals = new Map<string, number>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const categoryId = productCategory.get(item.productId);
      if (!categoryId) continue;
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + lineTotal(item));
    }
  }
  return categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      value: totals.get(category.id) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function inventoryValue(products: Product[]): number {
  return products.reduce((sum, product) => sum + product.cost * product.stock, 0);
}

export function retailValue(products: Product[]): number {
  return products.reduce((sum, product) => sum + product.price * product.stock, 0);
}

export interface UnitStock {
  unit: Unit;
  quantity: number;
  products: number;
  costValue: number;
  retailValue: number;
}

export interface StockSummary {
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  totalProfit: number;
  marginPercent: number;
  productCount: number;
  inStockCount: number;
  outOfStockCount: number;
  byUnit: UnitStock[];
}

function quantityOnHand(product: Pick<Product, "stock">): number {
  if (!Number.isFinite(product.stock)) return 0;
  return Math.max(0, Math.floor(product.stock));
}

function finiteMoney(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function stockSummary(products: Product[]): StockSummary {
  const unitMap = new Map<Unit, UnitStock>();
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;

  for (const product of products) {
    const quantity = quantityOnHand(product);
    const costValue = quantity * finiteMoney(product.cost);
    const retailValue = quantity * finiteMoney(product.price);

    totalUnits += quantity;
    totalCostValue += costValue;
    totalRetailValue += retailValue;
    if (quantity === 0) outOfStockCount += 1;
    else inStockCount += 1;

    const entry = unitMap.get(product.unit) ?? {
      unit: product.unit,
      quantity: 0,
      products: 0,
      costValue: 0,
      retailValue: 0,
    };
    entry.quantity += quantity;
    entry.products += 1;
    entry.costValue += costValue;
    entry.retailValue += retailValue;
    unitMap.set(product.unit, entry);
  }

  const totalProfit = totalRetailValue - totalCostValue;
  const byUnit = [...unitMap.values()]
    .filter((entry) => entry.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);

  return {
    totalUnits,
    totalCostValue,
    totalRetailValue,
    totalProfit,
    marginPercent: totalCostValue > 0 ? (totalProfit / totalCostValue) * 100 : 0,
    productCount: products.length,
    inStockCount,
    outOfStockCount,
    byUnit,
  };
}

export function saleItemUnitCount(items: SaleItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
