import http from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.OFFLINE_TEST_PORT || 4180);
const BASE = `http://localhost:${PORT}`;
// A unique throwaway profile per run, so IndexedDB (and therefore invoice
// numbering) always starts empty. A reused profile would make the checks pass
// once and fail on every later run because the stored sales persist.
const PROFILE = await mkdtemp(join(tmpdir(), "beverage-pos-offline-check-"));
const DEBUG_PORT = Number(process.env.OFFLINE_TEST_DEBUG_PORT || 9333);
const CHROME = process.env.CHROME || "chromium";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

let server;
const results = [];
let failures = 0;

function check(label, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  server = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, BASE).pathname);
      if (path === "/") path = "/index.html";
      const target = normalize(join(DIST, path));
      if (!target.startsWith(DIST)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      let file = target;
      try {
        const info = await stat(file);
        if (info.isDirectory()) file = join(file, "index.html");
      } catch {
        file = join(DIST, "index.html");
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Service-Worker-Allowed": "/",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(404).end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
}

function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      this.events.push(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

async function connect() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const info = await res.json();
      return info.webSocketDebuggerUrl;
    } catch {
      await delay(200);
    }
  }
  throw new Error("Chromium did not expose a debugging endpoint");
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);

await startServer();

const wsUrl = await connect();
const socket = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve);
  socket.addEventListener("error", reject);
});
const cdp = new CDP(socket);

const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", {
  targetId,
  flatten: true,
});

const requestUrls = [];
const requestOutcomes = new Map();
const failedRequests = new Set();
const succeededRequests = new Set();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Network.requestWillBeSent") {
    requestUrls.push(message.params.request.url);
    requestOutcomes.set(message.params.requestId, message.params.request.url);
  }
  if (message.method === "Network.responseReceived") {
    const url = message.params.response.url;
    if (url.startsWith("http")) succeededRequests.add(url);
  }
  if (message.method === "Network.loadingFailed") {
    const url = requestOutcomes.get(message.params.requestId);
    if (url) failedRequests.add(url);
  }
});

await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Network.enable", {}, sessionId);

let consoleErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    consoleErrors.push(
      message.params.exceptionDetails?.exception?.description ||
        message.params.exceptionDetails?.text ||
        "unknown exception",
    );
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    consoleErrors.push(
      message.params.args.map((a) => a.value ?? a.description ?? "").join(" "),
    );
  }
});

async function evaluate(expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(
      `evaluate failed: ${
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text
      }`,
    );
  }
  return result.result.value;
}

async function waitFor(expression, { timeout = 10000, label = expression } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(`!!(${expression})`)) return true;
    } catch {
      /* page may be mid-navigation */
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

const setInput = (selector, value) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return "missing";
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return "ok";
  })()`);

const clickText = (text) =>
  evaluate(`(() => {
    const nodes = [...document.querySelectorAll("button, a")];
    const el = nodes.find((node) => node.textContent.trim().includes(${JSON.stringify(text)}));
    if (!el) return "missing";
    el.click();
    return "ok";
  })()`);

const bodyText = () => evaluate("document.body.innerText");

async function waitForValue(expression, { timeout = 10000, label = expression } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await evaluate(`(async () => (${expression}))()`);
      if (value) return value;
    } catch {
      /* page may be mid-navigation */
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

const clickInDialog = (text) =>
  evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return "missing-dialog";
    const el = [...dialog.querySelectorAll("button, a")].find((node) =>
      node.textContent.trim().includes(${JSON.stringify(text)}),
    );
    if (!el) return "missing-button";
    el.click();
    return "ok";
  })()`);

async function setFileInput(selector, filePath) {
  await cdp.send("DOM.enable", {}, sessionId);
  const doc = await cdp.send("DOM.getDocument", { depth: -1 }, sessionId);
  const found = await cdp.send(
    "DOM.querySelector",
    { nodeId: doc.root.nodeId, selector },
    sessionId,
  );
  if (!found || !found.nodeId) {
    throw new Error(`file input not found: ${selector}`);
  }
  await cdp.send(
    "DOM.setFileInputFiles",
    { files: [filePath], nodeId: found.nodeId },
    sessionId,
  );
}

