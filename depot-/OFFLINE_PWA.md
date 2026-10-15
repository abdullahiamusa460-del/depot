# Offline PWA — Install, Limits & Verified Scenarios

The app is an **offline-first, installable PWA**. Once it has been opened once on
a device, the whole app shell and all business data live on that device: the
till keeps selling with **no server and no internet**.

- **Data layer:** IndexedDB database `beverage-shop-pos`
  (`src/lib/local/db.ts`, `src/lib/local/localApi.ts`).
- **App shell:** service worker generated into `dist/sw.js`
  (`scripts/generate-sw.mjs`), registered by `src/lib/pwa.ts`.
- **Manifest:** `public/manifest.webmanifest` (standalone, masked + any icons).
- **Fonts:** Plus Jakarta Sans is self-hosted in `public/fonts/` — no Google
  Fonts request, so there is no third-party dependency at runtime.

---

## 1. Build and run

```bash
npm install
npm run build            # tsc -b && vite build && node scripts/generate-sw.mjs
npm run preview          # serves dist/ (http://localhost:4173)
```

`npm run build` produces:

| Artifact | Purpose |
| --- | --- |
| `dist/assets/*.js`, `*.css` | Hashed app bundle |
| `dist/index.html` | App shell |
| `dist/sw.js` | Generated service worker + precache list |
| `dist/manifest.webmanifest` | PWA manifest |
| `dist/icons/*.png` | 192/512 any, 512 maskable, apple-touch, favicons |
| `dist/fonts/*.woff2` | Self-hosted font subsets |
| `dist/images/products/*.jpg` | Local product photos |

> The service worker is registered **only in production builds**. `npm run dev`
> stays uncached so edits appear immediately.

---

## 2. Install steps

A service worker (and therefore installability) requires a **secure context**:
`https://…` or `http://localhost`. A plain-HTTP LAN address (e.g.
`http://192.168.1.20:4000`) is **not** secure and will not install — use one of
the options in §3.

### Android (Chrome / Edge)

1. Serve the built app over HTTPS (or `localhost`) — see §3.
2. Open the app and sign in once so the catalog seeds.
3. Chrome menu (**⋮**) → **Add to Home screen** / **Install app**.
   (The install prompt may also appear automatically.)
4. Launch from the home screen — it opens standalone, no browser chrome.
5. Put the phone in **Airplane mode** and open it again to confirm it still works.

### Laptop / desktop (Chrome, Edge)

1. Serve over HTTPS or `localhost`.
2. Open the app and sign in once.
3. Click the **install** icon in the address bar (or menu → *Install …*).
4. Launch the installed window and toggle Wi-Fi off to confirm offline operation.

### iOS / iPadOS (Safari)

1. Serve over **HTTPS**.
2. Open in Safari → **Share** → **Add to Home Screen**.
3. Launch from the home screen. (iOS has no install prompt and clears storage
   after long inactivity — see §3.)

### Hosting options

| Option | HTTPS? | Notes |
| --- | --- | --- |
| Any static host (Netlify, GitHub Pages, nginx + cert, Caddy) | Yes | Recommended. `dist/` is fully static; configure SPA fallback to `index.html`. |
| `npm run preview` / `vite preview` on the device | localhost only | Secure context on that machine only. |
| `adb reverse tcp:4173 tcp:4173` + open `http://localhost:4173` on the phone | Yes (localhost) | Great for testing on a real Android device when the PC runs the server. |
| Plain `http://<lan-ip>:<port>` | No | **Will not install** and the service worker will not register. |

The app still runs (and persists data) over plain HTTP — it just is not
installable/offline-cached there, because browsers require a secure context for
service workers.

### Updating an installed app

Deploying a new build changes the precache manifest, so the service worker
replaces the old cache on the next load. The **currently open window keeps
running the code it started with** (a sale is never interrupted); the new version
takes effect on the next launch or full reload. Back up first if a release could
affect stored data (see §5).

---

## 3. Platform limitations

- **Secure context required** for the service worker/install (HTTPS or
  `localhost`). This is a browser rule; a plain-HTTP LAN URL cannot cache the app
  shell even though the app itself still works.
- **IndexedDB is the single source of truth on the device.** It is per-browser
  and per-profile. Clearing site data / browser storage, "clear cache", private
  or incognito windows, or uninstalling the browser **erase the shop's data**.
- **`navigator.storage.persist()`** is requested at startup to reduce the chance
  of eviction under storage pressure, but it is best-effort and browsers may
  still evict data (iOS Safari is the most aggressive).
- **No cross-device sync.** Two phones hold two independent databases. Use
  Backup/Restore for moving data; there is no merge.
