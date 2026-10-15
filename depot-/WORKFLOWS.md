# Workflow & Data-Handling Notes

This app runs **fully offline on the shop device**. Daily operation (sign-in,
products, stock, sales, receipts) is served from **IndexedDB** in the browser; no
backend, server, or internet connection is required. The app is also an
**installable PWA** with a service-worker app shell, so it can be added to an
Android phone or laptop home screen and launched like a native app. See
[OFFLINE_PWA.md](./OFFLINE_PWA.md) for install steps, platform limits and the
verified offline scenarios.

The store talks to a single data layer behind `src/lib/data.ts`, which selects:

- **`local`** (default) — `src/lib/local/localApi.ts` + IndexedDB (`src/lib/local/db.ts`),
  seeded once with a sample catalog and two accounts (`src/lib/local/seed.ts`).
- **`remote`** — the REST client in `src/lib/api.ts` talking to the Depot backend
  (`integration.md`), selected with `VITE_DATA_BACKEND=remote`. This mode needs a
  reachable server and is **not** offline-capable.

Both implementations expose the same surface, so the store and views are unaware
of which one is active. Only the theme choice and the session token use
`localStorage`; all business data lives in IndexedDB.

## State management

Single store: `src/store/AppStore.tsx` (React Context, exposed via `useApp()`).
It holds `products`, `categories`, `sales`, `inventory` (stock ledger),
`settings`, `cart`, `session`/`staff` (mock auth) and `toasts`.

Derived values are never stored twice; views recompute them from the source
arrays:

- `src/lib/analytics.ts` — `stockSummary`, `productStats`, `sumRevenue`,
  `sumCost`, `dailySeries`, `paymentBreakdown`, `categoryStats`, …
- `src/lib/cart.ts` — `buildCartItems`, `cartSubtotal`, `lineTotal`.
- `src/lib/checkout.ts` — `computeSaleTotals`, `validateSaleStock`
  (single source of truth shared by the payment preview and the recorded sale).

Because every view derives from the same arrays, an admin edit or a completed
sale is reflected everywhere at once.

## What already works with existing data handling (fully wired)

| Workflow | Writes | Reflected in |
| --- | --- | --- |
| Add product | `products` + a `Stock received` ledger entry | Products table, POS picker, Inventory levels/history, Dashboard + Inventory valuation summaries |
| Add / replace / remove product photo | `products.imageUrl` (downscaled and stored as a local `data:image/…` value) | Products table + POS/cart Inventory thumbnails, shown offline |
| Edit product (price/cost/details) | `products` | Products table, POS picker/pricing, valuation (retail/cost), reports |
| Edit product **stock** | `products` + `Manual adjustment` ledger entry | Same as above + stock history |
| Delete product | `products` (and removes it from the cart) | Products table, POS picker, summaries |
| Toggle active | `products` | POS picker (inactive items are un-sellable), Products status |
| Add / edit / delete category | `categories` | Products form + filters, POS filter, Categories page (delete blocked while products use it) |
| Adjust stock (Inventory) | `products` + ledger entry | Inventory levels/history, Dashboard "Stock on hand" and valuation |
| POS search / filter / select | `cart` | Cart panel |
| Cart quantity / line discount / remove / clear | `cart` | Cart panel totals |
| Take payment | `sales` + decremented `products` + `Sale` ledger entries + cleared `cart` | Receipt preview/print, Sales history, Dashboard (recent sales, revenue, trend, payment split), Books values, Inventory history |

The POS computes subtotal, per-line totals, discounts, optional tax, total,
amount paid and change. `validateSaleStock` blocks oversells, inactive products
and removed products before a sale is recorded. Receipts render from the stored
sale object, so the printed figure always equals the recorded figure.

## Permission enforcement (Admin vs Staff)

- Central definitions: `src/config/permissions.ts` (13 permissions, role matrix,
  `effectivePermissions`). Admin always resolves to every permission; staff get
  the operational subset (dashboard, POS, products view, inventory view, sales view).
