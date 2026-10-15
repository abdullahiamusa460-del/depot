import { CheckCircle2, Printer, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../hooks/useApp";
import { formatCurrency } from "../../lib/format";
import { printReceipt } from "../../lib/print";
import type { Sale } from "../../types";
import { Button } from "../ui/Button";
import { ReceiptView } from "./ReceiptView";

export interface ReceiptDialogProps {
  sale: Sale | null;
  onClose: () => void;
  onNewSale?: () => void;
  heading?: string;
}

export function ReceiptDialog({
  sale,
  onClose,
  onNewSale,
  heading = "Sale completed",
}: ReceiptDialogProps) {
  const { settings } = useApp();

  useEffect(() => {
    if (!sale) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sale, onClose]);

  if (!sale) return null;

  return createPortal(
    <div className="receipt-modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-4">
      <div className="receipt-modal-panel z-10 flex max-h-[94dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-lg sm:rounded-2xl">
        <div className="no-print flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{heading}</p>
              <p className="text-xs text-muted-foreground">
                {sale.invoiceNo} · {formatCurrency(sale.total, settings.currencySymbol)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="receipt-modal-body flex-1 overflow-y-auto bg-surface-muted/40 p-4">
          <ReceiptView sale={sale} settings={settings} />
        </div>

        <div className="no-print flex items-center gap-2 border-t border-border bg-surface px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={printReceipt}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onClose();
              onNewSale?.();
            }}
          >
            {onNewSale ? "New sale" : "Close"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
