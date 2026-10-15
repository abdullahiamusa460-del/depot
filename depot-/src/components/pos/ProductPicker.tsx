import { PackageSearch, Plus } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "../../lib/cn";
import type { CartLine, Category, Product } from "../../types";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ProductThumb } from "../ui/ProductThumb";
import { SearchInput } from "../ui/SearchInput";
import { formatCurrency } from "../../lib/format";

export interface ProductPickerProps {
  products: Product[];
  categories: Category[];
  cart: CartLine[];
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  onAdd: (product: Product) => void;
  currency: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

function stockTone(product: Product) {
  if (product.stock === 0) return { tone: "danger" as const, label: "Out" };
  if (product.stock <= product.minStock)
    return { tone: "warning" as const, label: `${product.stock} left` };
  return { tone: "success" as const, label: `${product.stock} in stock` };
}

export function ProductPicker({
  products,
  categories,
  cart,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  onAdd,
  currency,
  searchInputRef,
}: ProductPickerProps) {
  const quantityByProduct = new Map(
    cart.map((line) => [line.productId, line.quantity]),
  );

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          inputRef={searchInputRef}
          placeholder="Search by name, brand, SKU or barcode…"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => onCategoryChange("all")}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              categoryId === "all"
                ? "border-primary bg-primary-soft text-primary-strong"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
            )}
          >
            All products
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                categoryId === category.id
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
              )}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: category.color }}
              />
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No products found"
            description="Try a different search term or category."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {products.map((product) => {
              const disabled = product.stock === 0 || !product.active;
              const status = stockTone(product);
              const inCart = quantityByProduct.get(product.id) ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(product)}
                  className={cn(
                    "group relative flex flex-col rounded-xl border border-border bg-surface p-3 text-left transition-all",
                    disabled
                      ? "cursor-not-allowed opacity-55"
                      : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <ProductThumb name={product.name} image={product.image} size="lg" />
                    {inCart > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                        {inCart}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {product.brand} · {product.unit}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-foreground">
                      {formatCurrency(product.price, currency)}
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {!disabled && (
                    <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow transition-opacity group-hover:opacity-100">
                      <Plus className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
