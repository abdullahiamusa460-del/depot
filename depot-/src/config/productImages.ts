import type { Product } from "../types";

export const PRODUCT_IMAGE_DIR = "/images/products";

export const PRODUCT_IMAGES_BY_SKU: Record<string, string> = {
  "CC-50CL": `${PRODUCT_IMAGE_DIR}/coca-cola.jpg`,
  "CC-CAN33": `${PRODUCT_IMAGE_DIR}/coca-cola-can.jpg`,
  "FA-50CL": `${PRODUCT_IMAGE_DIR}/fanta.jpg`,
  "SP-50CL": `${PRODUCT_IMAGE_DIR}/sprite.jpg`,
  "MO-GRN500": `${PRODUCT_IMAGE_DIR}/monster-energy-green.jpg`,
  "MO-WHT500": `${PRODUCT_IMAGE_DIR}/monster-energy-ultra-white.jpg`,
  "SW-BL33": `${PRODUCT_IMAGE_DIR}/schweppes-bitter-lemon.jpg`,
  "SW-MOJ33": `${PRODUCT_IMAGE_DIR}/schweppes-mojito.jpg`,
};

export function imageForSku(sku: string): string | undefined {
  return PRODUCT_IMAGES_BY_SKU[sku.trim().toUpperCase()];
}

export function resolveProductImage(
  product: Pick<Product, "sku" | "image">,
): string | undefined {
  return product.image ?? imageForSku(product.sku);
}
