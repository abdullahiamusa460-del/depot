import {
  AlertTriangle,
  Download,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useApp } from "../hooks/useApp";
import { formatDateTime } from "../lib/format";
import type { BackupPayload } from "../types";

export default function Backup() {
  const {
    products,
    categories,
    inventory,
    sales,
    exportData,
    importData,
    resetData,
    pushToast,
  } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupPayload | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const counts = [
    { label: "Products", value: products.length },
    { label: "Categories", value: categories.length },
    { label: "Sales", value: sales.length },
    { label: "Stock movements", value: inventory.length },
  ];

  const handleExport = () => {
    const payload = exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `beverage-pos-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast({
      level: "success",
      title: "Backup downloaded",
      message: "Keep the file somewhere safe.",
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const candidate = parsed as Partial<BackupPayload>;
      if (
        candidate.app !== "beverage-shop-pos" ||
        !candidate.data ||
        !Array.isArray(candidate.data.products) ||
        !Array.isArray(candidate.data.sales)
      ) {
        pushToast({
          level: "danger",
          title: "Invalid backup file",
          message: "This file was not created by this application.",
        });
        return;
      }
      setPending(candidate as BackupPayload);
      setRestoreOpen(true);
    } catch {
      pushToast({
        level: "danger",
        title: "Could not read file",
        message: "The file is not valid JSON.",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader
        title="Backup & Restore"
        description="Because this app runs offline, regular backups keep your data safe."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                <Download className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>Create a backup</CardTitle>
                <CardDescription>
                  Export all records to a single JSON file.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {counts.map((count) => (
                <div
                  key={count.label}
                  className="rounded-lg border border-border bg-surface-muted/50 px-4 py-3"
                >
                  <p className="text-xl font-extrabold text-foreground">
                    {count.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{count.label}</p>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Download backup (.json)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-info">
                <Upload className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>Restore from backup</CardTitle>
                <CardDescription>
                  Import a previously exported file. Current data will be replaced.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-muted/40 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/30"
            >
              <FileCheck2 className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Choose a backup file
              </span>
              <span className="text-xs text-muted-foreground">
                JSON files exported from this app
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3.5 py-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Restoring overwrites your current products, sales and settings. Make a
                fresh backup first.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 border-danger/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Reset data</CardTitle>
              <CardDescription>
                Restore the sample catalog and clear all sales.
              </CardDescription>
            </div>
          </div>
          <Badge tone="danger">Danger zone</Badge>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Reset to sample data
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreOpen}
        title="Restore this backup?"
        message={
          pending
            ? `This will replace your current data with the backup exported on ${formatDateTime(
                pending.exportedAt,
              )} (${pending.data.products?.length ?? 0} products, ${
                pending.data.sales?.length ?? 0
              } sales).`
            : ""
        }
        confirmLabel="Restore backup"
        tone="primary"
        onClose={() => {
          setRestoreOpen(false);
          setPending(null);
        }}
        onConfirm={() => {
          if (!pending) return;
          const result = importData(pending);
          if (result.ok) {
            pushToast({
              level: "success",
              title: "Backup restored",
              message: "Your data has been replaced.",
            });
          } else {
            pushToast({
              level: "danger",
              title: "Restore failed",
              message: result.error,
            });
          }
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset all data?"
        message="All products, sales and stock history will be replaced with sample data. This cannot be undone."
        confirmLabel="Reset data"
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetData();
          pushToast({ level: "success", title: "Data reset", message: "Sample data restored." });
        }}
      />

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Backups are stored entirely on this device. No internet required.
      </div>
    </>
  );
}