- **iOS Safari**: no install prompt (manual *Add to Home Screen*), service-worker
  storage can be cleared after ~7 days of inactivity, and background refresh is
  unreliable.
- **One writer per device** is assumed. IndexedDB transactions keep each sale
  atomic, but two browser tabs editing the same catalog simultaneously are not
  coordinated.
- **Remote mode is not offline.** `VITE_DATA_BACKEND=remote` talks to the Depot
  backend over the network and has none of these guarantees.

---

## 4. Data backend selection

`src/lib/data.ts` chooses the implementation at build time:

```bash
# default — offline, IndexedDB on the device
npm run build

# opt-in REST client against the Depot backend (needs a server; not offline)
VITE_DATA_BACKEND=remote npm run build
```

Both expose the same API surface, so the UI is identical. The local mode is the
default deliberately: it is the only mode that satisfies the offline requirement.

---

## 5. Backup & recovery

- **Export** (Backup page, Admin only) downloads a JSON file:
  `{ app: "beverage-shop-pos", version, exportedAt, data: { categories,
  products, sales, inventoryTransactions, settings } }`. Locally stored product
  photos (data URLs) are included, so a backup is fully self-contained.
- **Restore** replaces the on-device data from such a file (also accepts files
  from the Depot backend). Restore validates the shape before touching the
  database.
- **Reset data** restores the seed catalog and accounts.
- Do an export before updates and store it off-device; it is the only way to
  recover from cleared browser storage.

---

## 6. Verifying offline operation

The project ships a self-contained check that drives a real headless Chromium
(over the DevTools protocol, no extra dependencies) against a production build,
then **stops the web server mid-session** and keeps using the app — the strongest
possible proof of offline operation:

```bash
npm run build
npm run verify:offline      # needs `chromium` on PATH; override with CHROME=/path/to/chrome
```

It exits non-zero if any check fails. The same steps can be done by hand:

1. `npm run build && npm run preview`.
2. Open the app, sign in (`dazumiglobalventuresadmin@gmail.com` / `Admin@001`).
3. Complete a sale → note the invoice number.
4. Open DevTools → Application → confirm **Manifest** is valid, the **Service
   Worker** is *activated and running*, and the app-shell cache is populated.
5. In DevTools → Network, set **Offline** (or stop the web server entirely) and
   **reload** — the app must load and the catalog/sales must still be present.
6. Complete another sale while offline; it must succeed and be numbered
   sequentially (e.g. `INV-000002`) with stock decremented.
7. Confirm there are **no requests to third-party origins** (fonts, APIs).

### Verified scenarios

Checked automatically by `npm run verify:offline` against a production build with
the server shut down mid-session (all passing):

- [x] App shell loads and shows the sign-in screen.
- [x] Login copy states offline operation and lists the seeded accounts.
- [x] No requests to any third-party origin (fonts/icons/API).
- [x] Signs in with the seeded admin account.
- [x] Seeded catalog loads after login.
- [x] Service worker is controlling the page.
- [x] App-shell precache is populated.
- [x] Sale completes and persists with invoice `INV-000001`.
- [x] Stock decremented by 1 and the sale is stored in IndexedDB.
- [x] **App shell reloads with the server stopped** (network navigation fails,
      the service worker responds from cache).
- [x] Session restored from the device while offline.
- [x] Manifest, icons and fonts are served offline.
- [x] **Sale completes while fully offline** (`INV-000002`).
- [x] Offline sale persisted with correct stock and sequential invoices.
- [x] Product photo added offline is downscaled and stored in IndexedDB as a
      local `data:image/…` URL and renders in the catalogue.
- [x] Backup exports offline (products, categories, sales, movements, settings).
- [x] Backup restores offline: an extra product is removed and receipts keep
      their invoice numbers.
- [x] No uncaught console errors during the run.

Manifest check: `Page.getAppManifest` reports **no errors** and
`Page.getInstallabilityErrors` is **empty** (installable).

---

## 7. Regenerating assets

- **Icons** are generated once from `public/favicon.svg`; regenerate with e.g.:

  ```bash
  rsvg-convert -w 512 -h 512 public/favicon.svg -o public/icons/icon-512.png
  ```

  The maskable variant uses a full-bleed teal background with the bottle centred
  inside the safe zone.

- **Service worker** is regenerated on every `npm run build`; its cache name is
  derived from a hash of the build output, so a new build always supersedes the
  old cache. Do not edit `dist/sw.js` by hand.

- **Fonts** are the two `latin` / `latin-ext` `woff2` subsets of Plus Jakarta
  Sans in `public/fonts/`; the `@font-face` rules live at the top of
  `src/index.css`.
