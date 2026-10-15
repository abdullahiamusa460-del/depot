import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navSectionsForPermissions } from "../../config/navigation";
import { roleMeta } from "../../config/roles";
import { useApp } from "../../hooks/useApp";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";

export interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { settings, products, role, permissions } = useApp();
  const sections = navSectionsForPermissions(permissions);
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock,
  ).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border">
          <Logo className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold tracking-tight text-foreground">
            {settings.shopName}
          </p>
          <p className="text-xs font-medium text-sidebar-muted">
            Point of Sale &amp; Inventory
          </p>
        </div>
        {role && (
          <span className="hidden shrink-0 xl:block">
            <Badge tone={roleMeta[role].tone}>{roleMeta[role].short}</Badge>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onNavigate}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-sidebar-muted">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                          isActive
                            ? "bg-sidebar-active-soft text-sidebar-active"
                            : "text-sidebar-foreground hover:bg-surface-muted hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-active transition-opacity",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] transition-colors",
                              isActive
                                ? "text-sidebar-active"
                                : "text-sidebar-muted group-hover:text-foreground",
                            )}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <NavLink
          to="/inventory"
          onClick={onNavigate}
          className="block rounded-xl border border-border bg-surface-muted/70 p-3.5 transition-colors hover:bg-surface-muted"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-sidebar-muted">
            Stock health
          </p>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <p className="text-lg font-extrabold text-warning">{lowStock}</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Low stock
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-lg font-extrabold text-danger">{outOfStock}</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Out of stock
              </p>
            </div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
