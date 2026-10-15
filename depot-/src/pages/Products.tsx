import {
  ArrowUpDown,
  Package,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { ProductFormModal } from "../components/products/ProductFormModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ProductThumb } from "../components/ui/ProductThumb";
import { SearchInput } from "../components/ui/SearchInput";
import { Select } from "../components/ui/Input";
import { StockBadge } from "../components/ui/StockBadge";
import { Switch } from "../components/ui/Switch";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/Table";
import { useApp } from "../hooks/useApp";
import { formatCurrency } from "../lib/format";
import type { Product } from "../types";

type SortKey = "name" | "price" | "stock" | "updated";

export default function Products() {
  const {
    products,
    categories,
    settings,
    toggleProductActive,
    deleteProduct,
    pushToast,
    can,
  } = useApp();
  const canManage = can("products.manage");
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "Uncategorized";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter((product) => {
      if (categoryId !== "all" && product.categoryId !== categoryId) return false;
      if (status === "active" && !product.active) return false;
      if (status === "inactive" && product.active) return false;
      if (status === "low" && !(product.stock > 0 && product.stock <= product.minStock))
        return false;
      if (status === "out" && product.stock !== 0) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.includes(term)
      );
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case "price":
          return b.price - a.price;
        case "stock":
          return a.stock - b.stock;
        case "updated":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, search, categoryId, status, sort]);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} products across ${categories.length} categories`}
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PackagePlus className="h-4 w-4" />
              Add product
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products, SKU or barcode…"
            className="min-w-[220px] flex-1"
          />
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-auto min-w-[150px]"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-auto min-w-[140px]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="w-auto min-w-[150px]"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="stock">Sort: Stock (low first)</option>
            <option value="updated">Sort: Recently updated</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={products.length === 0 ? Package : Search}
            title={
              products.length === 0 ? "No products yet" : "No products match your filters"
            }
            description={
              products.length === 0
                ? "Add your first beverage product to start selling."
                : "Try adjusting the search or filters."
            }
            action={
              products.length === 0 && canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                  Add product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Product</TH>
                <TH>Category</TH>
                <TH className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Price <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TH>
                <TH className="text-right">Stock</TH>
                <TH>Status</TH>
                <TH className="text-center">Active</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {filtered.map((product) => (
                <TR key={product.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        name={product.name}
                        image={product.image}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.brand} · {product.sku}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone="neutral">{categoryName(product.categoryId)}</Badge>
                  </TD>
                  <TD className="text-right font-semibold">
                    {formatCurrency(product.price, settings.currencySymbol)}
                  </TD>
                  <TD className="text-right">
                    <span className="font-semibold">{product.stock}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {product.unit}
                    </span>
                  </TD>
                  <TD>
                    <StockBadge product={product} />
                  </TD>
                  <TD className="text-center">
                    <div className="flex justify-center">
                      {canManage ? (
                        <Switch
                          checked={product.active}
                          onChange={() => toggleProductActive(product.id)}
                          label={`Toggle ${product.name}`}
                        />
                      ) : (
                        <Badge tone={product.active ? "success" : "neutral"} dot>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </div>
                  </TD>
                  {canManage && (
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${product.name}`}
                          onClick={() => {
                            setEditing(product);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${product.name}`}
                          className="text-danger hover:bg-danger-soft"
                          onClick={() => setDeleting(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {formOpen && canManage && (
        <ProductFormModal
          product={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete product"
        message={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete product"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteProduct(deleting.id);
          pushToast({
            level: "success",
            title: "Product deleted",
            message: deleting.name,
          });
        }}
      />
    </>
  );
}
