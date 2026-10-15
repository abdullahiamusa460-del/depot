/**
 * IndexedDB plumbing for the offline data layer.
 *
 * The app stores every business record (users, categories, products, sales,
 * stock movements, settings, sessions) in a single IndexedDB database so data
 * survives refreshes, closed tabs and browser restarts without any server.
 * Nothing here touches the network.
 */

const DB_NAME = "beverage-shop-pos";
const DB_VERSION = 1;

export const STORE_KEY_PATHS = {
  users: "_id",
  categories: "_id",
  products: "_id",
  sales: "_id",
  transactions: "_id",
  settings: "key",
  sessions: "token",
  meta: "key",
} as const;

export type StoreName = keyof typeof STORE_KEY_PATHS;

const ALL_STORES = Object.keys(STORE_KEY_PATHS) as StoreName[];

let dbPromise: Promise<IDBDatabase> | null = null;

function assertIndexedDbAvailable(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "This browser does not allow local databases. Private/incognito modes can disable them.",
    );
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    try {
      assertIndexedDbAvailable();
    } catch (error) {
      return Promise.reject(error);
    }
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ALL_STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: STORE_KEY_PATHS[name] });
          }
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("Could not open the local database."));
      };
      request.onblocked = () => {
        dbPromise = null;
        reject(
          new Error("The local database is blocked by another app tab. Close it and retry."),
        );
      };
    });
  }
  return dbPromise;
}

export function reqAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local database request failed."));
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Local database transaction failed."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Local database transaction aborted."));
  });
}

export async function getAll<T>(name: StoreName): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(name, "readonly");
  return (await reqAsPromise(tx.objectStore(name).getAll())) as T[];
}

export async function getItem<T>(
  name: StoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(name, "readonly");
  return (await reqAsPromise(tx.objectStore(name).get(key))) as T | undefined;
}

export async function putItem(name: StoreName, value: unknown): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(name, "readwrite");
  tx.objectStore(name).put(value);
  await txDone(tx);
}

export async function putItems(
  name: StoreName,
  values: unknown[],
): Promise<void> {
  if (values.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(name, "readwrite");
  const store = tx.objectStore(name);
  for (const value of values) store.put(value);
  await txDone(tx);
}

export async function deleteItem(
  name: StoreName,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(name, "readwrite");
  tx.objectStore(name).delete(key);
  await txDone(tx);
}

export async function clearStores(...names: StoreName[]): Promise<void> {
  if (names.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(names, "readwrite");
  for (const name of names) tx.objectStore(name).clear();
  await txDone(tx);
}

/**
 * Run several reads and writes across stores inside one transaction so a
 * multi-step operation (a sale decrements stock and writes a receipt) either
 * fully commits or fully rolls back.
 *
 * The callback must only use request promises (microtasks) — never timers —
 * so the transaction stays alive until it finishes.
 */
export async function runTransaction<T>(
  names: StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(names, mode);
  let result: T;
  try {
    result = await work(tx);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction already finished; nothing to roll back.
    }
    throw error;
  }
  await txDone(tx);
  return result;
}

/** A 24-hex-character id shaped like the ids used across the app. */
export function newObjectId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function digestFallback(input: string): string {
  // Only used when WebCrypto's subtle API is unavailable (insecure origins).
  let hashA = 0x811c9dc5;
  let hashB = 0x1000193;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0;
    hashB = Math.imul(hashB + code + i, 0x85ebca6b) >>> 0;
  }
  return `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`;
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const input = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input),
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `sha256:${hex}`;
  }
  return `fallback:${digestFallback(input)}`;
}

export function newSalt(): string {
  return randomToken();
}
