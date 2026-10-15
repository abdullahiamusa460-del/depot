import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  api,
  clearToken,
  getToken,
  setToken,
} from "../lib/api";
import {
  categoryInputToApi,
  fromPaymentMethod,
  fromStockReason,
  productInputToApi,
  settingsPatchToApi,
  toCategory,
  toProduct,
  toSale,
  toSession,
  toSettings,
  toStaffAccount,
  toTransaction,
} from "../lib/adapters";
import { permissionsForRole } from "../config/permissions";
import { buildCartItems } from "../lib/cart";
import { uid } from "../lib/id";
import type {
  AuthSession,
  BusinessSettings,
  CartLine,
  Category,
  ID,
  InventoryTransaction,
  Notification,
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
import {
  AppContext,
  type AppContextValue,
  type CategoryInput,
  type CheckoutInput,
  type CheckoutResult,
  type LoginResult,
  type ProductInput,
  type StaffResult,
} from "./context";

const THEME_KEY = "beverage-pos.theme";

const EMPTY_SETTINGS: BusinessSettings = {
  shopName: "",
  address: "",
  phone: "",
  email: "",
  currencySymbol: "$",
  currencyCode: "USD",
  invoicePrefix: "INV",
  defaultPaymentMethod: "Cash",
  receiptFooter: "",
  lowStockDefault: 10,
  taxRate: 0,
  paymentMethods: ["Cash", "Bank Transfer"],
};

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryTransaction[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(EMPTY_SETTINGS);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<ID>>(
    () => new Set(),
  );

  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState<boolean>(() => prefersDark());

  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = useMemo<Permission[]>(
    () => (session ? permissionsForRole(session.role) : []),
    [session],
  );

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const canRef = useRef<Permission[]>(permissions);
  useEffect(() => {
    canRef.current = permissions;
  }, [permissions]);

  function canDo(permission: Permission): boolean {
    return canRef.current.includes(permission);
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = resolvedTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", resolvedTheme === "dark" ? "#0a111d" : "#0d9488");
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  const refreshProducts = useCallback(async () => {
    const list = await api.products.all();
    setProducts(list.map(toProduct));
  }, []);

  const refreshCategories = useCallback(async () => {
    const list = await api.categories.list();
    setCategories(list.map(toCategory));
  }, []);

  const refreshSales = useCallback(async () => {
    const list = await api.sales.all();
    setSales(list.map(toSale));
  }, []);

  const refreshInventory = useCallback(async () => {
    const list = await api.inventory.allTransactions();
    setInventory(list.map(toTransaction));
  }, []);

  const loadAll = useCallback(
    async (role: Role, self?: StaffAccount) => {
      setLoading(true);
      setError(null);
      try {
        const [categoryDtos, productDtos, saleDtos, txDtos, settingsDto] =
          await Promise.all([
            api.categories.list(),
            api.products.all(),
            api.sales.all(),
            api.inventory.allTransactions(),
            api.settings.get(),
          ]);
        setCategories(categoryDtos.map(toCategory));
        setProducts(productDtos.map(toProduct));
        setSales(saleDtos.map(toSale));
        setInventory(txDtos.map(toTransaction));
        setSettings(toSettings(settingsDto));

        if (role === "admin") {
          const users = await api.auth.listUsers();
          setStaff(
            users.map((user) => toStaffAccount(user, permissionsForRole(user.role))),
          );
        } else if (self) {
          setStaff([self]);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (session) await loadAll(session.role);
  }, [session, loadAll]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const user = await api.auth.me();
        if (cancelled) return;
        setSession(toSession(user));
        await loadAll(
          user.role,
          toStaffAccount(user, permissionsForRole(user.role)),
        );
      } catch {
        if (cancelled) return;
        clearToken();
        setSession(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      if (!email.trim() || !password) {
        return { ok: false, error: "Enter your email and password." };
      }
      try {
        const { user, token } = await api.auth.login(email.trim(), password);
        setToken(token);
        const next = toSession(user);
        setSession(next);
        await loadAll(
          user.role,
          toStaffAccount(user, permissionsForRole(user.role)),
        );
        return { ok: true, session: next };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [loadAll],
  );

  const logout = useCallback(() => {
    clearToken();
    setSession(null);
    setCart([]);
    setProducts([]);
    setCategories([]);
    setSales([]);
    setInventory([]);
    setStaff([]);
    setSettings(EMPTY_SETTINGS);
    setError(null);
  }, []);

  const dismissToast = useCallback((id: ID) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = uid("toast");
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  const addStaff = useCallback(
    async (input: StaffInput): Promise<StaffResult> => {
      if (!canDo("staff.manage")) {
        return { ok: false, error: "You do not have permission to manage staff." };
      }
      if (!input.name.trim()) return { ok: false, error: "Enter the staff name." };
      if (!input.email.trim()) return { ok: false, error: "Enter an email address." };
      if (!input.password.trim())
        return { ok: false, error: "Enter a password." };
      try {
        const { user } = await api.auth.register({
          name: input.name.trim(),
          email: input.email.trim(),
          password: input.password,
          role: input.role,
        });
        const account = toStaffAccount(user, permissionsForRole(user.role));
        setStaff((current) => [account, ...current]);
        return { ok: true, account };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  const updateStaff = useCallback(
    async (id: ID, input: StaffInput): Promise<StaffResult> => {
      if (!canDo("staff.manage")) {
        return { ok: false, error: "You do not have permission to manage staff." };
      }
      try {
        const user = await api.auth.updateUser(id, {
          name: input.name.trim(),
          role: input.role,
          active: input.active,
        });
        const account = toStaffAccount(user, permissionsForRole(user.role));
        setStaff((current) =>
          current.map((member) => (member.id === id ? account : member)),
        );
        setSession((current) =>
          current && current.accountId === id
            ? { ...current, role: user.role, name: user.name }
            : current,
        );
        return { ok: true, account };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  const deleteStaff = useCallback(
    async (id: ID): Promise<StaffResult> => {
      if (!canDo("staff.manage")) {
        return { ok: false, error: "You do not have permission to manage staff." };
      }
      if (session?.accountId === id) {
        return { ok: false, error: "You cannot deactivate your own account." };
      }
      try {
        const user = await api.auth.updateUser(id, { active: false });
        setStaff((current) =>
          current.map((member) =>
            member.id === id
              ? { ...member, active: user.active, role: user.role, name: user.name }
              : member,
          ),
        );
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [session?.accountId],
  );

  const addProduct = useCallback(
    async (input: ProductInput): Promise<Product | null> => {
      if (!canDo("products.manage")) return null;
      try {
        const dto = await api.products.create(productInputToApi(input));
        const product = toProduct(dto);
        setProducts((current) => [product, ...current]);
        return product;
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not save product",
          message: errorMessage(err),
        });
        return null;
      }
    },
    [pushToast],
  );

  const updateProduct = useCallback(
    async (id: ID, input: ProductInput): Promise<void> => {
      if (!canDo("products.manage")) return;
      try {
        const dto = await api.products.update(id, productInputToApi(input));
        const product = toProduct(dto);
        setProducts((current) =>
          current.map((item) => (item.id === id ? product : item)),
        );
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not update product",
          message: errorMessage(err),
        });
      }
    },
    [pushToast],
  );

  const deleteProduct = useCallback(
    async (id: ID): Promise<void> => {
      if (!canDo("products.manage")) return;
      try {
        await api.products.remove(id);
        setProducts((current) => current.filter((product) => product.id !== id));
        setCart((current) => current.filter((line) => line.productId !== id));
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not delete product",
          message: errorMessage(err),
        });
      }
    },
    [pushToast],
  );

  const toggleProductActive = useCallback(
    async (id: ID): Promise<void> => {
      if (!canDo("products.manage")) return;
      const existing = products.find((product) => product.id === id);
      if (!existing) return;
      try {
        const dto = await api.products.update(id, {
          status: existing.active ? "inactive" : "active",
        });
        const product = toProduct(dto);
        setProducts((current) =>
          current.map((item) => (item.id === id ? product : item)),
        );
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not update product",
          message: errorMessage(err),
        });
      }
    },
    [products, pushToast],
  );

  const addCategory = useCallback(
    async (input: CategoryInput): Promise<Category | null> => {
      if (!canDo("categories.manage")) return null;
      try {
        const dto = await api.categories.create(categoryInputToApi(input));
        const category = toCategory(dto);
        setCategories((current) => [...current, category]);
        return category;
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not save category",
          message: errorMessage(err),
        });
        return null;
      }
    },
    [pushToast],
  );

  const updateCategory = useCallback(
    async (id: ID, input: CategoryInput): Promise<void> => {
      if (!canDo("categories.manage")) return;
      try {
        const dto = await api.categories.update(id, categoryInputToApi(input));
        const category = toCategory(dto);
        setCategories((current) =>
          current.map((item) => (item.id === id ? category : item)),
        );
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not update category",
          message: errorMessage(err),
        });
      }
    },
    [pushToast],
  );

  const deleteCategory = useCallback(
    async (id: ID): Promise<void> => {
      if (!canDo("categories.manage")) return;
      try {
        await api.categories.remove(id);
        setCategories((current) =>
          current.filter((category) => category.id !== id),
        );
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not delete category",
          message: errorMessage(err),
        });
      }
    },
    [pushToast],
  );

  const adjustStock = useCallback(
    async (
      productId: ID,
      change: number,
      type: StockReason,
      reason: string,
    ): Promise<void> => {
      if (!canDo("inventory.adjust")) return;
      try {
        await api.inventory.adjust({
          product: productId,
          type: fromStockReason(type),
          quantityChange: change,
          reason: reason || type,
        });
        await Promise.all([refreshProducts(), refreshInventory()]);
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not adjust stock",
          message: errorMessage(err),
        });
      }
    },
    [pushToast, refreshProducts, refreshInventory],
  );

  const addToCart = useCallback((productId: ID, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        );
      }
      return [...current, { productId, quantity, discount: 0 }];
    });
  }, []);

  const setCartQuantity = useCallback((productId: ID, quantity: number) => {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const setLineDiscount = useCallback((productId: ID, discount: number) => {
    setCart((current) =>
      current.map((line) =>
        line.productId === productId
          ? { ...line, discount: Math.max(0, discount) }
          : line,
      ),
    );
  }, []);

  const removeFromCart = useCallback((productId: ID) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const checkout = useCallback(
    async (input: CheckoutInput): Promise<CheckoutResult> => {
      if (!canDo("pos.sell")) {
        return {
          ok: false,
          error: "You do not have permission to process sales.",
        };
      }
      const items = buildCartItems(cart, products);
      if (items.length === 0) {
        return { ok: false, error: "The sale is empty. Add at least one product." };
      }
      try {
        const dto = await api.sales.create({
          items: items.map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            discount: item.discount,
          })),
          discount: input.discount,
          amountPaid: input.amountPaid,
          paymentMethod: fromPaymentMethod(input.paymentMethod),
          customer: input.customer,
          note: input.note,
        });
        const sale = toSale(dto);
        setSales((current) => [sale, ...current]);
        setCart([]);
        await Promise.all([refreshProducts(), refreshInventory()]);
        return { ok: true, sale };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [cart, products, refreshProducts, refreshInventory],
  );

  const updateSettings = useCallback(
    async (patch: Partial<BusinessSettings>): Promise<void> => {
      if (!canDo("settings.manage")) return;
      try {
        const dto = await api.settings.update(settingsPatchToApi(patch));
        setSettings(toSettings(dto));
      } catch (err) {
        pushToast({
          level: "danger",
          title: "Could not save settings",
          message: errorMessage(err),
        });
      }
    },
    [pushToast],
  );

  const notifications = useMemo<Notification[]>(() => {
    const alerts: Notification[] = [];
    for (const product of products) {
      if (product.stock === 0) {
        alerts.push({
          id: `notif_out_${product.id}`,
          title: "Out of stock",
          message: `${product.name} is out of stock.`,
          level: "danger",
          createdAt: product.updatedAt,
          read: readNotificationIds.has(`notif_out_${product.id}`),
        });
      } else if (product.stock <= product.minStock) {
        alerts.push({
          id: `notif_low_${product.id}`,
          title: "Low stock",
          message: `${product.name} is down to ${product.stock} ${product.unit.toLowerCase()}(s).`,
          level: "warning",
          createdAt: product.updatedAt,
          read: readNotificationIds.has(`notif_low_${product.id}`),
        });
      }
    }
    return alerts.slice(0, 12);
  }, [products, readNotificationIds]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markNotificationsRead = useCallback(() => {
    setReadNotificationIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      return next;
    });
  }, [notifications]);

  const exportData = useCallback(async (): Promise<string> => {
    if (!canDo("backup.manage")) {
      throw new Error("You do not have permission to export data.");
    }
    return api.backup.export();
  }, []);

  const importData = useCallback(
    async (payload: unknown): Promise<{ ok: boolean; error?: string }> => {
      if (!canDo("backup.manage")) {
        return { ok: false, error: "You do not have permission to restore data." };
      }
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "The selected file is not a valid backup." };
      }
      const candidate = payload as { app?: string; data?: unknown };
      if (candidate.app !== "depot-backend" || !candidate.data) {
        return {
          ok: false,
          error: "This file was not created by the Depot backend.",
        };
      }
      try {
        await api.backup.restore(candidate.data);
        if (session) await loadAll(session.role);
        setCart([]);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [session, loadAll],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      loading,
      error,
      refresh,
      products,
      categories,
      sales,
      inventory,
      settings,
      notifications,
      unreadCount,
      markNotificationsRead,
      session,
      role: session?.role ?? null,
      login,
      logout,
      staff,
      permissions,
      can,
      addStaff,
      updateStaff,
      deleteStaff,
      theme,
      resolvedTheme,
      setTheme,
      toasts,
      pushToast,
      dismissToast,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductActive,
      addCategory,
      updateCategory,
      deleteCategory,
      adjustStock,
      cart,
      addToCart,
      setCartQuantity,
      setLineDiscount,
      removeFromCart,
      clearCart,
      checkout,
      updateSettings,
      exportData,
      importData,
    }),
    [
      ready,
      loading,
      error,
      refresh,
      products,
      categories,
      sales,
      inventory,
      settings,
      notifications,
      unreadCount,
      markNotificationsRead,
      session,
      login,
      logout,
      staff,
      permissions,
      can,
      addStaff,
      updateStaff,
      deleteStaff,
      theme,
      resolvedTheme,
      setTheme,
      toasts,
      pushToast,
      dismissToast,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductActive,
      addCategory,
      updateCategory,
      deleteCategory,
      adjustStock,
      cart,
      addToCart,
      setCartQuantity,
      setLineDiscount,
      removeFromCart,
      clearCart,
      checkout,
      updateSettings,
      exportData,
      importData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
