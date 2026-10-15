import {
  Bell,
  DatabaseBackup,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { roleMeta } from "../../config/roles";
import { useApp } from "../../hooks/useApp";
import { cn } from "../../lib/cn";
import { initials } from "../../lib/format";
import { timeAgo } from "../../lib/timeAgo";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/Dropdown";
import { ThemeToggle } from "../ui/ThemeToggle";

const levelDot: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markNotificationsRead,
    settings,
    session,
    role,
    logout,
    can,
  } = useApp();
  const [query, setQuery] = useState("");

  const displayName = session?.name ?? "Guest";
  const roleLabel = role ? roleMeta[role].label : "Signed out";
  const canSeeSettings = can("settings.manage");
  const canSeeBackup = can("backup.manage");
  const canSell = can("pos.sell");
  const canViewProducts = can("products.view");

  const submitSearch = () => {
    const trimmed = query.trim();
    navigate(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {canViewProducts && (
        <label className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Search products, SKU or barcode…"
            className="h-10 w-full rounded-lg border border-border bg-surface-muted/60 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle-foreground transition-colors focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </label>
      )}

      <div className="flex flex-1 items-center justify-end gap-1.5 md:flex-none">
        {canViewProducts && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => navigate("/products")}
            aria-label="Search products"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}

        {canSell && (
          <Button
            variant="primary"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => navigate("/pos")}
          >
            <Plus className="h-4 w-4" />
            New sale
          </Button>
        )}

        <Dropdown
          panelClassName="w-80 p-0"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          }
        >
          {(close) => (
            <>
              <div className="flex items-center justify-between px-3.5 py-3">
                <p className="text-sm font-bold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markNotificationsRead}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto border-t border-border">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <ShieldCheck className="h-8 w-8 text-success" />
                    <p className="text-sm font-semibold text-foreground">
                      All stock levels are healthy
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We will alert you when a product runs low.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        navigate("/inventory");
                        close();
                      }}
                      className="flex w-full items-start gap-3 border-b border-border px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-surface-muted"
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          levelDot[notification.level],
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-subtle-foreground">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </Dropdown>

        <ThemeToggle />

        <Dropdown
          panelClassName="w-60"
          trigger={
            <button
              type="button"
              className="ml-0.5 flex items-center gap-2 rounded-full border border-border bg-surface p-0.5 pr-2.5 transition-colors hover:bg-surface-muted"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-xs font-bold text-primary-foreground">
                {initials(displayName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-bold leading-tight text-foreground">
                  {displayName}
                </span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
            </button>
          }
        >
          {(close) => (
            <>
              <div className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-foreground">
                    {displayName}
                  </p>
                  {role && (
                    <Badge tone={roleMeta[role].tone}>{roleMeta[role].label}</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {session?.email} · {settings.shopName}
                </p>
              </div>
              <DropdownSeparator />
              {canSeeSettings && (
                <DropdownItem
                  onClick={() => {
                    navigate("/settings");
                    close();
                  }}
                >
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Settings
                </DropdownItem>
              )}
              {canSeeBackup && (
                <DropdownItem
                  onClick={() => {
                    navigate("/backup");
                    close();
                  }}
                >
                  <DatabaseBackup className="h-4 w-4 text-muted-foreground" />
                  Backup &amp; Restore
                </DropdownItem>
              )}
              {(canSeeSettings || canSeeBackup) && <DropdownSeparator />}
              <DropdownItem
                className="text-danger hover:bg-danger-soft"
                onClick={() => {
                  logout();
                  close();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
