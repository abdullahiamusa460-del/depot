# Architecture — Offline-First Beverage Shop POS

This document records the application architecture as it actually is in the
source, and the offline behaviour that has been verified. It complements
[WORKFLOWS.md](./WORKFLOWS.md) (data-handling per workflow),
[OFFLINE_PWA.md](./OFFLINE_PWA.md) (install steps, platform limits and the
verified-scenario checklist) and [integration.md](./integration.md) (the
optional REST backend contract).

## 1. Summary

The shop app is a **React + TypeScript SPA built with Vite**, delivered as an
**installable PWA**. Daily shop operations run entirely on the device:

- **Default and only offline-capable data backend: IndexedDB** (browser-local
  database). No server, no network, no cloud is required for normal operation.
- **The Express/MongoDB `depot_backend` is optional.** It is only used when the
  frontend is built with `VITE_DATA_BACKEND=remote`. That mode needs a reachable
  server and is **not** offline-capable, so it is not the default and is not
  required by any daily workflow.
- Only two small pieces of UI state use `localStorage`: the theme choice and the
  session token. **All business data lives in IndexedDB.**

There is no cloud dependency, no third-party runtime request, and no online API
in the default build. Fonts and product images are self-hosted and precached.

## 2. Data-backend selection

`src/lib/data.ts` chooses the implementation once, at build time:

```
VITE_DATA_BACKEND=remote  →  src/lib/api.ts        (REST, needs a server; not offline)
(default / "local")       →  src/lib/local/localApi.ts  (IndexedDB; fully offline)
```

Both expose the same method surface, so the store and every view are unaware of
which one is active. The local implementation mirrors the REST DTOs, status
codes and error messages one-to-one.

```
src/lib/local/
├── db.ts          IndexedDB plumbing + transactions, ids, password hashing
├── localApi.ts     Offline implementation of the whole API surface
└── seed.ts         First-run sample catalog, accounts and reset-to-sample
```

## 3. Local database (IndexedDB)

Database name: **`beverage-shop-pos`** (version 1). One object store per entity,
keyed as follows (`src/lib/local/db.ts`):

| Store | Key path | Contents |
| --- | --- | --- |
| `users` | `_id` | Staff/admin accounts (salted SHA-256 hash only; never a plaintext password) |
| `categories` | `_id` | Product categories |
| `products` | `_id` | Products incl. `imageUrl`, price, cost, stock, `minStock`, status |
| `sales` | `_id` | Completed sales / receipts (line items + pricing snapshot) |
| `transactions` | `_id` | Stock movement ledger (received, sale, adjustment, damaged, …) |
| `settings` | `key` | Single global shop/business settings record |
| `sessions` | `token` | Locally issued session tokens |
| `meta` | `key` | Internal flags (e.g. the first-run `seeded` marker) |

Because the data is in IndexedDB, it survives page refreshes, closed tabs,
browser restarts and machine restarts. `navigator.storage.persist()` is
requested at startup to reduce the chance of eviction under storage pressure.

## 4. Consistency guarantees

Reliability of the important business operations is enforced at the database
level, not just in the UI:

- **Atomic sale**: `api.sales.create` runs inside one `readwrite` IndexedDB
  transaction over `products`, `sales` and `transactions`. Stock is decremented
  and the receipt is written together — a failed sale rolls the whole
  transaction back, so inventory and sales can never disagree.
- **Stock can never go negative**: the same transaction re-reads each product,
  rejects the sale with *Insufficient stock* when a line exceeds stock, and
  writes the matching ledger entry per line.
- **Invoice numbers never duplicate**: the next number is computed from the
  existing invoices *inside the sale transaction*
  (`src/lib/id.ts` → `nextInvoiceNumber`), so concurrent/idempotent retries get
  sequential numbers (`INV-000001`, `INV-000002`, …). The prefix is configurable
  in Settings.
