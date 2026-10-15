export function formatCurrency(
  value: number,
  symbol = "₦",
  options: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return `${symbol}0`;
  const abs = Math.abs(value);
  if (options.compact && abs >= 1000) {
    const units = [
      { limit: 1_000_000_000, suffix: "B" },
      { limit: 1_000_000, suffix: "M" },
      { limit: 1_000, suffix: "K" },
    ];
    for (const unit of units) {
      if (abs >= unit.limit) {
        const short = (value / unit.limit).toFixed(abs >= unit.limit * 10 ? 0 : 1);
        return `${symbol}${short.replace(/\.0$/, "")}${unit.suffix}`;
      }
    }
  }
  return `${symbol}${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-NG");
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateKey(iso: string): string {
  const date = new Date(iso);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isToday(iso: string): boolean {
  return toDateKey(iso) === toDateKey(new Date().toISOString());
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
