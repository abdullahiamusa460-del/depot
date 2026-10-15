import { Minus, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Product, StockReason } from "../../types";
import { STOCK_REASONS } from "../../types";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/cn";

type Mode = "add" | "remove" | "set";

const modes: { value: Mode; label: string; icon: typeof Plus }[] = [
  { value: "add", label: "Add stock", icon: Plus },
  { value: "remove", label: "Remove stock", icon: Minus },
  { value: "set", label: "Set count", icon: Target },
];

const defaultReason: Record<Mode, StockReason> = {
  add: "Stock received",
  remove: "Damaged",
  set: "Manual adjustment",
};

export interface AdjustStockModalProps {
  product: Product;
  onClose: () => void;
}

export function AdjustStockModal({ product, onClose }: AdjustStockModalProps) {
  const { adjustStock, pushToast } = useApp();
  const [mode, setMode] = useState<Mode>("add");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<StockReason>("Stock received");
  const [note, setNote] = useState("");

  const target = Math.floor(Number(quantity) || 0);
  const change =
    mode === "add" ? target : mode === "remove" ? -target : target - product.stock;
  const nextQty = Math.max(0, product.stock + change);

  const handleSubmit = () => {
    if (mode !== "set" && target <= 0) {
      pushToast({
        level: "warning",
        title: "Enter a quantity",
        message: "The quantity must be greater than zero.",
      });
      return;
    }
    if (change === 0) {
      pushToast({ level: "info", title: "No change", message: "Stock level is unchanged." });
      onClose();
      return;
    }
    adjustStock(product.id, change, reason, note.trim() || reason);
    pushToast({
      level: "success",
      title: "Stock updated",
      message: `${product.name} is now at ${nextQty}.`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust stock — ${product.name}`}
      description={`Current stock: ${product.stock} ${product.unit.toLowerCase()}(s)`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Apply adjustment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {modes.map((entry) => {
            const Icon = entry.icon;
            const active = mode === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => {
                  setMode(entry.value);
                  setReason(defaultReason[entry.value]);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary-strong"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </button>
            );
          })}
        </div>

        <Field
          label={mode === "set" ? "New stock count" : "Quantity"}
        >
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Reason">
          <Select
            value={reason}
            onChange={(event) => setReason(event.target.value as StockReason)}
          >
            {STOCK_REASONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Note (optional)">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Supplier delivery, breakage during handling"
            className="min-h-[72px]"
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3 text-sm">
          <span className="text-muted-foreground">New stock level</span>
          <span className="font-bold text-foreground">
            {product.stock} → {nextQty} {product.unit.toLowerCase()}(s)
          </span>
        </div>
      </div>
    </Modal>
  );
}
