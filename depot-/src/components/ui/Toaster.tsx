import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { ToastLevel } from "../../types";
import { cn } from "../../lib/cn";

const config: Record<
  ToastLevel,
  { icon: typeof Info; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    className: "border-info/30",
    iconClass: "text-info bg-info-soft",
  },
  success: {
    icon: CheckCircle2,
    className: "border-success/30",
    iconClass: "text-success bg-success-soft",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/30",
    iconClass: "text-warning bg-warning-soft",
  },
  danger: {
    icon: XCircle,
    className: "border-danger/30",
    iconClass: "text-danger bg-danger-soft",
  },
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:items-end">
      {toasts.map((toast) => {
        const { icon: Icon, className, iconClass } = config[toast.level];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-lg animate-toast-in",
              className,
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                iconClass,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
