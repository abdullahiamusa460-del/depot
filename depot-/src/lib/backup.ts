/**
 * Backup-file normalisation.
 *
 * Two producers write backup files:
 *
 * - this app (`app: "beverage-shop-pos"`), shaped
 *   `{ app, version, exportedAt, data: { categories, products, … } }`
 * - the optional Depot backend, whose REST response nests the *same* payload
 *   inside a `{ success, data }` envelope, and puts the collections next to
 *   `app` rather than under a `data` key:
 *   `{ success, data: { app, version, exportedAt, categories, products, … } }`
 *
 * `normalizeBackupPayload` yields one canonical `BackupPayload` for either
 * shape (and for the bare inner object), or `null` when the file is not a
 * recognisable backup. Restore validates the shape of every record afterwards.
 */

import type { BackupPayload } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBackupPayload(raw: unknown): BackupPayload | null {
  if (!isRecord(raw)) return null;

  // Unwrap a REST response envelope `{ success, data: { app, … } }`.
  let candidate: Record<string, unknown> = raw;
  if (
    typeof candidate.app !== "string" &&
    isRecord(candidate.data) &&
    typeof (candidate.data as Record<string, unknown>).app === "string"
  ) {
    candidate = candidate.data as Record<string, unknown>;
  }

  if (
    candidate.app !== "beverage-shop-pos" &&
    candidate.app !== "depot-backend"
  ) {
    return null;
  }

  // The collections live under `data` in this app's format, or directly on the
  // (unwrapped) object in the backend's format.
  const collections = isRecord(candidate.data) ? candidate.data : candidate;
  if (
    !Array.isArray(collections.products) ||
    !Array.isArray(collections.sales)
  ) {
    return null;
  }

  return {
    app: candidate.app,
    version: typeof candidate.version === "number" ? candidate.version : 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    data: {
      categories: Array.isArray(collections.categories)
        ? collections.categories
        : [],
      products: collections.products,
      sales: collections.sales,
      inventoryTransactions: Array.isArray(collections.inventoryTransactions)
        ? collections.inventoryTransactions
        : [],
      settings: collections.settings,
    },
  };
}

/** True when the parsed file is a backup this app can restore. */
export function isRecognizableBackup(raw: unknown): boolean {
  return normalizeBackupPayload(raw) !== null;
}