- **Prices are snapshotted**: the receipt stores the unit price, cost and name
  at sale time, so later product edits never rewrite sales history.
- **Stock adjustments** (`api.inventory.adjust`) run in a transaction, enforce
  the sign rule per movement type, reject negative results, and always append a
  ledger row.
- **Validation** is applied on every write (product/category/sale/settings
  inputs) and mirrored by `src/lib/checkout.ts` (`computeSaleTotals`,
  `validateSaleStock`), which is the single source of truth shared by the
  payment preview and the recorded sale.
- **Product photos are local**: the product form lets the shop pick an image
  file; it is downscaled in the browser (max 1024 px edge) and stored as a
  `data:image/…` value in the product's `imageUrl`, so the photo lives in
  IndexedDB and displays at the POS with no network. `src/lib/local/localApi.ts`
  validates `imageUrl` (uploaded photo within a size cap, an `http(s)` link, or a
  self-hosted `/…` asset path) and backup restore re-checks it.
- **Catalog references stay valid**: sample products are linked to their seeded
  categories by slug (`src/lib/local/seed.ts`); a one-time `meta`-guarded repair
  backfills any product previously stored with an empty category reference.
- **First-run seeding** runs once inside a transaction guarded by the `meta`
  `seeded` flag, so two tabs opening together cannot double-seed.

## 5. Today's sales payment summary

The dashboard's *Today's sales payment summary* is a pure view over the sales
already stored on the device — there is no separate running counter to keep in
sync, so it can never drift from the receipts.

- **Every completed sale records** its `createdAt` (local, ISO timestamp), its
  `total`, and its payment `method` (`Cash`, `POS`, `Bank Transfer`, `Other`).
  `api.sales.create` runs atomically with the stock decrement, so only *completed*
  sales are stored: an incomplete cart is never written, and the sales workflow
  has no cancelled/void state, so there is nothing else to exclude.
- **Today** is selected with the application's local-date rules
  (`startOfDay`/`endOfDay` + `filterSales` in `src/lib/analytics.ts`) and money is
  rendered with the configured currency symbol (`formatCurrency`, `en-NG`).
- **`paymentSummary`** (`src/lib/analytics.ts`) returns a per-method total and
  transaction count, the combined total, the overall transaction count and the
  average. The three core methods are always shown (even at zero); any other
  method that actually took money is appended so no takings are hidden. Sales are
  **de-duplicated by `id`**, so a completed sale can only ever be counted once.
- **Legacy sales without a payment method** are surfaced as
  `SalePaymentMethod = "Unknown"` (displayed as *Not recorded*) instead of being
  assumed to be Cash: `toSalePaymentMethod` in `src/lib/adapters.ts` maps any
  unrecognised or missing value to `"Unknown"`, and `paymentSummary` gives it its
  own row that is still included in the combined total. Stored records are never
  rewritten, so no payment detail is invented.
- **Immediate + persistent**: `checkout` prepends the new sale to store state
  (instant UI update) while the receipt has already been committed to IndexedDB,
  so the summary is identical after closing and reopening the app — with no
  network connection.

## 6. Authentication & permissions

- Authentication is real but entirely local: passwords are salted and hashed
  (SHA-256 via `crypto.subtle`, with a plain-JS fallback on insecure origins);
  only the hash is stored. Sessions are rows in the `sessions` store and the
  token is kept in `localStorage`.
- Permissions are centralised in `src/config/permissions.ts` (13 permissions,
  role matrix, `effectivePermissions`). Navigation, routes, header actions and
  page controls check `can(permission)`, and the store mutators re-check the
  permission server-side-equivalent, so the UI is not the only guard. This
  behaviour is unchanged by the offline work.

## 7. Backup & restore

Backups are a client-side JSON download and upload — no network involved.

