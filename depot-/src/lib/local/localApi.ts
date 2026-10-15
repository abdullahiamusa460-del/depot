/**
 * Offline API implementation.
 *
 * Mirrors the REST client in `src/lib/api.ts` one-to-one (same methods, same
 * DTO shapes, same error codes) but reads and writes the local IndexedDB
 * database instead of calling a server, so every feature — login, POS sales,
 * inventory, receipts, reports, backups — works with no network at all.
 *
 * The facade in `src/lib/data.ts` picks this module unless the remote backend
 * is explicitly enabled with `VITE_DATA_BACKEND=remote`.
 */

import {
  ApiError,
  getToken,
  type ListParams,
  type LoginResponse,
  type Page,
  type ApiCategory,
  type ApiProduct,
  type ApiSale,
  type ApiSettings,
  type ApiTransaction,
  type ApiUser,
} from "../api";
import { nextInvoiceNumber } from "../id";
import { isAcceptableImageUrl } from "../image";
import { normalizeBackupPayload } from "../backup";
import {
  deleteItem,
  getAll,
  getItem,
  hashPassword,
  newObjectId,
  newSalt,
  nowIso,
  putItem,
  randomToken,
  reqAsPromise,
  round2,
  runTransaction,
} from "./db";
import {
  DEFAULT_SETTINGS,
  ensureSeeded,
  type StoredUser,
} from "./seed";

const SIGN_RULES: Record<string, "positive" | "negative" | "either"> = {
  received: "positive",
  return: "positive",
  damaged: "negative",
  expired: "negative",
  adjustment: "either",
  correction: "either",
  sale: "negative",
};

function validationFailure(field: string, message: string): never {
  throw new ApiError("Validation failed", 400, [{ field, message }]);
}

/**
 * Validates a product image before it reaches IndexedDB: an uploaded photo
 * (`data:image/…`, size-capped), an absolute link or a self-hosted path.
 * An empty value clears the image.
 */
function readImageUrl(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!isAcceptableImageUrl(value)) {
    validationFailure(
      "imageUrl",
      "Image must be a photo stored on this device or a valid image link",
    );
  }
  return value;
}

function notFound(message: string): never {
  throw new ApiError(message, 404);
}

function badRequest(message: string, details?: unknown): never {
  throw new ApiError(message, 400, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Accepts a category id whether it is stored as a string or a populated ref. */
function recordRefId(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (isRecord(value) && typeof value._id === "string") return value._id || null;
  return null;
}

function invalidBackup(entity: string, index: number): never {
  badRequest(
    `The backup contains an invalid ${entity} record (item ${index + 1})`,
  );
}

/**
 * Validate the shape of every record in a backup before it replaces the local
 * database, so a corrupt or foreign file fails cleanly instead of silently
 * writing records the rest of the app cannot read.
 */
function assertValidBackupRecords(records: {
  categories: unknown[];
  products: unknown[];
  sales: unknown[];
  transactions: unknown[];
}): void {
  records.categories.forEach((category, index) => {
    if (
      !isRecord(category) ||
      typeof category._id !== "string" ||
      !category._id ||
      typeof category.name !== "string" ||
      !category.name.trim()
    ) {
      invalidBackup("category", index);
    }
  });

  records.products.forEach((product, index) => {
    if (
      !isRecord(product) ||
      typeof product._id !== "string" ||
      !product._id ||
      typeof product.name !== "string" ||
      !product.name.trim() ||
      !recordRefId(product.category) ||
      !isFiniteNumber(product.price) ||
      product.price < 0 ||
      !isFiniteNumber(product.stock) ||
      product.stock < 0 ||
      (product.imageUrl !== undefined &&
        product.imageUrl !== null &&
        (typeof product.imageUrl !== "string" ||
          !isAcceptableImageUrl(product.imageUrl)))
    ) {
      invalidBackup("product", index);
    }
  });

  records.sales.forEach((sale, index) => {
    if (
      !isRecord(sale) ||
      typeof sale._id !== "string" ||
      !sale._id ||
      typeof sale.invoiceNumber !== "string" ||
      !sale.invoiceNumber.trim() ||
      !Array.isArray(sale.items) ||
      !isFiniteNumber(sale.total)
    ) {
      invalidBackup("sale", index);
    }
  });

  records.transactions.forEach((movement, index) => {
    if (
      !isRecord(movement) ||
      typeof movement._id !== "string" ||
      !movement._id ||
      !recordRefId(movement.product) ||
      !isFiniteNumber(movement.quantityChange) ||
      !isFiniteNumber(movement.newQuantity)
    ) {
      invalidBackup("inventory movement", index);
    }
  });
}

function toApiUser(user: StoredUser): ApiUser {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sortNewestFirst<T extends { createdAt: string; _id: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b._id.localeCompare(a._id),
  );
}

function paginate<T>(items: T[], params: ListParams): Page<T> {
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: {
      total: items.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    },
  };
}

function matchesSearch(
  search: unknown,
  fields: Array<string | null | undefined>,
): boolean {
  const term = String(search ?? "")
    .trim()
    .toLowerCase();
  if (!term) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(term));
}

