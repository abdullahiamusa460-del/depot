/**
 * Depot backend REST client.
 *
 * Talks to the Express + MongoDB API documented in `integration.md`. The base
 * URL comes from `VITE_API_URL` (defaults to the local dev server). The JWT is
 * kept in localStorage and attached as `Authorization: Bearer <token>` to every
 * authenticated request.
 */

const BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:4000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "depot.token";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCategory {
  _id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProductCategoryRef {
  _id: string;
  name: string;
}

export interface ApiProduct {
  _id: string;
  name: string;
  brand: string;
  category: ApiProductCategoryRef | string;
  description: string;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  sellingUnit: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  status: "active" | "inactive";
  stockStatus?: "ok" | "low_stock" | "out_of_stock";
  createdAt: string;
  updatedAt: string;
}

export interface ApiSaleItem {
  product: string;
  name: string;
  brand: string;
  sku: string;
  sellingUnit: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discount: number;
  subtotal: number;
}

export interface ApiSaleStaffRef {
  _id: string;
  name: string;
}

export interface ApiSale {
  _id: string;
  invoiceNumber: string;
  items: ApiSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  customer: { name: string; phone: string };
  note: string;
  staff: ApiSaleStaffRef | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTransactionProductRef {
  _id: string;
  name: string;
  brand: string;
  sellingUnit: string;
}

export interface ApiTransaction {
  _id: string;
  product: ApiTransactionProductRef | string;
  type: string;
  previousQuantity: number;
  quantityChange: number;
  newQuantity: number;
  reason: string;
  user?: { _id: string; name: string } | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSettings {
  _id: string;
  key: string;
  shopName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  defaultPaymentMethod: string;
  paymentMethods: string[];
  receiptFooter: string;
  lowStockDefault: number;
  taxPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  setToken(null);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
}

async function requestRaw(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Check that the backend is running.",
      0,
    );
  }

  if (response.status === 401) clearToken();
  return response;
}

async function request<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const response = await requestRaw(path, options);
  const text = await response.text();

  let payload: Envelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || (payload && payload.success === false)) {
    throw new ApiError(
      payload?.message ?? response.statusText ?? "Request failed",
      response.status,
      payload?.details,
    );
  }

  return (payload?.data ?? (payload as unknown)) as T;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface ListParams {
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

/** Page through a paginated endpoint until every item is retrieved. */
export async function fetchAll<T>(
  path: string,
  params: ListParams = {},
  pageSize = 100,
): Promise<T[]> {
  const first = await request<Page<T>>(
    `${path}${buildQuery({ ...params, page: 1, limit: pageSize })}`,
  );
  const items = [...(first.items ?? [])];
  const totalPages = first.pagination?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await request<Page<T>>(
      `${path}${buildQuery({ ...params, page, limit: pageSize })}`,
    );
    items.push(...(next.items ?? []));
  }
  return items;
}

function listQuery(params: ListParams): string {
  return buildQuery(params);
}

export interface LoginResponse {
  user: ApiUser;
  token: string;
}

export const api = {
  health: () =>
    request<{ status: string; time: string }>("/health", { auth: false }),

  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      }),
    me: () => request<ApiUser>("/auth/me"),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message?: string }>("/auth/me/password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      }),
    listUsers: () => request<ApiUser[]>("/auth/users"),
    register: (body: {
      name: string;
      email: string;
      password: string;
      role?: "admin" | "staff";
    }) =>
      request<LoginResponse>("/auth/register", {
        method: "POST",
        auth: false,
        body,
      }),
    updateUser: (
      id: string,
      body: { name?: string; role?: "admin" | "staff"; active?: boolean },
    ) =>
      request<ApiUser>(`/auth/users/${id}`, { method: "PUT", body }),
  },

  categories: {
    list: (params: ListParams = {}) =>
      request<ApiCategory[]>(`/categories${listQuery(params)}`),
    create: (body: { name: string; description?: string; active?: boolean }) =>
      request<ApiCategory>("/categories", { method: "POST", body }),
    update: (
      id: string,
      body: { name?: string; description?: string; active?: boolean },
    ) => request<ApiCategory>(`/categories/${id}`, { method: "PUT", body }),
    remove: (id: string) =>
      request<{ message?: string }>(`/categories/${id}`, { method: "DELETE" }),
  },

  products: {
    list: (params: ListParams = {}) =>
      request<Page<ApiProduct>>(`/products${listQuery(params)}`),
    all: (params: ListParams = {}) => fetchAll<ApiProduct>("/products", params),
    get: (id: string) => request<ApiProduct>(`/products/${id}`),
    create: (body: Record<string, unknown>) =>
      request<ApiProduct>("/products", { method: "POST", body }),
    update: (id: string, body: Record<string, unknown>) =>
      request<ApiProduct>(`/products/${id}`, { method: "PUT", body }),
    remove: (id: string) =>
      request<{ message?: string }>(`/products/${id}`, { method: "DELETE" }),
  },

  inventory: {
    list: (params: ListParams = {}) =>
      request<Page<ApiProduct>>(`/inventory${listQuery(params)}`),
    adjust: (body: {
      product: string;
      type: string;
      quantityChange: number;
      reason?: string;
    }) =>
      request<{ transaction: ApiTransaction; newQuantity: number }>(
        "/inventory/adjust",
        { method: "POST", body },
      ),
    transactions: (params: ListParams = {}) =>
      request<Page<ApiTransaction>>(
        `/inventory/transactions${listQuery(params)}`,
      ),
    allTransactions: (params: ListParams = {}) =>
      fetchAll<ApiTransaction>("/inventory/transactions", params),
  },

  sales: {
    list: (params: ListParams = {}) =>
      request<Page<ApiSale>>(`/sales${listQuery(params)}`),
    all: (params: ListParams = {}) => fetchAll<ApiSale>("/sales", params),
    get: (id: string) => request<ApiSale>(`/sales/${id}`),
    getByInvoice: (invoiceNumber: string) =>
      request<ApiSale>(`/sales/invoice/${encodeURIComponent(invoiceNumber)}`),
    create: (body: {
      items: { product: string; quantity: number; discount?: number }[];
      discount?: number;
      amountPaid: number;
      paymentMethod?: string;
      customer?: { name: string; phone: string };
      note?: string;
    }) => request<ApiSale>("/sales", { method: "POST", body }),
  },

  dashboard: {
    get: () => request<unknown>("/dashboard"),
  },

  settings: {
    get: () => request<ApiSettings>("/settings"),
    update: (body: Record<string, unknown>) =>
      request<ApiSettings>("/settings", { method: "PUT", body }),
  },

  backup: {
    export: async (): Promise<string> => {
      const response = await requestRaw("/backup/export");
      const text = await response.text();
      if (!response.ok) {
        let message = response.statusText;
        try {
          message = (JSON.parse(text) as { message?: string }).message ?? message;
        } catch {
          /* keep status text */
        }
        throw new ApiError(message, response.status);
      }
      return text;
    },
    restore: (data: unknown) =>
      request<{
        categories: number;
        products: number;
        sales: number;
        inventoryTransactions: number;
      }>("/backup/restore", { method: "POST", body: { data } }),
  },
};

export { BASE_URL };
