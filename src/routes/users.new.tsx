import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userService } from "@/services";
import { toUserMessage } from "@/services/client";

export const Route = createFileRoute("/users/new")({
  head: () => ({
    meta: [
      { title: "Create Installer | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Create an active installer account for mobile field access.",
      },
      { property: "og:title", content: "Create Installer | Manufacturer Panel" },
      {
        property: "og:description",
        content: "Create an installer account in the Manufacturer Panel.",
      },
    ],
  }),
  component: CreateInstallerPage,
});

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  mobileNumber: z.string().trim().min(6, "Mobile number is required.").max(32),
  password: z.string().min(8, "Password must be at least 8 characters."),
  companyName: z.string().trim().max(120).optional(),
});

function CreateInstallerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobileNumber: "",
    password: "",
    companyName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      userService.createInstaller({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        password: form.password,
        companyName: form.companyName.trim() || undefined,
      }),
    onSuccess: (user) => {
      toast.success("Installer account created and activated.");
      void navigate({ to: "/users/$userId", params: { userId: user.id } });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to create installer. Please try again.")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate();
  };

  const field = (key: keyof typeof form, label: string, type = "text", hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        disabled={create.isPending}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        title="Create Installer"
        breadcrumbs={[
          { label: "Manufacturer Panel", to: "/" },
          { label: "App Users", to: "/users" },
          { label: "Create Installer" },
        ]}
      />

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-xl space-y-6 rounded-lg border border-border bg-surface p-6 shadow-none"
      >
        <p className="text-sm text-muted-foreground">
          Creates an active installer account with mobile login enabled. Grant device access on
          Relationships after creation.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("firstName", "First name")}
          {field("lastName", "Last name")}
        </div>
        {field("email", "Email", "email")}
        {field("mobileNumber", "Mobile number", "tel")}
        {field("companyName", "Company (optional)")}
        {field(
          "password",
          "Temporary password",
          "password",
          "Share this with the installer for their first mobile login.",
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/users" })} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create installer"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
