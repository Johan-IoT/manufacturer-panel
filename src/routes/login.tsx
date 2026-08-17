import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Radar } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toUserMessage } from "@/services/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | Manufacturer Panel" },
      { name: "description", content: "Sign in to the ConfigGate Manufacturer Panel to manage devices, BLE profiles and access." },
      { property: "og:title", content: "Sign in | Manufacturer Panel" },
      { property: "og:description", content: "Secure access to the ConfigGate Manufacturer Panel." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

function LoginPage() {
  const { session, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (ready && session) navigate({ to: "/", replace: true });
  }, [ready, session, navigate]);

  const parsed = schema.safeParse({ email, password });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = schema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "email") fieldErrors.email = issue.message;
        if (key === "password") fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(email, password);
      navigate({ to: "/", replace: true });
    } catch (error) {
      setFormError(toUserMessage(error, "Unable to sign in right now. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen animate-page-enter lg:grid-cols-2">
      <div className="login-hero-panel relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-primary/20 p-12 lg:flex">
        <div className="relative flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-md border border-primary-foreground/20 bg-primary-foreground/10">
            <Radar className="size-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-primary-foreground">Manufacturer Panel</p>
            <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/70">ConfigGate</p>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-10">
          <img
            src="/without_bg_logo.png"
            alt="ConfigGate"
            className="h-56 w-auto max-w-[92%] object-contain sm:h-64 lg:h-80 xl:h-96"
          />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-primary-foreground">
            Control layer for the BLE device ecosystem.
          </h2>
        </div>
      </div>

      <div className="login-panel-bg relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="animate-content-enter w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[0_18px_50px_-24px_oklch(0.41_0.14_252_/_0.35)] sm:p-8">
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Manufacturer access</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to manage devices, BLE profiles, relationships and fleet operations.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Sign in</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                aria-invalid={!!errors.email}
                placeholder="name@company.com"
                className="bg-background"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  placeholder="Enter your password"
                  className="bg-background pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {formError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!parsed.success || loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
