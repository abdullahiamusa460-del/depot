import {
  AlertTriangle,
  Loader2,
  LogIn,
  WifiOff,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";
import { Switch } from "../components/ui/Switch";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useApp } from "../hooks/useApp";
import { navItemsForRole } from "../config/navigation";

export default function Login() {
  const { login, settings } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const accessItems = navItemsForRole("staff");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await login(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-lg lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-primary to-primary-strong p-8 text-primary-foreground lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                <Logo className="h-full w-full" />
              </span>
              <div>
                <p className="text-lg font-extrabold tracking-tight">
                  {settings.shopName || "Beverage Depot"}
                </p>
                <p className="text-sm text-white/80">Point of Sale &amp; Inventory</p>
              </div>
            </div>

            <span className="mt-9 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              <WifiOff className="h-3.5 w-3.5" />
              Works offline · saved on this device
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-white/85">
              Sign in to open the till. Products, stock, sales and receipts are
              stored on this device and stay available without internet.
            </p>
          </div>

          {accessItems.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                What you can do depends on your role
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {accessItems.map((item) => (
                  <li
                    key={item.to}
                    className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-8 lg:p-10">
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <Field label="Name or email" htmlFor="login-email">
              <Input
                id="login-email"
                type="text"
                inputMode="email"
                value={email}
                autoComplete="username"
                placeholder="admin or you@shop.com"
                invalid={Boolean(error)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                placeholder="••••••••"
                invalid={Boolean(error)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            </Field>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">
                Show password
              </span>
              <Switch
                checked={showPassword}
                onChange={setShowPassword}
                label="Show password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign in
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Default accounts on this device:{" "}
              <span className="font-mono">
                dazumiglobalventuresadmin@gmail.com / Admin@001
              </span>{" "}
              (administrator) and{" "}
              <span className="font-mono">
                dazumiglobalventuresstaff@gmail.com / Staff@002
              </span>{" "}
              (shop staff). You can also sign in with the account name. Change
              these from the Team page after your first login.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
