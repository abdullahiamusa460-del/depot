import { createContext } from "react";
import type {
  AuthSession,
  BackupPayload,
  BusinessSettings,
  CartLine,
  Category,
  ID,
  InventoryTransaction,
  Notification,
  PaymentMethod,
  Permission,
  Product,
  Role,
  Sale,
  StaffAccount,
  StaffInput,
  StockReason,
  ThemeMode,
  Toast,
} from "../types";

export interface StaffResult {
  ok: boolean;
  error?: string;
  account?: StaffAccount;
}

export interface ProductInput {
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  sku: string;
  barcode: string;
  image?: string;
  unit: Product["unit"];
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  active: boolean;
}

export interface CategoryInput {
  name: string;
  description: string;
  color: string;
}

export interface CheckoutInput {
  amountPaid: number;
  paymentMethod: PaymentMethod;
  customer: { name: string; phone: string };
  discount: number;
  note?: string;
  applyTax?: boolean;
}

export interface CheckoutResult {
  ok: boolean;
  sale?: Sale;
  error?: string;
}

export interface LoginResult {
  ok: boolean;
  session?: AuthSession;
  error?: string;
}

export interface AppContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  session: AuthSession | null;
  role: Role | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;

  staff: StaffAccount[];
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  addStaff: (input: StaffInput) => Promise<StaffResult>;
  updateStaff: (id: ID, input: StaffInput) => Promise<StaffResult>;
  deleteStaff: (id: ID) => Promise<StaffResult>;

  products: Product[];
  categories: Category[];
  sales: Sale[];
  inventory: InventoryTransaction[];
  settings: BusinessSettings;
  notifications: Notification[];
  unreadCount: number;
  markNotificationsRead: () => void;

  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;

  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: ID) => void;

  addProduct: (input: ProductInput) => Promise<Product | null>;
  updateProduct: (id: ID, input: ProductInput) => Promise<void>;
  deleteProduct: (id: ID) => Promise<void>;
  toggleProductActive: (id: ID) => Promise<void>;

  addCategory: (input: CategoryInput) => Promise<Category | null>;
  updateCategory: (id: ID, input: CategoryInput) => Promise<void>;
  deleteCategory: (id: ID) => Promise<void>;

  adjustStock: (
    productId: ID,
    change: number,
    type: StockReason,
    reason: string,
  ) => Promise<void>;

  cart: CartLine[];
  addToCart: (productId: ID, quantity?: number) => void;
  setCartQuantity: (productId: ID, quantity: number) => void;
  setLineDiscount: (productId: ID, discount: number) => void;
  removeFromCart: (productId: ID) => void;
  clearCart: () => void;

  checkout: (input: CheckoutInput) => Promise<CheckoutResult>;

  updateSettings: (patch: Partial<BusinessSettings>) => Promise<void>;

  exportData: () => Promise<BackupPayload>;
  importData: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
  resetData: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);
