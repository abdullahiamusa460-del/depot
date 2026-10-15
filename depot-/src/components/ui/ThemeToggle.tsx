import { Monitor, Moon, Sun } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { ThemeMode } from "../../types";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { Dropdown, DropdownItem } from "./Dropdown";

const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useApp();
  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Dropdown
      panelClassName="min-w-44"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change theme"
          title="Change theme"
        >
          <TriggerIcon className="h-[18px] w-[18px]" />
        </Button>
      }
    >
      {(close) => (
        <>
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
            Appearance
          </p>
          {options.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;
            return (
              <DropdownItem
                key={option.value}
                onClick={() => {
                  setTheme(option.value);
                  close();
                }}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{option.label}</span>
                {active && (
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                )}
              </DropdownItem>
            );
          })}
        </>
      )}
    </Dropdown>
  );
}

export function ThemeSegment({
  className,
}: {
  className?: string;
}) {
  const { theme, setTheme } = useApp();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-surface-muted p-1",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
