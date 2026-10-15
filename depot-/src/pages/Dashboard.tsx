import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart } from "../components/charts/AreaChart";
import { DonutChart } from "../components/charts/DonutChart";
import {
  StockValueSummary,
  UnitStockBreakdown,
} from "../components/inventory/StockValueSummary";
import { PageHeader } from "../components/layout/PageHeader";
import { PaymentBreakdownList } from "../components/sales/PaymentBreakdownList";
import { PaymentSummaryCards } from "../components/sales/PaymentSummaryCards";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ProductThumb } from "../components/ui/ProductThumb";
import { StatCard } from "../components/ui/StatCard";
import { useApp } from "../hooks/useApp";
import {
  averageTransaction,
  dailySeries,
  endOfDay,
  filterSales,
  paymentBreakdown,
  productStats,
  startOfDay,
  stockSummary,
  sumCost,
  sumRevenue,
} from "../lib/analytics";
import { formatCurrency, formatNumber, percent } from "../lib/format";
import { timeAgo } from "../lib/timeAgo";

const paymentColors: Record<string, string> = {
  Cash: "var(--success)",
  "Bank Transfer": "var(--info)",
  POS: "var(--primary)",
  Other: "var(--accent)",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { products, sales, settings, can, loading, error, refresh } = useApp();
  const currency = settings.currencySymbol;
  const showFinancials = can("sales.viewFinancials");
  const canSell = can("pos.sell");

  const { now, todayRange, last14Range, last30Range } = useMemo(() => {
    const current = new Date();
    return {
      now: current,
      todayRange: { from: startOfDay(current), to: endOfDay(current) },
      last14Range: {
        from: startOfDay(new Date(current.getTime() - 13 * 86400000)),
        to: endOfDay(current),
      },
      last30Range: {
        from: startOfDay(new Date(current.getTime() - 29 * 86400000)),
        to: endOfDay(current),
      },
    };
  }, []);

  const todaySales = useMemo(
    () => filterSales(sales, todayRange),
    [sales, todayRange],
  );
  const last30Sales = useMemo(
    () => filterSales(sales, last30Range),
    [sales, last30Range],
  );

  const todayRevenue = sumRevenue(todaySales);
  const todayProfit = todayRevenue - sumCost(todaySales);
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock,
  );
  const outOfStock = products.filter((product) => product.stock === 0);
  const stock = useMemo(() => stockSummary(products), [products]);

  const trend = useMemo(
    () => dailySeries(sales, last14Range.from, last14Range.to),
    [sales, last14Range],
  );
  const payments = useMemo(
    () => paymentBreakdown(last30Sales, settings.paymentMethods),
    [last30Sales, settings.paymentMethods],
  );
  const paymentTotal = payments.reduce((sum, entry) => sum + entry.value, 0);
  const topProducts = useMemo(
    () => productStats(last30Sales).slice(0, 5),
    [last30Sales],
  );
  const maxTopRevenue = topProducts[0]?.revenue ?? 1;
  const recentSales = sales.slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${now.toLocaleDateString("en-NG", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`}
        actions={
          canSell ? (
            <Button onClick={() => navigate("/pos")}>
              <ShoppingCart className="h-4 w-4" />
              Start a sale
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showFinancials && (
          <StatCard
            label="Today's sales"
            value={formatCurrency(todayRevenue, currency)}
            icon={CircleDollarSign}
            tone="success"
            delta={{ value: `${todaySales.length} sales`, positive: true }}
          />
        )}
        {showFinancials && (
          <StatCard
            label="Estimated profit"
            value={formatCurrency(todayProfit, currency, { compact: true })}
            icon={TrendingUp}
            tone="primary"
            hint="Based on recorded cost prices"
          />
        )}
        <StatCard
          label="Transactions today"
          value={formatNumber(todaySales.length)}
          icon={ReceiptText}
          tone="info"
          hint={`Avg ${formatCurrency(
            averageTransaction(todaySales),
            currency,
            { compact: true },
          )}`}
        />
        <StatCard
          label="Stock on hand"
          value={`${formatNumber(stock.totalUnits)} units`}
          icon={Wallet}
          tone="accent"
          hint={`Across ${formatNumber(stock.inStockCount)} products`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={formatNumber(products.length)}
          icon={Package}
          tone="primary"
          hint={`${products.filter((p) => p.active).length} active`}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(lowStock.length)}
          icon={AlertTriangle}
          tone="warning"
          hint="At or below minimum"
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(outOfStock.length)}
          icon={Boxes}
          tone="danger"
          hint="Needs restocking"
        />
        {showFinancials && (
          <StatCard
            label="30-day revenue"
            value={formatCurrency(sumRevenue(last30Sales), currency, {
              compact: true,
            })}
            icon={CircleDollarSign}
            tone="success"
            hint={`${last30Sales.length} transactions`}
          />
        )}
      </div>

      <section className="mt-5">
        <div className="mb-3">
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Today's sales payment summary
          </h2>
          <p className="text-sm text-muted-foreground">
            Takings recorded today (
            {now.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}
            ) broken down by payment method, in {currency}.
          </p>
        </div>
        {showFinancials && (
          <PaymentSummaryCards
            sales={todaySales}
            currency={currency}
            loading={loading}
            className="mb-4"
          />
        )}
        <PaymentBreakdownList
          title="Today's transactions"
          description="Each sale recorded today with its payment method and amount."
          sales={todaySales}
          currency={currency}
          limit={8}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
      </section>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Stock valuation
            </h2>
            <p className="text-sm text-muted-foreground">
              Combined totals across every product and category, in {currency}.
              Purchase cost is shown separately from potential selling revenue.
            </p>
          </div>
        </div>
        <StockValueSummary products={products} currency={currency} />
        <UnitStockBreakdown products={products} currency={currency} className="mt-4" />
      </section>

      {showFinancials && (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Sales trend</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Revenue over the last 14 days
              </p>
            </div>
            <Badge tone="primary" dot>
              Last 14 days
            </Badge>
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
              centerLabel="last 30 days"
              centerValue={formatCurrency(paymentTotal, currency, { compact: true })}
            />
            <div className="mt-5 space-y-2.5">
              {payments.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: paymentColors[entry.label] }}
                    />
                    {entry.label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {percent(entry.value, paymentTotal)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <div
        className={`mt-5 grid gap-5 ${
          showFinancials ? "lg:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
        {showFinancials && (
          <Card>
            <CardHeader>
              <CardTitle>Top selling products</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/reports")}
              >
                Reports <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No sales recorded yet.
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
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.max(
                            4,
                            (product.revenue / maxTopRevenue) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(product.quantity)} units sold
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/inventory")}
            >
              Inventory <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {[...outOfStock, ...lowStock].slice(0, 6).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                All products are well stocked.
              </p>
            ) : (
              [...outOfStock, ...lowStock].slice(0, 6).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => navigate("/inventory")}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                >
                  <ProductThumb name={product.name} image={product.image} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {product.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Min {product.minStock} · {product.unit}
                    </span>
                  </span>
                  <Badge tone={product.stock === 0 ? "danger" : "warning"}>
                    {product.stock === 0 ? "Out" : `${product.stock} left`}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {recentSales.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No sales yet"
                description="Your recent transactions will appear here."
                className="py-8"
              />
            ) : (
              recentSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => navigate("/sales")}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {sale.invoiceNo}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(sale.createdAt)} · {sale.paymentMethod}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-foreground">
                    {formatCurrency(sale.total, currency, { compact: true })}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
