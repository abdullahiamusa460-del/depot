# Workflow & Data-Handling Notes

This app is a **frontend-only demonstration**. There is no backend, API, server
authentication, or database. All state lives in memory (React Context) and is
seeded on every page load. Nothing is written to disk except the theme choice and
the mock login session in `localStorage`.

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

## Demonstrations (not real / not permanent)

- **Authentication is a mock.** Credentials (`admin`/`admin123`,
  `staff`/`staff123`) are plain text in `src/config/demoAccounts.ts`, bundled and
  publicly readable. The session is a `localStorage` flag only.
- **No persistence.** Products, stock, sales, inventory history and staff edits
  live in memory and **reset on reload**. Completed sales do not survive a
  refresh and are not written anywhere.
- **Backup/restore** is client-side JSON download/upload (Admin only); it is the
  only way to carry demo data between sessions.
- **Receipt "Print"** calls the browser print dialog — there is no printer
  integration.
- **Barcode scanning** is not implemented (the POS notes this).
- "Offline-first" means no network calls; there is no service-worker cache.

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

## How to verify

```bash
npm run typecheck   # tsc -b
npm run lint        # oxlint (3 pre-existing purity warnings)
npm run build       # tsc -b && vite build
npm run dev         # http://localhost:5173
```

Sign in as `admin` to exercise catalog/stock/team flows; sign in as `staff` to
confirm restricted routes show "Access denied" and that management controls are
hidden. Pure data-handling checks live in the workflow/permission unit tests used
during development (cart maths, stock validation, summary consistency, role
matrix).
