import {
  AlertTriangle,
  Boxes,
  History,
  ListFilter,
  PackageOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdjustStockModal } from "../components/inventory/AdjustStockModal";
import {
  StockValueSummary,
  UnitStockBreakdown,
} from "../components/inventory/StockValueSummary";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ProductThumb } from "../components/ui/ProductThumb";
import { SearchInput } from "../components/ui/SearchInput";
import { Select } from "../components/ui/Input";
import { StatCard } from "../components/ui/StatCard";
import { StockBadge } from "../components/ui/StockBadge";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../hooks/useApp";
import { formatDateTime, formatNumber } from "../lib/format";
import type { Product, StockReason } from "../types";

const reasonTone: Record<StockReason, "primary" | "success" | "danger" | "info" | "neutral" | "accent"> = {
  Sale: "primary",
  "Stock received": "success",
  Return: "info",
  Damaged: "danger",
  Expired: "danger",
  "Manual adjustment": "neutral",
  Correction: "accent",
};

export default function Inventory() {
  const { products, inventory, settings, categories, can } = useApp();
  const canAdjust = can("inventory.adjust");
  const [tab, setTab] = useState("levels");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const currency = settings.currencySymbol;
  const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const out = products.filter((p) => p.stock === 0);

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "—";

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (status === "low" && !(product.stock > 0 && product.stock <= product.minStock))
          return false;
        if (status === "out" && product.stock !== 0) return false;
        if (status === "in" && product.stock <= product.minStock) return false;
        if (!term) return true;
        return (
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.stock - b.stock);
  }, [products, search, status]);

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    return inventory.filter((entry) => {
      if (reasonFilter !== "all" && entry.type !== reasonFilter) return false;
      if (!term) return true;
      return (
        entry.productName.toLowerCase().includes(term) ||
        entry.reason.toLowerCase().includes(term)
      );
    });
  }, [inventory, search, reasonFilter]);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Track stock levels, receive goods and review movements."
      />

      <StockValueSummary products={products} currency={currency} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total products"
          value={formatNumber(products.length)}
          icon={Boxes}
          tone="info"
          hint={`${formatNumber(products.filter((p) => p.active).length)} active`}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(low.length)}
          icon={AlertTriangle}
          tone="warning"
          hint="At or below minimum"
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(out.length)}
          icon={PackageOpen}
          tone="danger"
          hint="Needs restocking"
        />
      </div>

      <UnitStockBreakdown
        products={products}
        currency={currency}
        className="mt-4"
      />

      <div className="mt-5 mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "levels", label: "Stock levels", icon: SlidersHorizontal },
            {
              value: "history",
              label: "Stock history",
              icon: History,
              count: inventory.length,
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === "levels"
                ? "Search products…"
                : "Search stock movements…"
            }
            className="min-w-[220px] flex-1"
          />
          {tab === "levels" ? (
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto min-w-[160px]"
            >
              <option value="all">All stock levels</option>
              <option value="in">Healthy stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          ) : (
            <Select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value)}
              className="w-auto min-w-[180px]"
            >
              <option value="all">All movements</option>
              <option value="Sale">Sales</option>
              <option value="Stock received">Stock received</option>
              <option value="Return">Returns</option>
              <option value="Damaged">Damaged</option>
              <option value="Expired">Expired</option>
              <option value="Manual adjustment">Manual adjustments</option>
              <option value="Correction">Corrections</option>
            </Select>
          )}
        </div>

        {tab === "levels" ? (
          filteredProducts.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              title="No products match"
              description="Adjust the filters to see stock levels."
            />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH className="text-right">Current</TH>
                  <TH className="text-right">Minimum</TH>
                  <TH className="text-right">Available</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Last updated</TH>
                  {canAdjust && <TH className="text-right">Adjust</TH>}
                </TR>
              </THead>
              <TBody>
                {filteredProducts.map((product) => (
                  <TR key={product.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <ProductThumb name={product.name} image={product.image} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.sku} · {product.unit}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <span className="text-sm text-muted-foreground">
                        {categoryName(product.categoryId)}
                      </span>
                    </TD>
                    <TD className="text-right font-bold">{product.stock}</TD>
                    <TD className="text-right text-muted-foreground">
                      {product.minStock}
                    </TD>
                    <TD className="text-right">{product.stock}</TD>
                    <TD>
                      <StockBadge product={product} />
                    </TD>
                    <TD className="text-right text-xs text-muted-foreground">
                      {formatDateTime(product.updatedAt)}
                    </TD>
                    {canAdjust && (
                      <TD>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjusting(product)}
                          >
                            Adjust
                          </Button>
                        </div>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No stock movements"
            description="Stock received, sales and adjustments will appear here."
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Date</TH>
                <TH>Product</TH>
                <TH>Type</TH>
                <TH className="text-right">Change</TH>
                <TH className="text-right">Previous</TH>
                <TH className="text-right">New</TH>
                <TH>Reason</TH>
              </TR>
            </THead>
            <TBody>
              {filteredHistory.slice(0, 200).map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </TD>
                  <TD className="font-medium">{entry.productName}</TD>
                  <TD>
                    <Badge tone={reasonTone[entry.type]}>{entry.type}</Badge>
                  </TD>
                  <TD
                    className={
                      entry.change >= 0
                        ? "text-right font-bold text-success"
                        : "text-right font-bold text-danger"
                    }
                  >
                    {entry.change >= 0 ? "+" : ""}
                    {entry.change}
                  </TD>
                  <TD className="text-right text-muted-foreground">
                    {entry.previousQty}
                  </TD>
                  <TD className="text-right font-semibold">{entry.newQty}</TD>
                  <TD className="text-sm text-muted-foreground">{entry.reason}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {adjusting && canAdjust && (
        <AdjustStockModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
        />
      )}
    </>
  );
}
