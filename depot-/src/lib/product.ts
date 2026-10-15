import type { Product, StockStatus } from "../types";

export function stockStatus(
  product: Pick<Product, "stock" | "minStock">,
): StockStatus {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= product.minStock) return "low-stock";
  return "in-stock";
}
