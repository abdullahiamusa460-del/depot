export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return;
  }

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {
      /* Best effort: without it the browser may evict the local database
         under storage pressure. */
    });
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline shell is unavailable (e.g. insecure origin). The app still
         works because all business data lives in IndexedDB. */
    });
  });
}
