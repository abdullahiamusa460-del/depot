/**
 * Verifies the "Today's sales payment summary" calculations against the real
 * application code (no re-implementation). It loads the TypeScript modules with
 * Vite's SSR loader — the same toolchain the app builds with — so the tested
 * functions are exactly the ones the UI runs.
 *
 * Covers: empty sales, multiple payment methods, multiple transactions, local
 * date boundaries, de-duplication of completed sales, and legacy sales that were
 * recorded without a payment method (they must never be reported as Cash).
 *
 * Run with: npm run verify:payments
 */
import { createServer } from "vite";

const root = new URL("..", import.meta.url).pathname;
const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const results = [];
let failures = 0;

function check(label, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function approx(a, b) {
  return Math.abs(a - b) < 1e-9;
}

try {
  const analytics = await server.ssrLoadModule("/src/lib/analytics.ts");
  const adapters = await server.ssrLoadModule("/src/lib/adapters.ts");
  const format = await server.ssrLoadModule("/src/lib/format.ts");
  const types = await server.ssrLoadModule("/src/types/index.ts");

  const { paymentSummary, filterSales, startOfDay, endOfDay } = analytics;
  const { toSale, toSalePaymentMethod } = adapters;
  const { formatCurrency } = format;
  const { paymentMethodLabel } = types;

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------
  const localIso = (date, hours, minutes = 0, seconds = 0, ms = 0) => {
    const d = new Date(date);
    d.setHours(hours, minutes, seconds, ms);
    return d.toISOString();
  };

  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const tomorrow = new Date(today.getTime() + 86400000);

  let counter = 0;
  const nextId = () => `sale${String(++counter).padStart(3, "0")}`;

  // Build a completed domain Sale (what the store holds after checkout).
  const makeSale = (overrides = {}) => ({
    id: nextId(),
    invoiceNo: `INV-${counter}`,
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    amountPaid: 0,
    change: 0,
    paymentMethod: "Cash",
    customer: { name: "", phone: "" },
    createdAt: localIso(today, 12, 0, 0, 0),
    ...overrides,
  });

  const rowFor = (summary, method) =>
    summary.rows.find((row) => row.method === method);

  // ---------------------------------------------------------------------------
  // 1. Empty sales
  // ---------------------------------------------------------------------------
  {
    const summary = paymentSummary([]);
    check("Empty sales: no transactions", summary.transactions === 0);
    check("Empty sales: combined total is 0", summary.total === 0);
    check("Empty sales: average is 0", summary.average === 0);
    check(
      "Empty sales: the three core methods are shown at zero",
      ["Cash", "POS", "Bank Transfer"].every((m) => {
        const row = rowFor(summary, m);
        return row && row.total === 0 && row.transactions === 0;
      }),
      summary.rows.map((r) => r.method).join(", "),
    );
    check(
      "Empty sales: no 'Not recorded' bucket when there is nothing to record",
      rowFor(summary, "Unknown") === undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Multiple payment methods and multiple transactions
  // ---------------------------------------------------------------------------
  {
    const cash1 = 500;
    const cash2 = 1500;
    const pos = 2000;
    const bank = 3000;
    const sales = [
      makeSale({ paymentMethod: "Cash", total: cash1 }),
      makeSale({ paymentMethod: "Cash", total: cash2 }),
      makeSale({ paymentMethod: "POS", total: pos }),
      makeSale({ paymentMethod: "Bank Transfer", total: bank }),
    ];

    const summary = paymentSummary(sales);
    const cash = rowFor(summary, "Cash");
    const posRow = rowFor(summary, "POS");
    const bankRow = rowFor(summary, "Bank Transfer");

    check("Multi-method: Cash total", cash.total === cash1 + cash2, String(cash.total));
    check("Multi-method: Cash transaction count", cash.transactions === 2);
    check("Multi-method: POS total", posRow.total === pos);
    check("Multi-method: POS transaction count", posRow.transactions === 1);
    check("Multi-method: Bank Transfer total", bankRow.total === bank);
    check(
      "Multi-method: combined total equals the sum of every method",
      summary.total === cash1 + cash2 + pos + bank,
      String(summary.total),
    );
    check("Multi-method: total transaction count", summary.transactions === 4);
    check(
      "Multi-method: average = total / transactions",
      approx(summary.average, summary.total / 4),
      String(summary.average),
    );
    check(
      "Multi-method: each share is the method's rounded portion of the total",
      [cash, posRow, bankRow].every(
        (row) => row.share === Math.round((row.total / summary.total) * 100),
      ),
      [cash, posRow, bankRow].map((r) => `${r.method}:${r.share}`).join(" "),
    );
    check(
      "Multi-method: rounded shares add up to 100 (within rounding)",
      Math.abs(
        summary.rows.reduce((sum, row) => sum + row.share, 0) - 100,
      ) <= 1,
      String(summary.rows.reduce((sum, row) => sum + row.share, 0)),
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Legacy sale without a payment method (must not be reported as Cash)
  // ---------------------------------------------------------------------------
  {
    const legacyApiSale = {
      _id: "legacy1",
      invoiceNumber: "INV-LEGACY",
      items: [],
      subtotal: 700,
      discount: 0,
      total: 700,
      amountPaid: 700,
      change: 0,
      // paymentMethod intentionally missing
      customer: { name: "", phone: "" },
      note: "",
      staff: null,
      createdAt: localIso(today, 9, 30, 0, 0),
      updatedAt: localIso(today, 9, 30, 0, 0),
    };

    check(
      "Legacy: adapter maps an unknown/missing method to Unknown",
      toSalePaymentMethod(undefined) === "Unknown" &&
        toSalePaymentMethod("") === "Unknown",
    );
    check(
      "Legacy: label reads 'Not recorded'",
      paymentMethodLabel("Unknown") === "Not recorded",
    );

    const sale = toSale(legacyApiSale);
    check("Legacy: toSale does not invent Cash", sale.paymentMethod === "Unknown", sale.paymentMethod);

    const cashSale = makeSale({ paymentMethod: "Cash", total: 1000 });
    const summary = paymentSummary([sale, cashSale]);

    const cashRow = rowFor(summary, "Cash");
    const unknownRow = rowFor(summary, "Unknown");
    check("Legacy: Cash takes only the real cash sale", cashRow.total === 1000, String(cashRow.total));
    check("Legacy: Cash count excludes the legacy sale", cashRow.transactions === 1);
    check(
      "Legacy: a separate 'Not recorded' row holds the unknown sale",
      unknownRow && unknownRow.total === 700 && unknownRow.transactions === 1,
    );
    check(
      "Legacy: combined total still includes the legacy sale once",
      summary.total === 1700 && summary.transactions === 2,
      String(summary.total),
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Local date boundaries
  // ---------------------------------------------------------------------------
  {
    const atYesterdayEnd = makeSale({ createdAt: localIso(yesterday, 23, 59, 59, 999), total: 111 });
    const atTodayStart = makeSale({ createdAt: localIso(today, 0, 0, 0, 0), total: 222 });
    const midday = makeSale({ createdAt: localIso(today, 12, 0, 0, 0), total: 333 });
    const atTodayEnd = makeSale({ createdAt: localIso(today, 23, 59, 59, 999), total: 444 });
    const atTomorrowStart = makeSale({ createdAt: localIso(tomorrow, 0, 0, 0, 0), total: 555 });

    const all = [atYesterdayEnd, atTodayStart, midday, atTodayEnd, atTomorrowStart];
    const range = { from: startOfDay(today), to: endOfDay(today) };
    const todaySales = filterSales(all, range);

    check(
      "Date boundary: 23:59:59.999 yesterday is excluded",
      !todaySales.includes(atYesterdayEnd),
    );
    check(
      "Date boundary: 00:00:00.000 today is included",
      todaySales.includes(atTodayStart),
    );
    check(
      "Date boundary: 23:59:59.999 today is included",
      todaySales.includes(atTodayEnd),
    );
    check(
      "Date boundary: 00:00:00.000 tomorrow is excluded",
      !todaySales.includes(atTomorrowStart),
    );

    const summary = paymentSummary(todaySales);
    check(
      "Date boundary: summary covers only today's three sales",
      summary.transactions === 3 && summary.total === 222 + 333 + 444,
      `txns=${summary.transactions} total=${summary.total}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Duplicate completed sales are only counted once
  // ---------------------------------------------------------------------------
  {
    const sale = makeSale({ paymentMethod: "POS", total: 400 });
    const summary = paymentSummary([sale, sale, { ...sale }]);
    check(
      "Duplicate: same sale counted once in transactions",
      summary.transactions === 1,
      String(summary.transactions),
    );
    check("Duplicate: same sale counted once in total", summary.total === 400);
    check(
      "Duplicate: per-method row not double counted",
      rowFor(summary, "POS").transactions === 1 &&
        rowFor(summary, "POS").total === 400,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Currency uses the application's local rules
  // ---------------------------------------------------------------------------
  {
    check(
      "Currency: formatted with the naira symbol and two decimals",
      formatCurrency(1234.5, "₦") === "₦1,234.50",
      formatCurrency(1234.5, "₦"),
    );
    check(
      "Currency: zero is formatted consistently",
      formatCurrency(0, "₦") === "₦0.00",
      formatCurrency(0, "₦"),
    );
  }
} finally {
  await server.close();
}

console.log("\n================ SUMMARY ================");
for (const line of results) console.log(line);
console.log(`failures: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
