import { Banknote, CreditCard, Percent, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../../hooks/useApp";
import { buildCartItems, lineTotal } from "../../lib/cart";
import { computeSaleTotals } from "../../lib/checkout";
import { formatCurrency } from "../../lib/format";
import type { PaymentMethod, Sale } from "../../types";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";

const methodIcons: Record<PaymentMethod, typeof Banknote> = {
  Cash: Banknote,
  "Bank Transfer": Wallet,
  POS: CreditCard,
  Other: Wallet,
};

export interface PaymentDialogProps {
  onClose: () => void;
  onCompleted: (sale: Sale) => void;
}

export function PaymentDialog({ onClose, onCompleted }: PaymentDialogProps) {
  const {
    cart,
    products,
    settings,
    checkout,
    pushToast,
  } = useApp();
  const currency = settings.currencySymbol;

  const items = useMemo(() => buildCartItems(cart, products), [cart, products]);

  const [method, setMethod] = useState<PaymentMethod>(settings.defaultPaymentMethod);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState("");
  const [applyTax, setApplyTax] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const totals = useMemo(
    () =>
      computeSaleTotals(items, {
        discount,
        applyTax,
        taxRate: settings.taxRate,
      }),
    [items, discount, applyTax, settings.taxRate],
  );
  const { subtotal, discount: safeDiscount, tax, total } = totals;
  const paid = Number(amountPaid) || 0;
  const change = paid - total;

  const quickAmounts = useMemo(() => {
    const values = new Set<number>();
    values.add(total);
    values.add(Math.ceil(total / 500) * 500);
    values.add(Math.ceil(total / 1000) * 1000);
    values.add(Math.ceil(total / 5000) * 5000);
    return [...values].filter((value) => value > 0).sort((a, b) => a - b);
  }, [total]);

  const handleComplete = () => {
    const result = checkout({
      amountPaid: method === "Cash" ? paid || total : total,
      paymentMethod: method,
      customer: { name: customerName.trim(), phone: customerPhone.trim() },
      discount: safeDiscount,
      applyTax,
    });

    if (!result.ok || !result.sale) {
      pushToast({
        level: "danger",
        title: "Sale not completed",
        message: result.error,
      });
      return;
    }
    pushToast({
      level: "success",
      title: `Sale ${result.sale.invoiceNo} completed`,
      message: `${formatCurrency(result.sale.total, currency)} · ${
        result.sale.paymentMethod
      }`,
    });
    onCompleted(result.sale);
  };

  const canComplete = items.length > 0 && (method !== "Cash" || paid >= total);

  return (
    <Modal
      open
      onClose={onClose}
      title="Take payment"
      description={`${items.length} line item(s) in this sale`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!canComplete} size="lg">
            Complete sale · {formatCurrency(total, currency)}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground">
              Payment method
            </p>
            <div className="grid grid-cols-2 gap-2">
              {settings.paymentMethods.map((option) => {
                const Icon = methodIcons[option];
                const active = method === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-lg border border-primary bg-primary-soft px-3 py-2.5 text-sm font-semibold text-primary-strong"
                        : "flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Sale discount (${currency})`}>
              <div className="relative">
                <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={discount || ""}
                  placeholder="0"
                  onChange={(event) =>
                    setDiscount(Math.max(0, Number(event.target.value) || 0))
                  }
                  className="pl-9"
                />
              </div>
            </Field>
            <Field
              label={`Amount paid (${currency})`}
              hint={method === "Cash" ? "Enter cash received" : "Charged to terminal"}
            >
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={amountPaid}
                placeholder={total.toFixed(2)}
                onChange={(event) => setAmountPaid(event.target.value)}
                autoFocus
              />
            </Field>
          </div>

          {method === "Cash" && (
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amount, index) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setAmountPaid(String(amount))}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted"
                >
                  {index === 0 ? "Exact" : formatCurrency(amount, currency)}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/60 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Apply tax ({settings.taxRate}%)
              </p>
              <p className="text-xs text-muted-foreground">
                Configure tax rate in Settings
              </p>
            </div>
            <Switch
              checked={applyTax}
              onChange={setApplyTax}
              disabled={settings.taxRate <= 0}
              label="Apply tax"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name (optional)">
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Walk-in"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="0803…"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
            <p className="text-sm font-bold text-foreground">Order summary</p>
            <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.productId + item.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatCurrency(lineTotal(item), currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            {safeDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-danger">
                  -{formatCurrency(safeDiscount, currency)}
                </span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(tax, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold text-foreground">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
            {method === "Cash" && (
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Change</span>
                <span
                  className={
                    change < 0
                      ? "font-bold text-danger"
                      : "font-bold text-success"
                  }
                >
                  {formatCurrency(Math.max(0, change), currency)}
                </span>
              </div>
            )}
          </div>

          {method === "Cash" && paid > 0 && paid < total && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
              Amount paid is less than the total due.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
