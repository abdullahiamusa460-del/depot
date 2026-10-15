import type { CartLine, Product, SaleItem } from "../types";

export function buildCartItems(
  cart: CartLine[],
  products: Product[],
): SaleItem[] {
  return cart
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return null;
      const item: SaleItem = {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: line.quantity,
        unitPrice: product.price,
        cost: product.cost,
        discount: line.discount,
      };
      return item;
    })
    .filter((item): item is SaleItem => item !== null);
}

export function lineTotal(item: SaleItem): number {
  return Math.max(0, item.unitPrice * item.quantity - item.discount);
}

export function cartSubtotal(items: SaleItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}
