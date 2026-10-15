import { useMemo } from "react";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { formatCurrency, formatNumber } from "../../lib/format";
import { paymentSummary } from "../../lib/analytics";
import type { PaymentMethod, Sale } from "../../types";
import { SkeletonCard } from "../ui/Skeleton";
import { StatCard, type StatCardProps } from "../ui/StatCard";

type Tone = NonNullable<StatCardProps["tone"]>;

const methodMeta: Record<
  PaymentMethod,
  { label: string; icon: LucideIcon; tone: Tone }
> = {
  Cash: { label: "Cash", icon: Banknote, tone: "success" },
  POS: { label: "POS", icon: CreditCard, tone: "primary" },
  "Bank Transfer": { label: "Bank Transfer", icon: Landmark, tone: "info" },
  Other: { label: "Other", icon: Wallet, tone: "accent" },
};

export interface PaymentSummaryCardsProps {
  sales: Sale[];
  currency: string;
  totalLabel?: string;
  loading?: boolean;
  className?: string;
}

function transactionHint(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "transaction" : "transactions"}`;
}

export function PaymentSummaryCards({
  sales,
  currency,
  totalLabel = "Total sales today",
  loading,
  className,
}: PaymentSummaryCardsProps) {
  const summary = useMemo(() => paymentSummary(sales), [sales]);
  const gridClass = cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className);

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {summary.rows.map((row) => {
        const meta = methodMeta[row.method];
        return (
          <StatCard
            key={row.method}
            label={`${meta.label} payments`}
            value={formatCurrency(row.total, currency)}
            icon={meta.icon}
            tone={meta.tone}
            hint={`${transactionHint(row.transactions)}${
              row.share > 0 ? ` · ${row.share}%` : ""
            }`}
          />
        );
      })}
      <StatCard
        label={totalLabel}
        value={formatCurrency(summary.total, currency)}
        icon={CircleDollarSign}
        tone="accent"
        hint={`${transactionHint(summary.transactions)} across all methods`}
      />
    </div>
  );
}
