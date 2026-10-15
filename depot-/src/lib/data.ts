/**
 * Data-client facade.
 *
 * The whole app talks to this module instead of importing a concrete client,
 * so the storage backend can be swapped without touching features:
 *
 * - `local`  (default) — IndexedDB, fully offline, no server anywhere.
 * - `remote` — the Express/MongoDB REST client in `src/lib/api.ts`, enabled
 *   only when `VITE_DATA_BACKEND=remote` is set at build time. This mode is
 *   optional and is NOT offline-capable; daily shop operations never need it.
 */
import { api as localApi } from "./local/localApi";
import { api as remoteApi } from "./api";

const DATA_BACKEND = import.meta.env.VITE_DATA_BACKEND ?? "local";

export const api: typeof remoteApi =
  DATA_BACKEND === "remote" ? remoteApi : localApi;

export { ApiError, clearToken, getToken, setToken } from "./api";
export type {
  ApiCategory,
  ApiProduct,
  ApiSale,
  ApiSettings,
  ApiTransaction,
  ApiUser,
} from "./api";