- **Export** (`api.backup.export`, Backup page, `backup.manage` permission)
  produces:
  ```json
  { "app": "beverage-shop-pos", "version": 1, "exportedAt": "…",
    "data": { "categories": [], "products": [], "sales": [],
              "inventoryTransactions": [], "settings": {} } }
  ```
- **Restore** replaces the catalogue, sales, ledger and settings inside one
  transaction. Before anything is written it validates the envelope (app id +
  version) **and every record's shape** (`assertValidBackupRecords`); a corrupt
  or foreign file is rejected with a clear *invalid `<entity>` record* message
  rather than partially overwriting the database.
- Files produced by the optional `depot-backend` are accepted too
  (`app: "depot-backend"`).
- **Reset data** restores the bundled sample catalogue and keeps accounts and
  settings.

Backup is the only way to recover from cleared browser storage, so it should be
run regularly and the file kept off-device.

## 8. Verified offline behaviour

`npm run verify:offline` drives a real headless Chromium (over the DevTools
protocol, no extra dependencies) against a production build, then **stops the
web server mid-session** and keeps using the app. Each run uses a fresh,
throwaway browser profile so the check is repeatable. It exits non-zero on any
failure.

Verified on this machine (`npm run build && npm run verify:offline`):

- [x] App shell loads and shows the sign-in screen.
- [x] Login copy states offline operation and lists the seeded accounts.
- [x] **No requests to any third-party origin** (fonts/icons/API).
- [x] Signs in with the seeded admin account.
- [x] Seeded catalog loads after login.
- [x] Service worker controls the page; app-shell precache is populated.
- [x] A sale completes and persists (`INV-000001`), stock decremented by 1.
- [x] **App shell reloads with the server stopped** (served from cache).
- [x] Session is restored from the device while offline.
- [x] Manifest, icons and fonts are served offline.
- [x] **A sale completes while fully offline** (`INV-000002`), persisted with
      correct stock and sequential invoices.
- [x] A product is created offline with a photo picked from the device; the
      downscaled photo is stored in IndexedDB as a local `data:image/…` URL and
      renders in the catalogue with the network down.
- [x] **Backup exports offline** with products, categories, sales, stock
      movements and settings (including the stored photo).
- [x] **Backup restores offline**: a product added after the export disappears
      and sales keep their `INV-000001` / `INV-000002` numbers.
- [x] No uncaught console errors during the run.

The payment-summary calculations are covered separately by
`npm run verify:payments` (`scripts/verify-payment-summary.mjs`), which loads the
real `analytics`/`adapters`/`format` modules through Vite's SSR loader and
asserts (32 checks):

- [x] **Empty sales**: zero transactions, zero combined total, zero average, the
      three core methods shown at zero, no *Not recorded* row.
- [x] **Multiple methods + multiple transactions**: per-method totals and counts,
      combined total, overall transaction count, average and rounded shares.
- [x] **Legacy sales without a payment method**: map to `Unknown` / *Not recorded*,
      are never added to Cash, and are still counted once in the combined total.
- [x] **Local date boundaries**: `23:59:59.999` yesterday and `00:00:00.000`
      tomorrow are excluded; the first and last instant of today are included.
- [x] **De-duplication**: a sale passed three times is counted once.
- [x] **Currency**: formatted with the naira symbol and two decimals.

Other checks: `npm run typecheck` (tsc) passes and `npm run lint` (oxlint)
reports only the three pre-existing React *purity* warnings on `Date()` usage in
view components.

## 9. What is intentionally not here

- No cloud sync, no online API, no server requirement for daily operation.
- No barcode hardware integration (noted in the POS UI).
- Receipt "Print" uses the browser print dialog; there is no printer driver.
- Product images are entered through a local file picker and stored in
  IndexedDB as `data:image/…` values; seed images are self-hosted assets
  precached by the service worker. No upload endpoint or backend is involved.
- Cross-device sync is not provided: each device keeps its own IndexedDB, and
  Backup/Restore is the only way to move data between devices.
