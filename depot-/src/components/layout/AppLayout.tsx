import { useEffect, useState, type ReactNode } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/cn";
import { Toaster } from "../ui/Toaster";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-canvas">
      {isDesktop && (
        <div className="fixed inset-y-0 left-0 z-40 w-[264px]">
          <Sidebar />
        </div>
      )}

      {!isDesktop && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-overlay animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[278px] max-w-[85vw] shadow-lg animate-fade-in">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className={cn(isDesktop && "pl-[264px]")}>
        <Header onOpenSidebar={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
