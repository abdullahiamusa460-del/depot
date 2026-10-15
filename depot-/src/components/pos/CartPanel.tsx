import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { buildCartItems, cartSubtotal, lineTotal } from "../../lib/cart";
import { formatCurrency } from "../../lib/format";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ProductThumb } from "../ui/ProductThumb";

export interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const {
    cart,
    products,
    settings,
    setCartQuantity,
    setLineDiscount,
    removeFromCart,
    clearCart,
  } = useApp();
  const currency = settings.currencySymbol;

  const items = buildCartItems(cart, products);
  const subtotal = cartSubtotal(items);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm xl:max-h-[calc(100dvh-8.5rem)] xl:sticky xl:top-20">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Current sale</h2>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-strong">
            {itemCount}
          </span>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-danger hover:bg-danger-soft"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Cart is empty"
            description="Select products from the list to start a sale."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <li key={item.productId} className="p-3">
                  <div className="flex gap-3">
                    <ProductThumb
                      name={item.name}
                      image={product?.image}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                          {item.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          aria-label={`Remove ${item.name}`}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatCurrency(item.unitPrice, currency)} / {item.unit}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            type="button"
                            onClick={() =>
                              setCartQuantity(item.productId, item.quantity - 1)
                            }
                            aria-label="Decrease quantity"
                            className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              setCartQuantity(
                                item.productId,
                                Math.max(1, Number(event.target.value) || 1),
                              )
                            }
                            className="h-8 w-11 border-x border-border bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none"
                            aria-label="Quantity"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCartQuantity(item.productId, item.quantity + 1)
                            }
                            aria-label="Increase quantity"
                            className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-extrabold text-foreground">
                          {formatCurrency(lineTotal(item), currency)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Discount
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={item.discount || ""}
                          placeholder="0"
                          onChange={(event) =>
                            setLineDiscount(
                              item.productId,
                              Math.max(0, Number(event.target.value) || 0),
                            )
                          }
                          className="h-7 w-20 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                        {product && item.quantity > product.stock && (
                          <span className="text-[11px] font-semibold text-danger">
                            Exceeds stock ({product.stock})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(subtotal, currency)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">Total</span>
          <span className="text-xl font-extrabold text-foreground">
            {formatCurrency(subtotal, currency)}
          </span>
        </div>
        <Button
          size="lg"
          className="mt-3 w-full"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          Charge {formatCurrency(subtotal, currency)}
        </Button>
      </div>
    </div>
  );
}
