import type { ApiCategory, ApiProduct, ApiSettings, ApiTransaction } from "../api";
import {
  getItem,
  newObjectId,
  nowIso,
  runTransaction,
  hashPassword,
  newSalt,
  reqAsPromise,
  type StoreName,
} from "./db";

/** A user record as stored locally. Password material never leaves this module. */
export interface StoredUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  active: boolean;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  _id: "",
  key: "global",
  shopName: "Beverage Depot",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  currency: "NGN",
  currencySymbol: "₦",
  invoicePrefix: "INV",
  defaultPaymentMethod: "cash",
  paymentMethods: ["cash", "bank_transfer", "pos", "other"],
  receiptFooter: "Thank you for your purchase!",
  lowStockDefault: 10,
  taxPercent: 0,
  createdAt: "",
  updatedAt: "",
};

interface SampleProductInput {
  name: string;
  brand: string;
  sku: string;
  sellingUnit: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  imageUrl: string;
  category: "soft-drinks" | "energy-drinks";
}

const SAMPLE_CATEGORIES: Array<{
  key: "soft-drinks" | "energy-drinks";
  name: string;
  description: string;
}> = [
  {
    key: "soft-drinks",
    name: "Soft Drinks",
    description: "Colas, lemon-lime sodas and mixers",
  },
  {
    key: "energy-drinks",
    name: "Energy Drinks",
    description: "Canned energy drinks",
  },
];

const SAMPLE_PRODUCTS: SampleProductInput[] = [
  {
    name: "Coca-Cola 50cl",
    brand: "Coca-Cola",
    sku: "CC-50CL",
    sellingUnit: "bottle",
    price: 500,
    costPrice: 400,
    stock: 120,
    minStock: 12,
    imageUrl: "/images/products/coca-cola.jpg",
    category: "soft-drinks",
  },
  {
    name: "Coca-Cola Can 330ml",
    brand: "Coca-Cola",
    sku: "CC-CAN33",
    sellingUnit: "can",
    price: 400,
    costPrice: 320,
    stock: 96,
    minStock: 12,
    imageUrl: "/images/products/coca-cola-can.jpg",
    category: "soft-drinks",
  },
  {
    name: "Fanta 50cl",
    brand: "Fanta",
    sku: "FA-50CL",
    sellingUnit: "bottle",
    price: 500,
    costPrice: 400,
    stock: 84,
    minStock: 12,
    imageUrl: "/images/products/fanta.jpg",
    category: "soft-drinks",
  },
  {
    name: "Sprite 50cl",
    brand: "Sprite",
    sku: "SP-50CL",
    sellingUnit: "bottle",
    price: 500,
    costPrice: 400,
    stock: 90,
    minStock: 12,
    imageUrl: "/images/products/sprite.jpg",
    category: "soft-drinks",
  },
  {
    name: "Schweppes Bitter Lemon 330ml",
    brand: "Schweppes",
    sku: "SW-BL33",
    sellingUnit: "can",
    price: 600,
    costPrice: 480,
    stock: 60,
    minStock: 10,
    imageUrl: "/images/products/schweppes-bitter-lemon.jpg",
    category: "soft-drinks",
  },
  {
    name: "Schweppes Mojito 330ml",
    brand: "Schweppes",
    sku: "SW-MOJ33",
    sellingUnit: "can",
    price: 600,
    costPrice: 480,
    stock: 60,
    minStock: 10,
    imageUrl: "/images/products/schweppes-mojito.jpg",
    category: "soft-drinks",
  },
  {
    name: "Monster Energy Green 500ml",
    brand: "Monster Energy",
    sku: "MO-GRN500",
    sellingUnit: "can",
    price: 2500,
    costPrice: 2000,
    stock: 48,
    minStock: 8,
    imageUrl: "/images/products/monster-energy-green.jpg",
    category: "energy-drinks",
  },
  {
    name: "Monster Energy Ultra White 500ml",
    brand: "Monster Energy",
    sku: "MO-WHT500",
    sellingUnit: "can",
    price: 2500,
    costPrice: 2000,
    stock: 48,
    minStock: 8,
    imageUrl: "/images/products/monster-energy-ultra-white.jpg",
    category: "energy-drinks",
  },
];

const SAMPLE_ACCOUNTS = [
  {
    name: "Admin",
    email: "dazumiglobalventuresadmin@gmail.com",
    role: "admin" as const,
    password: "Admin@001",
  },
  {
    name: "Staff",
    email: "dazumiglobalventuresstaff@gmail.com",
    role: "staff" as const,
    password: "Staff@002",
  },
];

