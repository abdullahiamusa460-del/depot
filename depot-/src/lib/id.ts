export function uid(prefix = "id"): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export function nextInvoiceNumber(prefix: string, existing: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = existing.reduce((max, invoice) => {
    const match = pattern.exec(invoice);
    if (!match) return max;
    return Math.max(max, Number.parseInt(match[1], 10));
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
}
