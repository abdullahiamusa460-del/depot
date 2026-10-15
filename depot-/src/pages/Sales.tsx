import {
  CalendarDays,
  ReceiptText,
  Search as SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { ReceiptDialog } from "../components/pos/ReceiptDialog";
import { PaymentSummaryCards } from "../components/sales/PaymentSummaryCards";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Select } from "../components/ui/Input";
import { SearchInput } from "../components/ui/SearchInput";
import { StatCard } from "../components/ui/StatCard";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/Table";
import { useApp } from "../hooks/useApp";
import {
  averageTransaction,
  endOfDay,
  filterSales,
  startOfDay,
  sumRevenue,
} from "../lib/analytics";
import { formatCurrency, formatDateTime, formatNumber } from "../lib/format";
import type { PaymentMethod, Sale } from "../types";
import { PAYMENT_METHODS } from "../types";

type Preset = "today" | "7d" | "30d" | "all" | "custom";

const methodTone: Record<PaymentMethod, "success" | "info" | "primary" | "neutral"> = {
  Cash: "success",
  "Bank Transfer": "info",
  POS: "primary",
  Other: "neutral",
};

function toInputDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function Sales() {
  const { sales, settings, can } = useApp();
  const showFinancials = can("sales.viewFinancials");
  const currency = settings.currencySymbol;
  const today = useMemo(() => new Date(), []);

  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(toInputDate(today));
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const range = useMemo(() => {
    if (preset === "all") {
      return { from: new Date(0), to: endOfDay(today) };
    }
    if (preset === "today") {
      return { from: startOfDay(today), to: endOfDay(today) };
    }
    if (preset === "7d") {
      return {
        from: startOfDay(new Date(today.getTime() - 6 * 86400000)),
        to: endOfDay(today),
      };
    }
    if (preset === "30d") {
      return {
        from: startOfDay(new Date(today.getTime() - 29 * 86400000)),
        to: endOfDay(today),
      };
    }
    const fromDate = from ? startOfDay(new Date(from)) : new Date(0);
    const toDate = to ? endOfDay(new Date(to)) : endOfDay(today);
    return { from: fromDate, to: toDate };
  }, [preset, from, to, today]);

  const rangeSales = useMemo(() => filterSales(sales, range), [sales, range]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rangeSales
      .filter((sale) => method === "all" || sale.paymentMethod === method)
      .filter((sale) => {
        if (!term) return true;
        return (
          sale.invoiceNo.toLowerCase().includes(term) ||
          sale.customer.name.toLowerCase().includes(term)
        );
      });
  }, [rangeSales, method, search]);

  const totalRevenue = sumRevenue(filtered);

  return (
    <>
      <PageHeader
        title="Sales"
        description="Review transactions and reprint receipts."
      />

      <div className={showFinancials ? "grid gap-4 sm:grid-cols-3" : "grid gap-4"}>
        {showFinancials && (
          <StatCard
            label="Revenue"
            value={formatCurrency(totalRevenue, currency, { compact: true })}
            icon={ReceiptText}
            tone="success"
          />
        )}
        <StatCard
          label="Transactions"
          value={formatNumber(filtered.length)}
          icon={CalendarDays}
          tone="primary"
        />
        {showFinancials && (
          <StatCard
            label="Average sale"
            value={formatCurrency(averageTransaction(filtered), currency, {
              compact: true,
            })}
            icon={SearchIcon}
            tone="info"
          />
        )}
      </div>

      {showFinancials && (
        <section className="mt-5">
          <div className="mb-3">
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Payment summary
            </h2>
            <p className="text-sm text-muted-foreground">
              Takings by payment method for the selected period, in {currency}.
              Filters above do not affect these totals.
            </p>
          </div>
          <PaymentSummaryCards
            sales={rangeSales}
            currency={currency}
            totalLabel="Total sales"
          />
        </section>
      )}

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search invoice or customer…"
            className="min-w-[220px] flex-1"
          />
          <Select
            value={preset}
            onChange={(event) => setPreset(event.target.value as Preset)}
            className="w-auto min-w-[150px]"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </Select>
          <Select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="w-auto min-w-[160px]"
          >
            <option value="all">All payment methods</option>
            {PAYMENT_METHODS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
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

        {filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No sales found"
            description="Try adjusting the date range or filters."
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Invoice</TH>
                <TH>Date &amp; time</TH>
                <TH className="text-center">Items</TH>
                <TH>Payment</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Change</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.slice(0, 300).map((sale) => (
                <TR
                  key={sale.id}
                  onClick={() => setSelected(sale)}
                  className="cursor-pointer"
                >
                  <TD className="font-semibold text-foreground">{sale.invoiceNo}</TD>
                  <TD className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(sale.createdAt)}
                  </TD>
                  <TD className="text-center">
                    {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </TD>
                  <TD>
                    <Badge tone={methodTone[sale.paymentMethod]}>
                      {sale.paymentMethod}
                    </Badge>
                  </TD>
                  <TD className="text-right font-bold">
                    {formatCurrency(sale.total, currency)}
                  </TD>
                  <TD className="text-right text-sm text-muted-foreground">
                    {formatCurrency(sale.change, currency)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ReceiptDialog
        sale={selected}
        heading="Receipt"
        onClose={() => setSelected(null)}
      />
    </>
  );
}