/** Emails used by earlier builds, upgraded to the current sample accounts once. */
const LEGACY_SAMPLE_EMAILS: Record<string, string> = {
  "admin@beverage.local": "dazumiglobalventuresadmin@gmail.com",
  "staff@beverage.local": "dazumiglobalventuresstaff@gmail.com",
};

async function buildSampleUsers(): Promise<StoredUser[]> {
  const timestamp = nowIso();
  const users: StoredUser[] = [];
  for (const account of SAMPLE_ACCOUNTS) {
    const salt = newSalt();
    users.push({
      _id: newObjectId(),
      name: account.name,
      email: account.email,
      role: account.role,
      active: true,
      salt,
      passwordHash: await hashPassword(account.password, salt),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return users;
}

let seedPromise: Promise<void> | null = null;

/**
 * First-run bootstrap: sample catalog, default settings and the two local
 * accounts (admin/staff). Runs once inside a single transaction, so two tabs
 * opening at the same time cannot double-seed the database.
 */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

/**
 * One-time repair for databases seeded before sample products were linked to
 * their categories correctly: backfills any product left with an empty
 * `category` using the sample SKU → category mapping. Guarded by a `meta`
 * flag so it runs at most once per device.
 */
async function repairSampleCategoryRefs(): Promise<void> {
  const done = await getItem<{ key: string; value: boolean }>(
    "meta",
    "sampleCategoryRefsRepaired",
  );
  if (done?.value) return;

  await runTransaction(["products", "categories", "meta"], "readwrite", async (tx) => {
    const products = (await reqAsPromise(
      tx.objectStore("products").getAll(),
    )) as ApiProduct[];
    const broken = products.filter((product) => !product.category);
    if (broken.length > 0) {
      const categories = (await reqAsPromise(
        tx.objectStore("categories").getAll(),
      )) as ApiCategory[];
      const idByName = new Map<string, string>();
      for (const category of categories) {
        idByName.set(category.name.trim().toLowerCase(), category._id);
      }
      const categoryNameBySku = new Map<string, string>();
      for (const sample of SAMPLE_PRODUCTS) {
        const name = SAMPLE_CATEGORIES.find(
          (category) => category.key === sample.category,
        )?.name;
        if (name) categoryNameBySku.set(sample.sku.toUpperCase(), name);
      }
      for (const product of broken) {
        const name = categoryNameBySku.get(String(product.sku ?? "").toUpperCase());
        const categoryId = name ? idByName.get(name.toLowerCase()) : undefined;
        if (categoryId) {
          tx.objectStore("products").put({
            ...product,
            category: categoryId,
            updatedAt: nowIso(),
          });
        }
      }
    }
    tx.objectStore("meta").put({
      key: "sampleCategoryRefsRepaired",
      value: true,
    });
  });
}

/**
 * One-time upgrade of the bundled accounts to the current credentials.
 *
 * The first-run seed only runs once, so a device seeded by an earlier build
 * keeps the old logins. This updates any account still using a legacy sample
 * email to the current email/password (re-hashing the password), and seeds the
 * sample accounts if the device somehow has no users at all. Guarded by a
 * `meta` flag so it runs at most once; accounts whose email was changed away
 * from the sample are left untouched.
 */
async function applySampleAccountUpdates(): Promise<void> {
  const done = await getItem<{ key: string; value: boolean }>(
    "meta",
    "sampleAccountsUpdated",
  );
  if (done?.value) return;

  await runTransaction(["users", "meta"], "readwrite", async (tx) => {
    const store = tx.objectStore("users");
    const users = (await reqAsPromise(store.getAll())) as StoredUser[];

    if (users.length === 0) {
      for (const user of await buildSampleUsers()) store.put(user);
    } else {
      for (const account of SAMPLE_ACCOUNTS) {
        const legacyEmail = Object.entries(LEGACY_SAMPLE_EMAILS).find(
          ([, current]) => current === account.email,
        )?.[0];
        const match = users.find((user) => {
          const email = user.email.trim().toLowerCase();
          return (
            email === account.email.toLowerCase() ||
            (legacyEmail ? email === legacyEmail.toLowerCase() : false)
          );
        });
        if (!match) continue;
        const salt = newSalt();
        store.put({
          ...match,
          email: account.email,
          salt,
          passwordHash: await hashPassword(account.password, salt),
          active: true,
          updatedAt: nowIso(),
        });
      }
    }

    tx.objectStore("meta").put({ key: "sampleAccountsUpdated", value: true });
  });
}

async function runSeed(): Promise<void> {
  const flag = await getItem<{ key: string; value: boolean }>("meta", "seeded");
  if (flag?.value) {
    await repairSampleCategoryRefs();
    await applySampleAccountUpdates();
    return;
  }

  await runTransaction(
    ["meta", "users", "categories", "products", "transactions", "settings"],
    "readwrite",
    async (tx) => {
      const already = await reqAsPromise(tx.objectStore("meta").get("seeded"));
      if (already?.value) return;

      const timestamp = nowIso();

      const userCount = await reqAsPromise(tx.objectStore("users").count());
      if (userCount === 0) {
        const userStore = tx.objectStore("users");
        for (const user of await buildSampleUsers()) userStore.put(user);
      }

      const settings = await reqAsPromise(
        tx.objectStore("settings").get("global"),
      );
      if (!settings) {
        tx.objectStore("settings").put({
          ...DEFAULT_SETTINGS,
          _id: newObjectId(),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // Make sure the sample categories exist (matching by name when the shop
      // already created its own), then hang sample products off them.
      const categoryStore = tx.objectStore("categories");
      const existingCategories = (await reqAsPromise(
        categoryStore.getAll(),
      )) as ApiCategory[];
      const categoryIdByName = new Map<string, string>();
      for (const category of existingCategories) {
        categoryIdByName.set(category.name.trim().toLowerCase(), category._id);
      }
      for (const sample of SAMPLE_CATEGORIES) {
        const key = sample.name.trim().toLowerCase();
        if (categoryIdByName.has(key)) continue;
        const _id = newObjectId();
        categoryIdByName.set(key, _id);
        categoryStore.put({
          _id,
          name: sample.name,
          description: sample.description,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      // Sample products reference categories by their slug (`sample.category`),
      // so resolve that key to the same id as the human-readable name.
      for (const sample of SAMPLE_CATEGORIES) {
        if (categoryIdByName.has(sample.key)) continue;
        const byName = categoryIdByName.get(sample.name.trim().toLowerCase());
        if (byName) categoryIdByName.set(sample.key, byName);
      }

      const productCount = await reqAsPromise(tx.objectStore("products").count());
      if (productCount === 0) {
        const productStore = tx.objectStore("products");
        const movementStore = tx.objectStore("transactions");
        for (const sample of SAMPLE_PRODUCTS) {
          const _id = newObjectId();
          productStore.put({
            _id,
            name: sample.name,
            brand: sample.brand,
            category:
              categoryIdByName.get(sample.category.trim().toLowerCase()) ?? "",
            description: "",
            sku: sample.sku,
            barcode: null,
            imageUrl: sample.imageUrl,
            sellingUnit: sample.sellingUnit,
            price: sample.price,
            costPrice: sample.costPrice,
            stock: sample.stock,
            minStock: sample.minStock,
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          movementStore.put({
            _id: newObjectId(),
            product: _id,
            type: "received",
            previousQuantity: 0,
            quantityChange: sample.stock,
            newQuantity: sample.stock,
            reason: "Initial stock",
            user: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }

      tx.objectStore("meta").put({ key: "seeded", value: true });
    },
  );
}

/**
 * "Reset to sample data" from the Backup page: replaces the catalog, sales and
 * stock history with the bundled sample records. Accounts and settings are
 * kept.
 */
export async function resetSampleCatalog(): Promise<void> {
  const timestamp = nowIso();
  const categoryIds = new Map<string, string>();
  const categories: ApiCategory[] = SAMPLE_CATEGORIES.map((sample) => {
    const _id = newObjectId();
    categoryIds.set(sample.key, _id);
    return {
      _id,
      name: sample.name,
      description: sample.description,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  const products: ApiProduct[] = [];
  const movements: ApiTransaction[] = [];
  for (const sample of SAMPLE_PRODUCTS) {
    const _id = newObjectId();
    products.push({
      _id,
      name: sample.name,
      brand: sample.brand,
      category: categoryIds.get(sample.category) ?? "",
      description: "",
      sku: sample.sku,
      barcode: null,
      imageUrl: sample.imageUrl,
      sellingUnit: sample.sellingUnit,
      price: sample.price,
      costPrice: sample.costPrice,
      stock: sample.stock,
      minStock: sample.minStock,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    movements.push({
      _id: newObjectId(),
      product: _id,
      type: "received",
      previousQuantity: 0,
      quantityChange: sample.stock,
      newQuantity: sample.stock,
      reason: "Initial stock",
      user: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await runTransaction(
    ["categories", "products", "sales", "transactions"],
    "readwrite",
    async (tx) => {
      const stores: StoreName[] = ["categories", "products", "sales", "transactions"];
      for (const store of stores) tx.objectStore(store).clear();
      const categoryStore = tx.objectStore("categories");
      for (const category of categories) categoryStore.put(category);
      const productStore = tx.objectStore("products");
      for (const product of products) productStore.put(product);
      const movementStore = tx.objectStore("transactions");
      for (const movement of movements) movementStore.put(movement);
    },
  );
}