const readIndexedDb = (body) =>
  evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("beverage-shop-pos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const getAll = (store) =>
      new Promise((resolve) => {
        const req = db.transaction(store, "readonly").objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    ${body}
  })()`);

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode a solid-colour truecolour PNG, so the check needs no binary fixture. */
function makePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Fill the add-product dialog and submit it; `imagePath` is optional. */
async function addProductThroughUi(name, price, imagePath) {
  await clickText("Add product");
  await waitFor(`document.querySelector('[role="dialog"]')`, {
    label: "product dialog",
  });
  await setInput(
    '[role="dialog"] input[placeholder^="e.g. Coca-Cola"]',
    name,
  );
  await setInput('[role="dialog"] input[placeholder="0.00"]', String(price));
  if (imagePath) {
    await setFileInput('[role="dialog"] input[type="file"]', imagePath);
    await waitFor(
      `document.querySelector('[role="dialog"] img[src^="data:image/"]')`,
      { timeout: 15000, label: "image preview" },
    );
  }
  await clickInDialog("Add product");
  await waitFor(`!document.querySelector('[role="dialog"]')`, {
    label: "product dialog closes",
  });
}

async function navigate(url) {
  await cdp.send("Page.navigate", { url }, sessionId);
  await delay(400);
  await waitFor(
    `document.readyState === "complete" && document.body && document.body.innerText.length > 0`,
    { timeout: 20000, label: "page load" },
  );
}

try {
  await navigate(BASE + "/");

  await waitFor(`document.querySelector('#login-email')`, {
    label: "login form",
  });
  check("App shell loads and shows the sign-in screen", true);

  const loginText = await bodyText();
  check(
    "Login copy mentions offline operation",
    /works offline/i.test(loginText),
    loginText.split("\n").find((line) => /offline/i.test(line)) || "",
  );
  check(
    "Login copy lists the seeded credentials",
    /admin \/ admin123/.test(loginText),
  );

  check(
    "No requests to third-party origins (fonts/icons/API)",
    requestUrls.every((url) => url.startsWith(BASE) || url.startsWith("data:")),
    requestUrls.filter((url) => !url.startsWith(BASE)).join(", ") || "none",
  );

  await setInput("#login-email", "admin");
  await setInput('input[type="password"]', "admin123");
  await clickText("Sign in");

  await waitFor(`!document.querySelector('#login-email')`, {
    timeout: 15000,
    label: "authenticated shell after login",
  });
  check("Signs in with the seeded admin account", true);

  await navigate(BASE + "/pos");
  await waitFor(`document.body.innerText.includes("Coca-Cola 50cl")`, {
    timeout: 10000,
    label: "POS catalog",
  });
  const posText = await bodyText();
  check("Seeded catalog loads after login", /Coca-Cola/.test(posText));

  check(
    "Service worker is controlling the page",
    Boolean(await evaluate("navigator.serviceWorker.controller")),
    await evaluate("String(navigator.serviceWorker.controller?.scriptURL)"),
  );

  const cacheKeys = await evaluate("caches.keys()");
  check(
    "App shell precache is populated",
    cacheKeys.some((key) => key.startsWith("vendor-pos-shell-")),
    cacheKeys.join(", "),
  );

  const stockBefore = await evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("beverage-shop-pos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("products", "readonly");
    const all = await new Promise((resolve) => {
      const req = tx.objectStore("products").getAll();
      req.onsuccess = () => resolve(req.result);
    });
    const product = all.find((item) => String(item.name).includes("Coca-Cola 50cl"));
    return { id: product._id, stock: product.stock };
  })()`);

  await clickText("Coca-Cola 50cl");
  await waitFor(`document.body.innerText.includes("Charge")`, {
    label: "cart with an item",
  });
  await clickText("Charge");
  await waitFor(`document.body.innerText.includes("Take payment")`, {
    label: "payment dialog",
  });
  await clickText("Bank Transfer");

  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      node.textContent.trim().startsWith("Complete sale"),
    );
    if (!button) return "missing";
    button.click();
    return "ok";
  })()`);

  await waitFor(`document.body.innerText.includes("INV-000001")`, {
    timeout: 15000,
    label: "receipt with invoice INV-000001",
  });
  check("Sale completed online persists with invoice INV-000001", true);

  const afterOnline = await evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("beverage-shop-pos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const getAll = (store) =>
      new Promise((resolve) => {
        const req = db.transaction(store, "readonly").objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    const sales = await getAll("sales");
    const products = await getAll("products");
    const product = products.find((item) => item._id === ${JSON.stringify(
      stockBefore.id,
    )});
    return { sales: sales.length, stock: product.stock, total: sales[0]?.total, tax: sales[0]?.tax };
  })()`);
  check(
    "Stock decreased by 1 and sale stored in IndexedDB",
    afterOnline.stock === stockBefore.stock - 1 && afterOnline.sales === 1,
    JSON.stringify(afterOnline),
  );

  await clickText("New sale");
  await delay(300);

  console.log("\n--- going offline (static server stopped) ---\n");
  await stopServer();
  requestUrls.length = 0;
  succeededRequests.clear();
  failedRequests.clear();

  await cdp.send("Page.reload", { ignoreCache: true }, sessionId);
  await waitFor(
    `document.readyState === "complete" && document.body && document.body.innerText.length > 0`,
    { timeout: 20000, label: "offline reload" },
  );

  const offlineText = await bodyText();
  check(
    "App shell reloads with the server offline",
    offlineText.length > 0 && !/Could not load shop data/i.test(offlineText),
    offlineText.split("\n")[0],
  );
  const offlineHttpSuccesses = [...succeededRequests].filter((url) =>
    url.startsWith(BASE) || !url.startsWith("data:"),
  );
  check(
    "Offline shell served from cache (network navigation failed, SW responded)",
    failedRequests.has(BASE + "/pos") && offlineHttpSuccesses.length === 0,
    `failed: ${[...failedRequests].join(", ") || "none"} | succeeded: ${
      offlineHttpSuccesses.join(", ") || "none"
    }`,
  );

  const isLoginVisible = await evaluate(
    `Boolean(document.querySelector('#login-email'))`,
  );
  if (isLoginVisible) {
    await setInput("#login-email", "admin");
    await setInput('input[type="password"]', "admin123");
    await clickText("Sign in");
    await waitFor(`!document.querySelector('#login-email')`, {
      timeout: 15000,
      label: "login while offline",
    });
    check("Can sign in while offline", true);
  } else {
    check("Session restored from the device while offline", true);
  }

  await navigate(BASE + "/pos");
  await waitFor(`document.body.innerText.includes("Coca-Cola 50cl")`, {
    timeout: 10000,
    label: "POS catalog offline",
  });

  const offlineAssets = await evaluate(`(async () => {
    const results = {};
    for (const path of ["/icons/icon-192.png", "/manifest.webmanifest", "/fonts/plus-jakarta-sans-latin.woff2"]) {
      try {
        const response = await fetch(path);
        results[path] = response.status;
      } catch (error) {
        results[path] = String(error);
      }
    }
    return results;
  })()`);
  check(
    "Manifest, icons and fonts are available offline",
    Object.values(offlineAssets).every((status) => status === 200),
    JSON.stringify(offlineAssets),
  );

  await clickText("Coca-Cola 50cl");
  await clickText("Charge");
  await waitFor(`document.body.innerText.includes("Take payment")`, {
    label: "payment dialog offline",
  });
  await clickText("Bank Transfer");
  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      node.textContent.trim().startsWith("Complete sale"),
    );
    if (button) button.click();
    return "ok";
  })()`);

  await waitFor(`document.body.innerText.includes("INV-000002")`, {
    timeout: 15000,
    label: "offline receipt INV-000002",
  });
  check("Sale completes while fully offline (INV-000002)", true);

  const afterOffline = await evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("beverage-shop-pos");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const getAll = (store) =>
      new Promise((resolve) => {
        const req = db.transaction(store, "readonly").objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    const sales = await getAll("sales");
    const products = await getAll("products");
    const product = products.find((item) => item._id === ${JSON.stringify(
      stockBefore.id,
    )});
    return {
      sales: sales.length,
      stock: product.stock,
      invoiceNos: sales.map((sale) => sale.invoiceNumber).sort(),
    };
  })()`);
  check(
    "Offline sale persisted with correct stock and invoices",
    afterOffline.sales === 2 &&
      afterOffline.stock === stockBefore.stock - 2 &&
      afterOffline.invoiceNos.join(",") === "INV-000001,INV-000002",
    JSON.stringify(afterOffline),
  );

  // --- product photos are stored locally while offline ---
  const imagePath = join(PROFILE, "local-product.png");
  await writeFile(imagePath, makePng(32, 32, [30, 90, 220]));

  await navigate(BASE + "/products");
  await waitFor(`document.body.innerText.includes("Add product")`, {
    label: "products page",
  });
  await addProductThroughUi("Offline Photo Drink", 3.5, imagePath);

  const storedImage = await readIndexedDb(`
    const products = await getAll("products");
    const created = products.find((item) => item.name === "Offline Photo Drink");
    if (!created || typeof created.imageUrl !== "string") return null;
    return {
      kind: created.imageUrl.split(";")[0],
      chars: created.imageUrl.length,
    };
  `);
  check(
    "Product photo is resized and stored in IndexedDB as a local data URL",
    Boolean(storedImage) &&
      storedImage.kind.startsWith("data:image/") &&
      storedImage.chars > 100 &&
      storedImage.chars <= 1200000,
    JSON.stringify(storedImage),
  );
  check(
    "Stored photo renders in the catalogue with no network",
    Boolean(
      await evaluate(
        `Boolean(document.querySelector('img[src^="data:image/"]'))`,
      ),
    ),
  );

  // --- local backup export + restore, still fully offline ---
  const backupPath = join(PROFILE, "offline-backup.json");
  await navigate(BASE + "/backup");
  await waitFor(`document.body.innerText.includes("Download backup")`, {
    label: "backup page",
  });
  await evaluate(`(() => {
    window.__backupJson = null;
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__backupBlob = blob;
      return realCreate(blob);
    };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.download.endsWith(".json")) {
        window.__backupBlob?.text().then((text) => {
          window.__backupJson = text;
        });
        return;
      }
      return realClick.call(this);
    };
    return "ok";
  })()`);
  await clickText("Download backup");
  const backupJson = await waitForValue("window.__backupJson", {
    label: "captured backup JSON",
  });
  await writeFile(backupPath, backupJson);

  let parsedBackup = null;
  try {
    parsedBackup = JSON.parse(backupJson);
  } catch {
    parsedBackup = null;
  }
  check(
    "Backup export contains products, sales, movements and settings offline",
    Boolean(parsedBackup) &&
      parsedBackup.app === "beverage-shop-pos" &&
      Array.isArray(parsedBackup.data.products) &&
      parsedBackup.data.sales.length === 2 &&
      Array.isArray(parsedBackup.data.inventoryTransactions) &&
      Boolean(parsedBackup.data.settings) &&
      parsedBackup.data.products.some((product) =>
        String(product.imageUrl ?? "").startsWith("data:image/"),
      ),
    parsedBackup
      ? `products=${parsedBackup.data.products.length} sales=${parsedBackup.data.sales.length}`
      : "unreadable",
  );

  // Add a product *after* exporting, then restore and confirm it disappears.
  await navigate(BASE + "/products");
  await waitFor(`document.body.innerText.includes("Add product")`, {
    label: "products page before restore",
  });
  await addProductThroughUi("Restore Probe Drink", 2, undefined);

  const beforeRestore = await readIndexedDb(
    `return { total: (await getAll("products")).length };`,
  );

  await navigate(BASE + "/backup");
  await waitFor(`document.body.innerText.includes("Choose a backup file")`, {
    label: "backup page before restore",
  });
  await setFileInput('input[type="file"][accept*="json"]', backupPath);
  await waitFor(`document.querySelector('[role="dialog"]')`, {
    label: "restore confirmation",
  });
  await clickInDialog("Restore backup");

  let afterRestore = null;
  const restoreDeadline = Date.now() + 15000;
  while (Date.now() < restoreDeadline) {
    afterRestore = await readIndexedDb(`
      const products = await getAll("products");
      if (products.some((item) => item.name === "Restore Probe Drink")) return null;
      return { total: products.length };
    `);
    if (afterRestore) break;
    await delay(200);
  }
  check(
    "Backup restore replaces local data offline",
    Boolean(afterRestore) &&
      parsedBackup &&
      afterRestore.total === parsedBackup.data.products.length &&
      beforeRestore.total === parsedBackup.data.products.length + 1,
    `before=${beforeRestore.total} after=${afterRestore?.total} backup=${parsedBackup?.data.products.length}`,
  );

  const restoredSales = await readIndexedDb(`
    const sales = await getAll("sales");
    return { count: sales.length, invoiceNos: sales.map((sale) => sale.invoiceNumber).sort() };
  `);
  check(
    "Restored receipts keep their sequential invoice numbers",
    restoredSales.count === 2 &&
      restoredSales.invoiceNos.join(",") === "INV-000001,INV-000002",
    JSON.stringify(restoredSales),
  );

  check(
    "No uncaught console errors during the run",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | ") || "none",
  );
} catch (error) {
  failures += 1;
  console.log(`\nFATAL  ${error.message}`);
} finally {
  console.log("\n================ SUMMARY ================");
  for (const line of results) console.log(line);
  console.log(`failures: ${failures}`);
  try {
    await stopServer();
  } catch {
    /* already stopped */
  }
  chrome.kill("SIGKILL");
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {
    /* the OS will clean the temp dir up eventually */
  });
  process.exit(failures === 0 ? 0 : 1);
}
