import { Keyboard, ScanBarcode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { CartPanel } from "../components/pos/CartPanel";
import { PaymentDialog } from "../components/pos/PaymentDialog";
import { ProductPicker } from "../components/pos/ProductPicker";
import { ReceiptDialog } from "../components/pos/ReceiptDialog";
import { Badge } from "../components/ui/Badge";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useApp } from "../hooks/useApp";
import type { Sale } from "../types";

export default function POS() {
  const { products, categories, cart, settings, addToCart, pushToast } = useApp();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedValue(search, 150);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return products
      .filter((product) => product.active || cart.some((l) => l.productId === product.id))
      .filter((product) => categoryId === "all" || product.categoryId === categoryId)
      .filter((product) => {
        if (!term) return true;
        return (
          product.name.toLowerCase().includes(term) ||
          product.brand.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
          product.barcode.includes(term)
        );
      })
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  }, [products, categoryId, debouncedSearch, cart]);

  const handleAdd = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const inCart = cart.find((line) => line.productId === productId)?.quantity ?? 0;
    if (inCart + 1 > product.stock) {
      pushToast({
        level: "warning",
        title: "Not enough stock",
        message: `Only ${product.stock} ${product.unit.toLowerCase()}(s) of ${product.name} available.`,
      });
      return;
    }
    addToCart(productId, 1);
  };

  return (
    <>
      <PageHeader
        title="Point of Sale"
        description="Search, add products and complete a sale in seconds."
        actions={
          <Badge tone="neutral" className="gap-2 px-3 py-1.5">
            <Keyboard className="h-3.5 w-3.5" />
            Press Ctrl / ⌘ + K to search
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <ProductPicker
          products={filtered}
          categories={categories}
          cart={cart}
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          onAdd={(product) => handleAdd(product.id)}
          currency={settings.currencySymbol}
          searchInputRef={searchRef}
        />
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ScanBarcode className="h-4 w-4" />
        Barcode scanning can be enabled in a future update.
      </div>

      {paymentOpen && (
        <PaymentDialog
          onClose={() => setPaymentOpen(false)}
          onCompleted={(sale) => {
            setPaymentOpen(false);
            setLastSale(sale);
          }}
        />
      )}

      <ReceiptDialog
        sale={lastSale}
        onClose={() => setLastSale(null)}
        onNewSale={() => {
          setSearch("");
          setCategoryId("all");
          searchRef.current?.focus();
        }}
      />
    </>
  );
}
