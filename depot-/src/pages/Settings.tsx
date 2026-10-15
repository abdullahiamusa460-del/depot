import { Palette, Receipt, Store } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { Switch } from "../components/ui/Switch";
import { Tabs } from "../components/ui/Tabs";
import { ThemeSegment } from "../components/ui/ThemeToggle";
import { useApp } from "../hooks/useApp";
import type { BusinessSettings, PaymentMethod } from "../types";
import { PAYMENT_METHODS } from "../types";

export default function Settings() {
  const { settings, updateSettings, pushToast } = useApp();
  const [tab, setTab] = useState("shop");
  const [draft, setDraft] = useState<BusinessSettings>(settings);

  const update = <K extends keyof BusinessSettings>(
    key: K,
    value: BusinessSettings[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleMethod = (method: PaymentMethod) => {
    setDraft((current) => {
      const active = current.paymentMethods.includes(method);
      return {
        ...current,
        paymentMethods: active
          ? current.paymentMethods.filter((entry) => entry !== method)
          : [...current.paymentMethods, method],
      };
    });
  };

  const handleSave = () => {
    if (!draft.shopName.trim()) {
      pushToast({ level: "warning", title: "Shop name is required" });
      return;
    }
    if (draft.paymentMethods.length === 0) {
      pushToast({
        level: "warning",
        title: "Keep at least one payment method",
      });
      return;
    }
    updateSettings(draft);
    pushToast({ level: "success", title: "Settings saved" });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your shop, sales preferences and appearance."
        actions={<Button onClick={handleSave}>Save changes</Button>}
      />

      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "shop", label: "Shop information", icon: Store },
            { value: "sales", label: "Sales & receipts", icon: Receipt },
            { value: "appearance", label: "Appearance", icon: Palette },
          ]}
        />
      </div>

      {tab === "shop" && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Shop information</CardTitle>
              <CardDescription>
                Shown on receipts and used across the app.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop name" required className="sm:col-span-2">
              <Input
                value={draft.shopName}
                onChange={(event) => update("shopName", event.target.value)}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={draft.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={draft.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </Field>
            <Field label="Website / social handle" className="sm:col-span-2">
              <Input
                value={draft.website}
                onChange={(event) => update("website", event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {tab === "sales" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales & currency</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Currency symbol">
                <Input
                  value={draft.currencySymbol}
                  onChange={(event) => update("currencySymbol", event.target.value)}
                />
              </Field>
              <Field label="Currency code">
                <Input
                  value={draft.currencyCode}
                  onChange={(event) => update("currencyCode", event.target.value)}
                />
              </Field>
              <Field label="Invoice prefix">
                <Input
                  value={draft.invoicePrefix}
                  onChange={(event) =>
                    update("invoicePrefix", event.target.value.toUpperCase())
                  }
                />
              </Field>
              <Field label="Default payment method">
                <Select
                  value={draft.defaultPaymentMethod}
                  onChange={(event) =>
                    update("defaultPaymentMethod", event.target.value as PaymentMethod)
                  }
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax rate (%)">
                <Input
                  type="number"
                  min={0}
                  value={draft.taxRate}
                  onChange={(event) =>
                    update("taxRate", Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </Field>
              <Field label="Default low-stock level">
                <Input
                  type="number"
                  min={0}
                  value={draft.lowStockDefault}
                  onChange={(event) =>
                    update(
                      "lowStockDefault",
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment methods</CardTitle>
              <CardDescription>Enable the methods you accept.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {PAYMENT_METHODS.map((method) => {
                const enabled = draft.paymentMethods.includes(method);
                return (
                  <div
                    key={method}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {method}
                    </span>
                    <Switch
                      checked={enabled}
                      onChange={() => toggleMethod(method)}
                      label={`Enable ${method}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Receipt footer</CardTitle>
              <CardDescription>
                Printed at the bottom of every receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.receiptFooter}
                onChange={(event) => update("receiptFooter", event.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "appearance" && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose light, dark or match your system. Your choice is remembered on
                this device.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThemeSegment />
            <p className="text-sm text-muted-foreground">
              The theme uses centralized design tokens, so colours update everywhere
              instantly. Revenue and stock figures are formatted with the{" "}
              <span className="font-semibold text-foreground">
                {draft.currencySymbol} {draft.currencyCode}
              </span>{" "}
              currency.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
