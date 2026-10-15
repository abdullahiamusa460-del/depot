import { stockStatus } from "../../lib/product";
import type { Product, StockStatus } from "../../types";
import { Badge } from "./Badge";

const config: Record<
  StockStatus,
  { tone: "success" | "warning" | "danger"; label: string }
> = {
  "in-stock": { tone: "success", label: "In stock" },
  "low-stock": { tone: "warning", label: "Low stock" },
  "out-of-stock": { tone: "danger", label: "Out of stock" },
};

export function StockBadge({
  product,
  showCount = false,
}: {
  product: Pick<Product, "stock" | "minStock">;
  showCount?: boolean;
}) {
  const status = stockStatus(product);
  const { tone, label } = config[status];
  return (
    <Badge tone={tone} dot>
      {showCount && status !== "out-of-stock" ? `${product.stock} · ` : ""}
      {label}
    </Badge>
  );
}
