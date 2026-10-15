import { Loader2, PackageOpen, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequirePermission } from "./components/auth/RequirePermission";
import { AppLayout } from "./components/layout/AppLayout";
import { Button } from "./components/ui/Button";
import { ErrorState } from "./components/ui/ErrorState";
import { useApp } from "./hooks/useApp";
import Backup from "./pages/Backup";
import Categories from "./pages/Categories";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import type { Permission } from "./types";

interface AppRoute {
  path: string;
  permission: Permission;
  element: ReactNode;
}

const appRoutes: AppRoute[] = [
  { path: "/", permission: "dashboard.view", element: <Dashboard /> },
  { path: "/pos", permission: "pos.sell", element: <POS /> },
  { path: "/products", permission: "products.view", element: <Products /> },
  { path: "/categories", permission: "categories.manage", element: <Categories /> },
  { path: "/inventory", permission: "inventory.view", element: <Inventory /> },
  { path: "/sales", permission: "sales.view", element: <Sales /> },
  { path: "/reports", permission: "reports.view", element: <Reports /> },
  { path: "/team", permission: "staff.manage", element: <Team /> },
  { path: "/settings", permission: "settings.manage", element: <Settings /> },
  { path: "/backup", permission: "backup.manage", element: <Backup /> },
];

function BootShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function BootScreen({ label }: { label: string }) {
  return (
    <BootShell>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <PackageOpen className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
      </div>
    </BootShell>
  );
}

export default function App() {
  const { session, ready, loading, error, refresh, logout } = useApp();

  if (!ready) {
    return <BootScreen label="Starting the depot…" />;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (error) {
    return (
      <BootShell>
        <ErrorState
          title="Could not load shop data"
          description={error}
          onRetry={() => void refresh()}
        />
        <div className="mt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </BootShell>
    );
  }

  if (loading) {
    return <BootScreen label="Loading shop data…" />;
  }

  return (
    <AppLayout>
      <Routes>
        {appRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <RequirePermission permission={route.permission}>
                {route.element}
              </RequirePermission>
            }
          />
        ))}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}
