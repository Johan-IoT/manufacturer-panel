import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Radar, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toUserMessage } from "@/services/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Manufacturer Panel" },
      { name: "description", content: "Sign in to the GSM Systems Manufacturer Panel to manage devices, BLE profiles and access." },
      { property: "og:title", content: "Sign in — Manufacturer Panel" },
      { property: "og:description", content: "Secure access to the GSM Systems Manufacturer Panel." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Please enter your email or mobile number.")
    .max(255, "This value is too long."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

function LoginPage() {
  const { session, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("aparna.rao@gsmsystems.io");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && session) navigate({ to: "/", replace: true });
  }, [ready, session, navigate]);

  const parsed = schema.safeParse({ identifier, password });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = schema.safeParse({ identifier, password });
    if (!result.success) {
      const fieldErrors: { identifier?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "identifier") fieldErrors.identifier = issue.message;
        if (key === "password") fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(identifier, password);
      navigate({ to: "/", replace: true });
    } catch (error) {
      setFormError(toUserMessage(error, "Unable to sign in right now. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between border-r border-border bg-sidebar p-12 lg:flex">
        <div className="grid-noise absolute inset-0 opacity-60" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
            <Radar className="size-4 text-primary" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">Manufacturer Panel</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">GSM Systems</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-4">
          <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
            Control layer for the BLE device ecosystem.
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage devices, device types, BLE profiles, device relationships, notifications and support for the GSM
            Systems mobile application. The backend REST API remains authoritative for all records.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Restricted to Manufacturer accounts
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground">Use your registered email or mobile number.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="identifier">Email or mobile number</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              aria-invalid={!!errors.identifier}
              className="bg-surface"
            />
            {errors.identifier && <p className="text-xs text-destructive">{errors.identifier}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              className="bg-surface"
            />
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

          <p className="text-center text-xs text-muted-foreground">
            Accounts that are Pending, Suspended or Disabled cannot access this panel.
          </p>
        </form>
      </div>
    </div>
  );
}
