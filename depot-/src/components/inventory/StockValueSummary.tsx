import { Boxes, Coins, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { stockSummary } from "../../lib/analytics";
import { cn } from "../../lib/cn";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { Product } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { StatCard } from "../ui/StatCard";
import { Table, TBody, TD, TH, THead, TR } from "../ui/Table";

export interface StockValueSummaryProps {
  products: Product[];
  currency: string;
  className?: string;
}

export function StockValueSummary({
  products,
  currency,
  className,
}: StockValueSummaryProps) {
  const summary = useMemo(() => stockSummary(products), [products]);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      <StatCard
        label="Total stock quantity"
        value={`${formatNumber(summary.totalUnits)} units`}
        icon={Boxes}
        tone="primary"
        hint={`${formatNumber(summary.inStockCount)} of ${formatNumber(
          summary.productCount,
        )} products in stock`}
      />
      <StatCard
        label="Inventory cost value"
        value={formatCurrency(summary.totalCostValue, currency)}
        icon={Coins}
        tone="info"
        hint="Total purchase cost of goods on hand"
      />
      <StatCard
        label="Potential selling value"
        value={formatCurrency(summary.totalRetailValue, currency)}
        icon={TrendingUp}
        tone="success"
        hint={`Revenue if all stock sells · ${
          summary.marginPercent > 0 ? "+" : ""
        }${summary.marginPercent.toFixed(1)}% over cost`}
      />
    </div>
  );
}

export interface UnitStockBreakdownProps {
  products: Product[];
  currency: string;
  className?: string;
}

export function UnitStockBreakdown({
  products,
  currency,
  className,
}: UnitStockBreakdownProps) {
  const summary = useMemo(() => stockSummary(products), [products]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div>
          <CardTitle>Quantity by selling unit</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bottles, cans, packs, crates and cartons are counted separately so
            different units are never treated as identical.
          </p>
        </div>
      </CardHeader>
      {summary.byUnit.length === 0 ? (
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            No stock currently on hand.
          </p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Unit</TH>
              <TH className="text-right">Products</TH>
              <TH className="text-right">Quantity</TH>
              <TH className="text-right">Cost value</TH>
              <TH className="text-right">Selling value</TH>
            </TR>
          </THead>
          <TBody>
            {summary.byUnit.map((entry) => (
              <TR key={entry.unit}>
                <TD className="font-semibold text-foreground">{entry.unit}</TD>
                <TD className="text-right text-muted-foreground">
                  {formatNumber(entry.products)}
                </TD>
                <TD className="text-right font-bold">
                  {formatNumber(entry.quantity)}
                </TD>
                <TD className="text-right text-muted-foreground">
                  {formatCurrency(entry.costValue, currency)}
                </TD>
                <TD className="text-right font-semibold">
                  {formatCurrency(entry.retailValue, currency)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