async function readSettings(): Promise<ApiSettings> {
  await ensureSeeded();
  const stored = await getItem<ApiSettings>("settings", "global");
  if (stored) return stored;
  return { ...DEFAULT_SETTINGS, _id: newObjectId(), createdAt: nowIso(), updatedAt: nowIso() };
}

async function currentStoredUser(): Promise<StoredUser | null> {
  const token = getToken();
  if (!token) return null;
  const session = await getItem<{ token: string; userId: string }>(
    "sessions",
    token,
  );
  if (!session) return null;
  const user = await getItem<StoredUser>("users", session.userId);
  if (!user || !user.active) return null;
  return user;
}

async function requireUser(): Promise<StoredUser> {
  const user = await currentStoredUser();
  if (!user) throw new ApiError("Your session has expired. Sign in again.", 401);
  return user;
}

function staffRef(user: StoredUser | null): { _id: string; name: string } | null {
  return user ? { _id: user._id, name: user.name } : null;
}

function populatedProductRef(
  ref: ApiTransaction["product"],
  byId: Map<string, ApiProduct>,
): ApiTransaction["product"] {
  const id = ref && typeof ref === "object" ? ref._id : ref;
  const product = typeof id === "string" ? byId.get(id) : undefined;
  if (!product) return typeof ref === "object" && ref !== null ? ref : (ref ?? "");
  return {
    _id: product._id,
    name: product.name,
    brand: product.brand,
    sellingUnit: product.sellingUnit,
  };
}

async function mapTransactions(
  transactions: ApiTransaction[],
): Promise<ApiTransaction[]> {
  const products = await getAll<ApiProduct>("products");
  const byId = new Map(products.map((product) => [product._id, product]));
  return transactions.map((entry) => ({
    ...entry,
    product: populatedProductRef(entry.product, byId),
  }));
}

interface SaleBody {
  items: Array<{ product: string; quantity: number; discount?: number }>;
  discount?: number;
  amountPaid: number;
  paymentMethod?: string;
  customer?: { name: string; phone: string };
  note?: string;
  applyTax?: boolean;
}