- Nav, routes (`RequirePermission` → `AccessDenied`), header actions and page
  buttons/columns check `can(permission)` — no `role === "admin"` checks remain in
  feature code.
- Store mutators also re-check the permission (`products.manage`,
  `categories.manage`, `inventory.adjust`, `settings.manage`, `backup.manage`,
  `pos.sell`) and no-op/reject when absent, so the UI is not the only guard.
- Admin-only staff management lives on `/team` (`StaffFormModal`) and can grant
  or revoke individual permissions per staff account.

## Persistence, authentication and offline behavior

- **Authentication is real (locally).** Passwords are salted and hashed (SHA-256
  via `crypto.subtle`, with a plain-JS fallback on insecure origins) in
  `src/lib/local/db.ts`; only the hash is stored. The seeded accounts are
  `dazumiglobalventuresadmin@gmail.com` / `Admin@001` (admin) and
  `dazumiglobalventuresstaff@gmail.com` / `Staff@002` (staff), and sign-in
  accepts either the account email or the account name ("Admin", "Staff").
  Change them from the Team page.
- **Everything persists.** Products, stock, the inventory ledger, sales,
  settings and staff edits are written to IndexedDB and **survive reloads and
  restarts**. `navigator.storage.persist()` is requested so the browser is less
  likely to evict the database.
- **Backup/restore** is a client-side JSON download/upload (Admin only). The
  file carries `app: "beverage-shop-pos"`, a version, a timestamp and the
  `categories`, `products`, `sales`, `inventoryTransactions` and `settings`
  arrays. Restore accepts files from both the local app and the Depot backend
  (`app: "depot-backend"`).
- **Reset to sample data** (Backup page → "Reset data") restores the seed
  catalog/accounts; use it to clear test data before handing the device over.
- **Receipt "Print"** calls the browser print dialog — there is no printer
  integration.
- **Barcode scanning** is not implemented (the POS notes this).
- **The service worker** (`scripts/generate-sw.mjs` → `dist/sw.js`) precaches the
  whole built app shell (JS/CSS/HTML, self-hosted fonts, icons, product images)
  and serves it when the network is unavailable. It is registered in production
  builds only (`src/lib/pwa.ts`); `npm run dev` is unaffected.

## Changes made in this review

1. **Tax preview/record mismatch fixed** — the payment dialog and the store now
   both call `computeSaleTotals`, and the `applyTax` choice is persisted with the
   sale, so the previewed total equals the recorded total.
2. **`addProduct` / `addCategory` are now permission-guarded** (return `null`
   without `products.manage` / `categories.manage`).
3. **`checkout` is permission-guarded** (`pos.sell`).
4. **`adjustStock` de-duplicated under React StrictMode** — it no longer nests a
   `setInventory` call inside a `setProducts` updater, which previously could
   double-log ledger entries in development.
5. **Editing a product's stock now records a stock-ledger entry**, so the
   inventory history stays consistent with the product form.
6. **Payment summary data layer** — every completed sale stores its timestamp,
   total and payment method; `paymentSummary` (`src/lib/analytics.ts`) computes
   today's totals per method plus the combined total and transaction count, with
   sales de-duplicated by `id`. Legacy sales that never captured a payment method
   are shown as *Not recorded* (`SalePaymentMethod = "Unknown"`) rather than being
   counted as Cash, so the books never invent payment details.

## How to verify

```bash
npm run typecheck   # tsc -b
npm run lint        # oxlint (3 pre-existing purity warnings)
npm run build       # tsc -b && vite build && generate sw.js
npm run verify:payments   # today's payment-summary calculations
npm run dev         # http://localhost:5173
```

Sign in as `admin` to exercise catalog/stock/team flows; sign in as `staff` to
confirm restricted routes show "Access denied" and that management controls are
hidden. Pure data-handling checks live in the workflow/permission unit tests used
during development (cart maths, stock validation, summary consistency, role
matrix). The payment-summary calculations are verified by
`npm run verify:payments`, and the offline/PWA behavior is verified end-to-end
against a production build — see the checklist in
[OFFLINE_PWA.md](./OFFLINE_PWA.md#verified-scenarios).
