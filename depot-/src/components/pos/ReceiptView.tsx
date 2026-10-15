import type { BusinessSettings, Sale } from "../../types";
import { lineTotal } from "../../lib/cart";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { Logo } from "../ui/Logo";

export interface ReceiptViewProps {
  sale: Sale;
  settings: BusinessSettings;
}

export function ReceiptView({ sale, settings }: ReceiptViewProps) {
  const currency = settings.currencySymbol;
  return (
    <div className="mx-auto w-full max-w-[320px] bg-surface p-5 font-mono text-[12px] leading-relaxed text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-2 h-14 w-14 overflow-hidden rounded-lg">
          <Logo className="h-full w-full" />
        </div>
        <h2 className="text-base font-extrabold uppercase tracking-wide">
          {settings.shopName}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{settings.address}</p>
        <p className="text-[11px] text-muted-foreground">
          {settings.phone}
          {settings.email ? ` · ${settings.email}` : ""}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="flex justify-between">
        <span className="text-muted-foreground">Invoice</span>
        <span className="font-bold">{sale.invoiceNo}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Date</span>
        <span>{formatDateTime(sale.createdAt)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Payment</span>
        <span>{sale.paymentMethod}</span>
      </div>
      {sale.customer.name && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Customer</span>
          <span>{sale.customer.name}</span>
        </div>
      )}

      <div className="my-3 border-t border-dashed border-border" />

      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground">
            <th className="pb-1 font-semibold">Item</th>
            <th className="pb-1 text-center font-semibold">Qty</th>
            <th className="pb-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.productId + item.name}>
              <td className="py-1 pr-2 align-top">
                <span className="block">{item.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {formatCurrency(item.unitPrice, currency)} / {item.unit}
                  {item.discount > 0
                    ? ` · -${formatCurrency(item.discount, currency)}`
                    : ""}
                </span>
              </td>
              <td className="py-1 text-center align-top">{item.quantity}</td>
              <td className="py-1 text-right align-top font-semibold">
                {formatCurrency(lineTotal(item), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(sale.subtotal, currency)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>-{formatCurrency(sale.discount, currency)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(sale.tax, currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1 text-sm font-extrabold">
          <span>Total</span>
          <span>{formatCurrency(sale.total, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount paid</span>
          <span>{formatCurrency(sale.amountPaid, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Change</span>
          <span>{formatCurrency(sale.change, currency)}</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <p className="text-center text-[11px] text-muted-foreground">
        {settings.receiptFooter}
      </p>
      <p className="mt-2 text-center text-[10px] text-subtle-foreground">
        Powered by {settings.shopName} POS
      </p>
    </div>
  );
}