export const api = {
  health: async (): Promise<{ status: string; time: string }> => ({
    status: "local",
    time: nowIso(),
  }),

  auth: {
    async login(email: string, password: string): Promise<LoginResponse> {
      await ensureSeeded();
      const key = email.trim().toLowerCase();
      const users = await getAll<StoredUser>("users");
      const user = users.find(
        (entry) =>
          entry.email.trim().toLowerCase() === key ||
          entry.name.trim().toLowerCase() === key,
      );
      if (!user) throw new ApiError("Invalid email or password.", 401);
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        throw new ApiError("Invalid email or password.", 401);
      }
      if (!user.active) {
        throw new ApiError(
          "This account is deactivated. Ask the administrator to re-enable it.",
          403,
        );
      }
      const token = randomToken();
      await putItem("sessions", {
        token,
        userId: user._id,
        createdAt: nowIso(),
      });
      return { user: toApiUser(user), token };
    },

    async me(): Promise<ApiUser> {
      await ensureSeeded();
      const user = await currentStoredUser();
      if (!user) throw new ApiError("Not authenticated.", 401);
      return toApiUser(user);
    },

    async changePassword(
      currentPassword: string,
      newPassword: string,
    ): Promise<{ message?: string }> {
      const user = await requireUser();
      const hash = await hashPassword(currentPassword, user.salt);
      if (hash !== user.passwordHash) {
        throw new ApiError("Your current password is incorrect.", 400);
      }
      if (!newPassword) {
        validationFailure("newPassword", "Choose a new password");
      }
      const salt = newSalt();
      const updated: StoredUser = {
        ...user,
        salt,
        passwordHash: await hashPassword(newPassword, salt),
        updatedAt: nowIso(),
      };
      await putItem("users", updated);
      return { message: "Password updated" };
    },

    async listUsers(): Promise<ApiUser[]> {
      await ensureSeeded();
      const users = await getAll<StoredUser>("users");
      return [...users]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(toApiUser);
    },

    async register(body: {
      name: string;
      email: string;
      password: string;
      role?: "admin" | "staff";
    }): Promise<LoginResponse> {
      await ensureSeeded();
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!name) validationFailure("name", "Name is required");
      if (!email) validationFailure("email", "Email is required");
      if (!body.password) validationFailure("password", "Password is required");
      const existing = await getAll<StoredUser>("users");
      if (existing.some((user) => user.email.toLowerCase() === email)) {
        throw new ApiError("An account with this email already exists.", 409);
      }
      const salt = newSalt();
      const userCount = existing.length;
      const stored: StoredUser = {
        _id: newObjectId(),
        name,
        email,
        role: userCount === 0 ? "admin" : (body.role ?? "staff"),
        active: true,
        salt,
        passwordHash: await hashPassword(body.password, salt),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await putItem("users", stored);
      const token = randomToken();
      await putItem("sessions", {
        token,
        userId: stored._id,
        createdAt: nowIso(),
      });
      return { user: toApiUser(stored), token };
    },

    async updateUser(
      id: string,
      body: { name?: string; role?: "admin" | "staff"; active?: boolean },
    ): Promise<ApiUser> {
      await ensureSeeded();
      const stored = await getItem<StoredUser>("users", id);
      if (!stored) notFound("Account not found");
      const updated: StoredUser = {
        ...stored,
        name:
          body.name !== undefined ? String(body.name).trim() || stored.name : stored.name,
        role: body.role ?? stored.role,
        active: body.active ?? stored.active,
        updatedAt: nowIso(),
      };
      await putItem("users", updated);
      return toApiUser(updated);
    },
  },

  categories: {
    async list(params: ListParams = {}): Promise<ApiCategory[]> {
      await ensureSeeded();
      const categories = await getAll<ApiCategory>("categories");
      const filtered = categories.filter(
        (category) =>
          matchesSearch(params.search, [category.name, category.description]) &&
          (params.active === undefined ||
            params.active === "" ||
            (params.active === true || params.active === "true"
              ? category.active
              : !category.active)),
      );
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    },

    async create(body: {
      name: string;
      description?: string;
      active?: boolean;
    }): Promise<ApiCategory> {
      await ensureSeeded();
      const name = String(body.name ?? "").trim();
      if (!name) validationFailure("name", "Category name is required");
      if (name.length > 80) validationFailure("name", "Maximum 80 characters");
      const existing = await getAll<ApiCategory>("categories");
      if (
        existing.some(
          (category) => category.name.trim().toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new ApiError("A category with this name already exists.", 409);
      }
      const category: ApiCategory = {
        _id: newObjectId(),
        name,
        description: String(body.description ?? ""),
        active: body.active ?? true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await putCategory(category);
      return category;
    },

    async update(
      id: string,
      body: { name?: string; description?: string; active?: boolean },
    ): Promise<ApiCategory> {
      await ensureSeeded();
      const stored = await getItem<ApiCategory>("categories", id);
      if (!stored) notFound("Category not found");
      const name =
        body.name !== undefined
          ? String(body.name).trim() || stored.name
          : stored.name;
      if (name.length > 80) validationFailure("name", "Maximum 80 characters");
      const others = await getAll<ApiCategory>("categories");
      if (
        others.some(
          (category) =>
            category._id !== id &&
            category.name.trim().toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new ApiError("A category with this name already exists.", 409);
      }
      const updated: ApiCategory = {
        ...stored,
        name,
        description:
          body.description !== undefined
            ? String(body.description)
            : stored.description,
        active: body.active ?? stored.active,
        updatedAt: nowIso(),
      };
      await putCategory(updated);
      return updated;
    },

    async remove(id: string): Promise<{ message?: string }> {
      await ensureSeeded();
      const stored = await getItem<ApiCategory>("categories", id);
      if (!stored) notFound("Category not found");
      const products = await getAll<ApiProduct>("products");
      const inUse = products.filter(
        (product) =>
          (product.category && typeof product.category === "string"
            ? product.category
            : (product.category as { _id: string })._id) === id,
      ).length;
      if (inUse > 0) {
        throw new ApiError(
          `Cannot delete: ${inUse} product(s) still use this category`,
          409,
          { productCount: inUse },
        );
      }
      await deleteItem("categories", id);
      return { message: "Category deleted" };
    },
  },

  products: {
    async list(params: ListParams = {}): Promise<Page<ApiProduct>> {
      await ensureSeeded();
      return paginate(await filterProducts(params), params);
    },

    async all(params: ListParams = {}): Promise<ApiProduct[]> {
      await ensureSeeded();
      return filterProducts(params);
    },

    async get(id: string): Promise<ApiProduct> {
      await ensureSeeded();
      const product = await getItem<ApiProduct>("products", id);
      if (!product) notFound("Product not found");
      return product;
    },

    async create(body: Record<string, unknown>): Promise<ApiProduct> {
      await ensureSeeded();
      const settings = await readSettings();
      const name = String(body.name ?? "").trim();
      if (!name) validationFailure("name", "Product name is required");
      const categoryId = String(body.category ?? "").trim();
      if (!categoryId) validationFailure("category", "Category is required");
      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) {
        validationFailure("price", "Selling price must be greater than zero");
      }
      const costPrice = body.costPrice === undefined ? 0 : Number(body.costPrice);
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        validationFailure("costPrice", "Cost price cannot be negative");
      }
      const minStockRaw =
        body.minStock === undefined
          ? settings.lowStockDefault
          : Number(body.minStock);
      if (!Number.isFinite(minStockRaw) || minStockRaw < 0) {
        validationFailure("minStock", "Minimum stock cannot be negative");
      }
      const stockRaw = body.stock === undefined ? 0 : Number(body.stock);
      if (!Number.isFinite(stockRaw) || stockRaw < 0) {
        validationFailure("stock", "Stock cannot be negative");
      }

      const sku = String(body.sku ?? "").trim() || null;
      const barcode = String(body.barcode ?? "").trim() || null;
      const categories = await getAll<ApiCategory>("categories");
      if (!categories.some((category) => category._id === categoryId)) {
        validationFailure("category", "Choose an existing category");
      }
      await assertNoDuplicateCatalogValue(null, sku, barcode);

      const timestamp = nowIso();
      const product: ApiProduct = {
        _id: newObjectId(),
        name,
        brand: String(body.brand ?? "").trim(),
        category: categoryId,
        description: String(body.description ?? ""),
        sku,
        barcode,
        imageUrl: readImageUrl(body.imageUrl),
        sellingUnit: String(body.sellingUnit ?? "other"),
        price,
        costPrice,
        stock: Math.floor(stockRaw),
        minStock: Math.floor(minStockRaw),
        status: body.status === "inactive" ? "inactive" : "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await runTransaction(
        ["products", "transactions"],
        "readwrite",
        async (tx) => {
          tx.objectStore("products").put(product);
          if (product.stock > 0) {
            tx.objectStore("transactions").put({
              _id: newObjectId(),
              product: product._id,
              type: "received",
              previousQuantity: 0,
              quantityChange: product.stock,
              newQuantity: product.stock,
              reason: "Initial stock",
              user: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        },
      );
      return product;
    },

    async update(
      id: string,
      body: Record<string, unknown>,
    ): Promise<ApiProduct> {
      await ensureSeeded();
      await readSettings();
      const stored = await getItem<ApiProduct>("products", id);
      if (!stored) notFound("Product not found");

      const name =
        body.name !== undefined
          ? String(body.name).trim() || stored.name
          : stored.name;
      if (!name) validationFailure("name", "Product name is required");

      let categoryId = stored.category;
      if (body.category !== undefined) {
        const next = String(body.category ?? "").trim();
        if (!next) validationFailure("category", "Category is required");
        const categories = await getAll<ApiCategory>("categories");
        if (!categories.some((category) => category._id === next)) {
          validationFailure("category", "Choose an existing category");
        }
        categoryId = next;
      }

      let price = stored.price;
      if (body.price !== undefined) {
        price = Number(body.price);
        if (!Number.isFinite(price) || price <= 0) {
          validationFailure("price", "Selling price must be greater than zero");
        }
      }
      let costPrice = stored.costPrice;
      if (body.costPrice !== undefined) {
        costPrice = Number(body.costPrice);
        if (!Number.isFinite(costPrice) || costPrice < 0) {
          validationFailure("costPrice", "Cost price cannot be negative");
        }
      }
      let minStock = stored.minStock;
      if (body.minStock !== undefined) {
        minStock = Number(body.minStock);
        if (!Number.isFinite(minStock) || minStock < 0) {
          validationFailure("minStock", "Minimum stock cannot be negative");
        }
      }
      let stock = stored.stock;
      if (body.stock !== undefined) {
        stock = Number(body.stock);
        if (!Number.isFinite(stock) || stock < 0) {
          validationFailure("stock", "Stock cannot be negative");
        }
        stock = Math.floor(stock);
      }
      const sku =
        body.sku !== undefined
          ? String(body.sku).trim() || null
          : stored.sku;
      const barcode =
        body.barcode !== undefined
          ? String(body.barcode).trim() || null
          : stored.barcode;
      await assertNoDuplicateCatalogValue(id, sku, barcode);

      const timestamp = nowIso();
      const stockChanged = stock !== stored.stock;
      const updated: ApiProduct = {
        ...stored,
        name,
        category: categoryId,
        description:
          body.description !== undefined
            ? String(body.description)
            : stored.description,
        brand:
          body.brand !== undefined ? String(body.brand).trim() : stored.brand,
        sku,
        barcode,
        imageUrl:
          body.imageUrl !== undefined
            ? readImageUrl(body.imageUrl)
            : stored.imageUrl,
        sellingUnit:
          body.sellingUnit !== undefined
            ? String(body.sellingUnit)
            : stored.sellingUnit,
        price,
        costPrice,
        stock,
        minStock,
        status:
          body.status !== undefined
            ? body.status === "inactive"
              ? "inactive"
              : "active"
            : stored.status,
        updatedAt: timestamp,
      };

      await runTransaction(
        ["products", "transactions"],
        "readwrite",
        async (tx) => {
          tx.objectStore("products").put(updated);
          if (stockChanged) {
            const change = stock - stored.stock;
            tx.objectStore("transactions").put({
              _id: newObjectId(),
              product: id,
              type: "adjustment",
              previousQuantity: stored.stock,
              quantityChange: change,
              newQuantity: stock,
              reason: "Product updated",
              user: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        },
      );
      return updated;
    },

    async remove(id: string): Promise<{ message?: string }> {
      await ensureSeeded();
      const stored = await getItem<ApiProduct>("products", id);
      if (!stored) notFound("Product not found");
      await deleteItem("products", id);
      return { message: "Product deleted" };
    },
  },

  inventory: {
    async list(params: ListParams = {}): Promise<Page<ApiProduct>> {
      await ensureSeeded();
      let products = await filterProducts(params);
      const status = String(params.stockStatus ?? "");
      if (status === "out_of_stock") {
        products = products.filter((product) => product.stock === 0);
      } else if (status === "low_stock") {
        products = products.filter(
          (product) => product.stock > 0 && product.stock <= product.minStock,
        );
      } else if (status === "ok") {
        products = products.filter((product) => product.stock > product.minStock);
      }
      products.sort(
        (a, b) => a.stock - b.stock || a.name.localeCompare(b.name),
      );
      return paginate(products, params);
    },

    async adjust(body: {
      product: string;
      type: string;
      quantityChange: number;
      reason?: string;
    }): Promise<{ transaction: ApiTransaction; newQuantity: number }> {
      await ensureSeeded();
      const user = await currentStoredUser();
      const type = String(body.type ?? "");
      const rule = SIGN_RULES[type];
      if (!rule) {
        badRequest(`Type "${type}" is not a valid stock movement`);
      }
      const quantityChange = Number(body.quantityChange);
      if (!Number.isInteger(quantityChange) || quantityChange === 0) {
        validationFailure(
          "quantityChange",
          "Enter a non-zero whole number",
        );
      }
      if (rule === "positive" && quantityChange < 0) {
        badRequest(`Type "${type}" requires a positive quantityChange`);
      }
      if (rule === "negative" && quantityChange > 0) {
        badRequest(`Type "${type}" requires a negative quantityChange`);
      }

      const result = await runTransaction(
        ["products", "transactions"],
        "readwrite",
        async (tx) => {
          const product = (await reqAsPromise(
            tx.objectStore("products").get(String(body.product)),
          )) as ApiProduct | undefined;
          if (!product) notFound("Product not found");
          const newQuantity = product.stock + quantityChange;
          if (newQuantity < 0) {
            badRequest(
              `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${Math.abs(quantityChange)}`,
            );
          }
          const timestamp = nowIso();
          const movement: ApiTransaction = {
            _id: newObjectId(),
            product: product._id,
            type,
            previousQuantity: product.stock,
            quantityChange,
            newQuantity,
            reason: String(body.reason ?? "").trim() || type,
            user: staffRef(user),
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          tx.objectStore("products").put({
            ...product,
            stock: newQuantity,
            updatedAt: timestamp,
          });
          tx.objectStore("transactions").put(movement);
          return { transaction: movement, newQuantity };
        },
      );
      return result;
    },

    async transactions(
      params: ListParams = {},
    ): Promise<Page<ApiTransaction>> {
      await ensureSeeded();
      return paginate(await filterTransactions(params), params);
    },

    async allTransactions(
      params: ListParams = {},
    ): Promise<ApiTransaction[]> {
      await ensureSeeded();
      return filterTransactions(params);
    },
  },

  sales: {
    async list(params: ListParams = {}): Promise<Page<ApiSale>> {
      await ensureSeeded();
      return paginate(await filterSales(params), params);
    },

    async all(params: ListParams = {}): Promise<ApiSale[]> {
      await ensureSeeded();
      return filterSales(params);
    },

    async get(id: string): Promise<ApiSale> {
      await ensureSeeded();
      const sale = await getItem<ApiSale>("sales", id);
      if (!sale) notFound("Sale not found");
      return sale;
    },

    async getByInvoice(invoiceNumber: string): Promise<ApiSale> {
      await ensureSeeded();
      const key = String(invoiceNumber ?? "").trim().toUpperCase();
      const sales = await getAll<ApiSale>("sales");
      const sale = sales.find(
        (entry) => entry.invoiceNumber.toUpperCase() === key,
      );
      if (!sale) notFound("Sale not found");
      return sale;
    },

    async create(body: SaleBody): Promise<ApiSale> {
      await ensureSeeded();
      const settings = await readSettings();
      const user = await requireUser();

      const lines = Array.isArray(body.items) ? body.items : [];
      if (lines.length === 0) {
        badRequest("Add at least one product to the sale");
      }
      if (lines.length > 200) {
        badRequest("A sale can contain at most 200 lines");
      }

      const paymentMethod =
        String(body.paymentMethod ?? "").trim() || settings.defaultPaymentMethod;
      if (!settings.paymentMethods.includes(paymentMethod as never)) {
        badRequest(
          `Payment method "${paymentMethod}" is not enabled. Enabled: ${settings.paymentMethods.join(", ")}`,
        );
      }
      const amountPaid = Number(body.amountPaid);
      if (!Number.isFinite(amountPaid) || amountPaid < 0) {
        validationFailure("amountPaid", "Amount paid cannot be negative");
      }

      const sale = await runTransaction(
        ["products", "sales", "transactions"],
        "readwrite",
        async (tx) => {
          const productStore = tx.objectStore("products");
          const saleStore = tx.objectStore("sales");
          const movementStore = tx.objectStore("transactions");

          const productIds = [...new Set(lines.map((line) => String(line.product)))];
          const products = new Map<string, ApiProduct>();
          for (const productId of productIds) {
            const product = (await reqAsPromise(
              productStore.get(productId),
            )) as ApiProduct | undefined;
            products.set(productId, product as ApiProduct);
          }

          const missing = productIds.filter((id) => !products.get(id));
          if (missing.length > 0) {
            badRequest("Some products no longer exist", { missing });
          }

          const inactive = [...products.values()].filter(
            (product) => product.status === "inactive",
          );
          if (inactive.length > 0) {
            badRequest(
              `Inactive product(s) cannot be sold: ${inactive
                .map((product) => product.name)
                .join(", ")}`,
            );
          }

          interface SaleLine {
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
          const snapshot: SaleLine[] = [];
          let subtotal = 0;
          for (const line of lines) {
            const quantity = Number(line.quantity);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
              validationFailure("items", "Quantity must be a whole number of at least 1");
            }
            const discount = Number(line.discount ?? 0);
            if (!Number.isFinite(discount) || discount < 0) {
              validationFailure("items", "Discount cannot be negative");
            }
            const product = products.get(String(line.product)) as ApiProduct;
            const lineTotalValue = round2(
              product.price * quantity - discount,
            );
            if (discount > product.price * quantity) {
              badRequest(
                `Discount for "${product.name}" exceeds line total`,
              );
            }
            if (quantity > product.stock) {
              badRequest(
                `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}`,
              );
            }
            subtotal = round2(subtotal + Math.max(0, lineTotalValue));
            snapshot.push({
              product: product._id,
              name: product.name,
              brand: product.brand,
              sku: product.sku ?? "",
              sellingUnit: product.sellingUnit,
              unitPrice: product.price,
              costPrice: product.costPrice,
              quantity,
              discount,
              subtotal: Math.max(0, lineTotalValue),
            });
          }

          const saleDiscount = Math.min(
            Math.max(0, Number(body.discount ?? 0) || 0),
            subtotal,
          );
          const taxable = round2(subtotal - saleDiscount);
          const rate = settings.taxPercent ?? 0;
          // Matches `computeSaleTotals` in src/lib/checkout.ts exactly so the
          // receipt always shows the same figure as the payment preview.
          const tax =
            body.applyTax && rate > 0
              ? Math.round(taxable * (rate / 100))
              : 0;
          const total = taxable + tax;
          if (amountPaid < total) {
            badRequest(
              `Amount paid (${settings.currencySymbol}${amountPaid}) is less than the total (${settings.currencySymbol}${total})`,
            );
          }

          const existingSales = (await reqAsPromise(
            saleStore.getAll(),
          )) as ApiSale[];
          const invoiceNumber = nextInvoiceNumber(
            settings.invoicePrefix || "INV",
            existingSales.map((entry) => entry.invoiceNumber),
          );
          const timestamp = nowIso();
          const record: ApiSale & { tax?: number } = {
            _id: newObjectId(),
            invoiceNumber,
            items: snapshot,
            subtotal,
            discount: saleDiscount,
            total,
            amountPaid,
            change: round2(amountPaid - total),
            paymentMethod,
            customer: {
              name: String(body.customer?.name ?? ""),
              phone: String(body.customer?.phone ?? ""),
            },
            note: String(body.note ?? ""),
            staff: staffRef(user),
            tax,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          // Stock is decremented in the same transaction as the receipt, so a
          // failed sale never leaves quantities inconsistent.
          for (const line of snapshot) {
            const product = products.get(line.product) as ApiProduct;
            productStore.put({
              ...product,
              stock: product.stock - line.quantity,
              updatedAt: timestamp,
            });
            movementStore.put({
              _id: newObjectId(),
              product: product._id,
              type: "sale",
              previousQuantity: product.stock,
              quantityChange: -line.quantity,
              newQuantity: product.stock - line.quantity,
              reason: `Sale ${invoiceNumber}`,
              user: staffRef(user),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
          saleStore.put(record);
          return record as ApiSale;
        },
      );
      return sale;
    },
  },

  dashboard: {
    async get(): Promise<unknown> {
      await ensureSeeded();
      const [products, sales] = await Promise.all([
        getAll<ApiProduct>("products"),
        getAll<ApiSale>("sales"),
      ]);
      const now = new Date();
      const dayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
      const todaySales = sales.filter((sale) => sale.createdAt >= dayStart);
      const profitOf = (sale: ApiSale) =>
        sale.items.reduce(
          (sum, item) =>
            sum + (item.unitPrice - item.costPrice) * item.quantity,
          0,
        );
      return {
        today: {
          sales: todaySales.reduce((sum, sale) => sum + sale.total, 0),
          transactions: todaySales.length,
          estimatedProfit:
            todaySales.length > 0
              ? todaySales.reduce((sum, sale) => sum + profitOf(sale), 0)
              : null,
        },
        products: {
          total: products.length,
          lowStock: products.filter(
            (product) => product.stock > 0 && product.stock <= product.minStock,
          ).length,
          outOfStock: products.filter((product) => product.stock === 0).length,
        },
        inventoryValue: products.reduce(
          (sum, product) => sum + product.stock * product.costPrice,
          0,
        ),
        recentSales: sortNewestFirst(sales).slice(0, 8),
      };
    },
  },

  settings: {
    async get(): Promise<ApiSettings> {
      return readSettings();
    },

    async update(body: Record<string, unknown>): Promise<ApiSettings> {
      const stored = await readSettings();
      const next: ApiSettings = { ...stored, updatedAt: nowIso() };

      if (body.shopName !== undefined) next.shopName = String(body.shopName);
      if (body.logoUrl !== undefined) next.logoUrl = String(body.logoUrl);
      if (body.address !== undefined) next.address = String(body.address);
      if (body.phone !== undefined) next.phone = String(body.phone);
      if (body.email !== undefined) next.email = String(body.email);
      if (body.currency !== undefined) next.currency = String(body.currency);
      if (body.currencySymbol !== undefined)
        next.currencySymbol = String(body.currencySymbol);
      if (body.receiptFooter !== undefined)
        next.receiptFooter = String(body.receiptFooter);
      if (body.invoicePrefix !== undefined) {
        const prefix = String(body.invoicePrefix).trim();
        if (!/^[A-Za-z0-9_-]{1,12}$/.test(prefix)) {
          validationFailure(
            "invoicePrefix",
            "Use 1–12 letters, numbers, - or _",
          );
        }
        next.invoicePrefix = prefix;
      }
      if (body.taxPercent !== undefined) {
        const taxPercent = Number(body.taxPercent);
        if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
          validationFailure("taxPercent", "Enter a percentage between 0 and 100");
        }
        next.taxPercent = taxPercent;
      }
      if (body.lowStockDefault !== undefined) {
        const lowStockDefault = Number(body.lowStockDefault);
        if (!Number.isFinite(lowStockDefault) || lowStockDefault < 0) {
          validationFailure("lowStockDefault", "Cannot be negative");
        }
        next.lowStockDefault = Math.floor(lowStockDefault);
      }
      if (body.defaultPaymentMethod !== undefined) {
        next.defaultPaymentMethod = String(body.defaultPaymentMethod) as never;
      }
      if (body.paymentMethods !== undefined) {
        const methods = Array.isArray(body.paymentMethods)
          ? body.paymentMethods.map((method) => String(method))
          : [];
        if (methods.length === 0) {
          validationFailure(
            "paymentMethods",
            "Keep at least one payment method",
          );
        }
        next.paymentMethods = methods as never;
      }

      await putSettings(next);
      return next;
    },
  },

  backup: {
    async export(): Promise<string> {
      await ensureSeeded();
      const [categories, products, sales, transactions, settings] =
        await Promise.all([
          getAll<ApiCategory>("categories"),
          getAll<ApiProduct>("products"),
          getAll<ApiSale>("sales"),
          getAll<ApiTransaction>("transactions"),
          readSettings(),
        ]);
      return JSON.stringify(
        {
          app: "beverage-shop-pos",
          version: 1,
          exportedAt: nowIso(),
          data: {
            categories,
            products,
            sales,
            inventoryTransactions: transactions,
            settings,
          },
        },
        null,
        2,
      );
    },

    async restore(
      payload: unknown,
    ): Promise<{
      categories: number;
      products: number;
      sales: number;
      inventoryTransactions: number;
    }> {
      await ensureSeeded();
      const normalized = normalizeBackupPayload(payload);
      if (!normalized || normalized.version !== 1) {
        badRequest("Unrecognized or unsupported backup file");
      }
      const data = normalized.data;

      const categories = data.categories as ApiCategory[];
      const products = data.products as ApiProduct[];
      const sales = data.sales as ApiSale[];
      const transactions = data.inventoryTransactions as ApiTransaction[];
      const settings =
        data.settings && typeof data.settings === "object"
          ? ({ ...(data.settings as ApiSettings), key: "global" } as ApiSettings)
          : null;

      assertValidBackupRecords({
        categories,
        products,
        sales,
        transactions,
      });

      const stores: Array<
        "categories" | "products" | "sales" | "transactions" | "settings"
      > = ["categories", "products", "sales", "transactions"];
      if (settings) stores.push("settings");

      await runTransaction(stores, "readwrite", async (tx) => {
        for (const store of [
          "categories",
          "products",
          "sales",
          "transactions",
        ] as const) {
          tx.objectStore(store).clear();
        }
        const categoryStore = tx.objectStore("categories");
        for (const category of categories) categoryStore.put(category);
        const productStore = tx.objectStore("products");
        for (const product of products) productStore.put(product);
        const saleStore = tx.objectStore("sales");
        for (const sale of sales) saleStore.put(sale);
        const movementStore = tx.objectStore("transactions");
        for (const movement of transactions) movementStore.put(movement);
        if (settings) tx.objectStore("settings").put(settings);
      });

      return {
        categories: categories.length,
        products: products.length,
        sales: sales.length,
        inventoryTransactions: transactions.length,
      };
    },
  },
};

async function putCategory(category: ApiCategory): Promise<void> {
  await putItem("categories", category);
}

async function putSettings(settings: ApiSettings): Promise<void> {
  await putItem("settings", settings);
}

async function assertNoDuplicateCatalogValue(
  excludeId: string | null,
  sku: string | null | undefined,
  barcode: string | null | undefined,
): Promise<void> {
  if (!sku && !barcode) return;
  const products = await getAll<ApiProduct>("products");
  for (const product of products) {
    if (excludeId && product._id === excludeId) continue;
    if (
      sku &&
      product.sku &&
      product.sku.trim().toLowerCase() === sku.trim().toLowerCase()
    ) {
      throw new ApiError(`A product with SKU "${sku}" already exists.`, 409);
    }
    if (
      barcode &&
      product.barcode &&
      product.barcode.trim() === barcode.trim()
    ) {
      throw new ApiError(
        `A product with barcode "${barcode}" already exists.`,
        409,
      );
    }
  }
}

async function filterProducts(params: ListParams): Promise<ApiProduct[]> {
  const products = await getAll<ApiProduct>("products");
  const filtered = products.filter((product) => {
    if (
      !matchesSearch(params.search, [
        product.name,
        product.brand,
        product.sku,
        product.barcode,
      ])
    ) {
      return false;
    }
    if (params.category !== undefined && params.category !== "") {
      const categoryId =
        typeof product.category === "string"
          ? product.category
          : product.category?._id;
      if (categoryId !== String(params.category)) return false;
    }
    if (params.active !== undefined && params.active !== "") {
      const active = params.active === true || params.active === "true";
      if ((product.status !== "inactive") !== active) return false;
    }
    return true;
  });
  return sortNewestFirst(filtered);
}

async function filterTransactions(
  params: ListParams,
): Promise<ApiTransaction[]> {
  let transactions = await getAll<ApiTransaction>("transactions");
  if (params.product !== undefined && params.product !== "") {
    transactions = transactions.filter((entry) => {
      const id =
        typeof entry.product === "string" ? entry.product : entry.product?._id;
      return id === String(params.product);
    });
  }
  if (params.type !== undefined && params.type !== "") {
    transactions = transactions.filter((entry) => entry.type === String(params.type));
  }
  const mapped = await mapTransactions(transactions);
  return sortNewestFirst(mapped);
}

async function filterSales(params: ListParams): Promise<ApiSale[]> {
  let sales = await getAll<ApiSale>("sales");
  if (params.search !== undefined && params.search !== "") {
    const term = String(params.search).trim().toLowerCase();
    sales = sales.filter(
      (sale) =>
        sale.invoiceNumber.toLowerCase().includes(term) ||
        (sale.customer?.name ?? "").toLowerCase().includes(term) ||
        (sale.customer?.phone ?? "").toLowerCase().includes(term),
    );
  }
  if (params.paymentMethod !== undefined && params.paymentMethod !== "") {
    sales = sales.filter(
      (sale) => sale.paymentMethod === String(params.paymentMethod),
    );
  }
  if (params.from !== undefined && params.from !== "") {
    const from = new Date(String(params.from)).toISOString();
    sales = sales.filter((sale) => sale.createdAt >= from);
  }
  if (params.to !== undefined && params.to !== "") {
    const to = new Date(String(params.to));
    to.setHours(23, 59, 59, 999);
    sales = sales.filter((sale) => sale.createdAt <= to.toISOString());
  }
  return sortNewestFirst(sales);
}
