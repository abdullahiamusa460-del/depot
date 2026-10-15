import {
  Boxes,
  Coins,
  Download,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AreaChart } from "../components/charts/AreaChart";
import { DonutChart } from "../components/charts/DonutChart";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { StatCard } from "../components/ui/StatCard";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/Table";
import { useApp } from "../hooks/useApp";
import {
  averageTransaction,
  categoryStats,
  dailySeries,
  endOfDay,
  filterSales,
  paymentBreakdown,
  productStats,
  startOfDay,
  sumCost,
  sumRevenue,
  sumUnits,
} from "../lib/analytics";
import { formatCurrency, formatNumber, percent } from "../lib/format";

type Preset = "today" | "7d" | "30d" | "90d" | "custom";

const paymentColors: Record<string, string> = {
  Cash: "var(--success)",
  "Bank Transfer": "var(--info)",
  POS: "var(--primary)",
  Other: "var(--accent)",
};

const categoryColors = [
  "var(--primary)",
  "var(--info)",
  "var(--accent)",
  "var(--success)",
  "var(--danger)",
  "var(--warning)",
];

function toInputDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function Reports() {
  const { sales, products, categories, settings } = useApp();
  const currency = settings.currencySymbol;
  const today = useMemo(() => new Date(), []);

  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(toInputDate(today));

  const range = useMemo(() => {
    const days =
      preset === "today" ? 0 : preset === "7d" ? 6 : preset === "90d" ? 89 : 29;
    if (preset === "custom") {
      return {
        from: from ? startOfDay(new Date(from)) : new Date(0),
        to: to ? endOfDay(new Date(to)) : endOfDay(today),
      };
    }
    return {
      from: startOfDay(new Date(today.getTime() - days * 86400000)),
      to: endOfDay(today),
    };
  }, [preset, from, to, today]);

  const rangeSales = useMemo(() => filterSales(sales, range), [sales, range]);

  const revenue = sumRevenue(rangeSales);
  const cost = sumCost(rangeSales);
  const profit = revenue - cost;
  const units = sumUnits(rangeSales);

  const trend = useMemo(
    () => dailySeries(sales, range.from, range.to),
    [sales, range],
  );
  const payments = useMemo(
    () => paymentBreakdown(rangeSales, settings.paymentMethods),
    [rangeSales, settings.paymentMethods],
  );
  const paymentTotal = payments.reduce((sum, entry) => sum + entry.value, 0);
  const topProducts = useMemo(() => productStats(rangeSales).slice(0, 8), [rangeSales]);
  const catStats = useMemo(
    () => categoryStats(categories, products, rangeSales).filter((c) => c.value > 0),
    [categories, products, rangeSales],
  );
  const maxCat = catStats[0]?.value ?? 1;

  const lowStock = products
    .filter((product) => product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock);

  const exportCsv = () => {
    const header = ["Invoice", "Date", "Payment", "Items", "Subtotal", "Discount", "Total"];
    const rows = rangeSales.map((sale) => [
      sale.invoiceNo,
      new Date(sale.createdAt).toISOString(),
      sale.paymentMethod,
      String(sale.items.reduce((sum, item) => sum + item.quantity, 0)),
      sale.subtotal.toFixed(2),
      sale.discount.toFixed(2),
      sale.total.toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${toInputDate(today)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Understand sales, profit and inventory performance."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={preset}
            onChange={(event) => setPreset(event.target.value as Preset)}
            className="w-auto min-w-[160px]"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </Select>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="w-[150px]"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-[150px]"
              />
            </div>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatCurrency(revenue, currency, { compact: true })}
          icon={Coins}
          tone="success"
          hint={`${rangeSales.length} transactions`}
        />
        <StatCard
          label="Estimated cost"
          value={formatCurrency(cost, currency, { compact: true })}
          icon={Boxes}
          tone="warning"
          hint="Cost of goods sold"
        />
        <StatCard
          label="Estimated profit"
          value={formatCurrency(profit, currency, { compact: true })}
          icon={PiggyBank}
          tone="primary"
          hint={`${percent(profit, revenue)}% margin`}
        />
        <StatCard
          label="Units sold"
          value={formatNumber(units)}
          icon={TrendingUp}
          tone="info"
          hint={`Avg ${formatCurrency(averageTransaction(rangeSales), currency, {
            compact: true,
          })}`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales over time</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={trend.map((point) => ({ label: point.label, value: point.value }))}
              valueFormatter={(value) => formatCurrency(value, currency)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={payments.map((entry) => ({
                label: entry.label,
                value: entry.value,
                color: paymentColors[entry.label] ?? "var(--primary)",
              }))}
              centerLabel="total"
              centerValue={formatCurrency(paymentTotal, currency, { compact: true })}
            />
            <div className="mt-5 space-y-2.5">
              {payments.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: paymentColors[entry.label] }}
                    />
                    {entry.label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(entry.value, currency, { compact: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top selling products</CardTitle>
            <Badge tone="primary">By revenue</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sales in this period.
              </p>
            ) : (
              topProducts.map((product) => (
                <div key={product.productId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {product.name}
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">
                      {formatCurrency(product.revenue, currency, { compact: true })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(
                          4,
                          (product.revenue / (topProducts[0]?.revenue || 1)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(product.quantity)} units · profit{" "}
                    {formatCurrency(product.profit, currency, { compact: true })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {catStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No category sales in this period.
              </p>
            ) : (
              catStats.map((category, index) => (
                <div key={category.categoryId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{category.name}</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(category.value, currency, { compact: true })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (category.value / maxCat) * 100)}%`,
                        background: categoryColors[index % categoryColors.length],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <CardTitle>Inventory report — items to restock</CardTitle>
          <Badge tone={lowStock.length > 0 ? "warning" : "success"}>
            {lowStock.length} item(s)
          </Badge>
        </CardHeader>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Product</TH>
              <TH className="text-right">Stock</TH>
              <TH className="text-right">Minimum</TH>
              <TH className="text-right">Shortfall</TH>
              <TH className="text-right">Restock value</TH>
            </TR>
          </THead>
          <TBody>
            {lowStock.map((product) => (
              <TR key={product.id}>
                <TD className="font-medium">{product.name}</TD>
                <TD className="text-right">{product.stock}</TD>
                <TD className="text-right text-muted-foreground">{product.minStock}</TD>
                <TD className="text-right font-semibold text-danger">
                  {Math.max(0, product.minStock - product.stock)}
                </TD>
                <TD className="text-right">
                  {formatCurrency(
                    Math.max(0, product.minStock - product.stock) * product.cost,
                    currency,
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
