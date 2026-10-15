import { useMemo, type ReactNode } from "react";
import { ReceiptText } from "lucide-react";
import { formatCurrency, formatNumber, formatTime } from "../../lib/format";
import type { PaymentMethod, Sale } from "../../types";
import { Badge } from "../ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent";

const methodTone: Record<PaymentMethod, BadgeTone> = {
  Cash: "success",
  "Bank Transfer": "info",
  POS: "primary",
  Other: "accent",
};

export interface PaymentBreakdownListProps {
  sales: Sale[];
  currency: string;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  limit?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function PaymentBreakdownList({
  sales,
  currency,
  title = "Transactions",
  description,
  emptyTitle = "No sales yet",
  emptyDescription = "Completed sales will appear here with their payment method and amount.",
  limit,
  loading,
  error,
  onRetry,
  action,
  className,
}: PaymentBreakdownListProps) {
  const rows = useMemo(() => {
    const sorted = [...sales].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }, [sales, limit]);

  const count = formatNumber(sales.length);
  const noun = sales.length === 1 ? "transaction" : "transactions";

  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!error && (
            <Badge tone="neutral">
              {count} {noun}
            </Badge>
          )}
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {error ? (
          <ErrorState
            title="Could not load transactions"
            description={error}
            onRetry={onRetry}
          />
        ) : loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: limit ?? 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={emptyTitle}
            description={emptyDescription}
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {sale.invoiceNo}
                    </span>
                    <Badge tone={methodTone[sale.paymentMethod]} className="shrink-0">
                      {sale.paymentMethod}
                    </Badge>
                  </div>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {formatTime(sale.createdAt)}
                    {sale.customer.name ? ` · ${sale.customer.name}` : ""}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold text-foreground">
                  {formatCurrency(sale.total, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
