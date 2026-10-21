import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userService } from "@/services";
import { ApiError, toUserMessage } from "@/services/client";
import type { AppUser } from "@/types/entities";

type Channel = "email" | "mobile";
type Step = { kind: "form" } | { kind: "verify"; channel: Channel; sentTo: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

/**
 * Edit a user (Johan, 19 Oct). Name and company are saved directly. A new
 * email or mobile number is only saved after the code sent to that NEW email
 * (email OTP) or number (SMS OTP) is entered; until then the old one stays.
 */
export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AppUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.FirstName);
  const [lastName, setLastName] = useState(user.LastName);
  const [companyName, setCompanyName] = useState(user.CompanyName);
  const [email, setEmail] = useState(user.Email);
  const [mobile, setMobile] = useState(user.MobileNumber);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  /** Contact changes still waiting for their code, in order. */
  const [queue, setQueue] = useState<Channel[]>([]);

  useEffect(() => {
    if (!open) return;
    setFirstName(user.FirstName);
    setLastName(user.LastName);
    setCompanyName(user.CompanyName);
    setEmail(user.Email);
    setMobile(user.MobileNumber);
    setErrors({});
    setStep({ kind: "form" });
    setCode("");
    setError(null);
    setQueue([]);
    // Reset only when the dialog opens: saving refreshes `user` mid-flow and
    // must not wipe the code step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const newValue = (channel: Channel) =>
    channel === "email" ? email.trim().toLowerCase() : mobile.trim();

  const sendCode = async (channel: Channel) => {
    await userService.requestContactChange(user.id, channel, newValue(channel));
    setStep({ kind: "verify", channel, sentTo: newValue(channel) });
    setCode("");
    setResendIn(RESEND_SECONDS);
  };

  /** Moves to the next pending contact change, or finishes. */
  const continueWith = async (pending: Channel[], latest: AppUser | null) => {
    const [next, ...rest] = pending;
    setQueue(rest);
    if (next) {
      await sendCode(next);
      return;
    }
    if (latest) onSaved(latest);
    toast.success("User details saved successfully.");
    onOpenChange(false);
  };

  const handleSave = async () => {
    const found: Record<string, string> = {};
    if (!firstName.trim()) found["firstName"] = "First name is required.";
    if (!lastName.trim()) found["lastName"] = "Last name is required.";
    if (!EMAIL_PATTERN.test(email.trim())) found["email"] = "Enter a valid email address.";
    if (!mobile.trim()) found["mobile"] = "Mobile number is required.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      let latest: AppUser | null = null;
      const profileChanged =
        firstName.trim() !== user.FirstName ||
        lastName.trim() !== user.LastName ||
        companyName.trim() !== user.CompanyName;
      if (profileChanged) {
        latest = await userService.updateProfile(user.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim(),
        });
      }
      const pending: Channel[] = [];
      if (newValue("email") !== user.Email.trim().toLowerCase()) pending.push("email");
      if (newValue("mobile") !== user.MobileNumber.trim()) pending.push("mobile");
      if (latest && pending.length > 0) onSaved(latest);
      await continueWith(pending, latest);
    } catch (e) {
      setError(toUserMessage(e, "Unable to save the user details. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (step.kind !== "verify") return;
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError("Enter the code that was sent.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await userService.confirmContactChange(user.id, step.channel, code.trim());
      onSaved(updated);
      toast.success(
        step.channel === "email"
          ? "Email changed and verified."
          : "Mobile number changed and verified.",
      );
      await continueWith(queue, updated);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? e.message
          : toUserMessage(e, "Unable to confirm the code. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (step.kind !== "verify") return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(step.channel);
      toast.success("A new code was sent.");
    } catch (e) {
      setError(toUserMessage(e, "Unable to send a new code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { type?: string; hint?: string; maxLength?: number } = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={options.type ?? "text"}
        className="bg-background"
        value={value}
        maxLength={options.maxLength}
        aria-invalid={!!errors[id]}
        onChange={(e) => {
          onChange(e.target.value);
          setError(null);
          setErrors((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }}
      />
      {errors[id] && <p className="text-xs text-destructive">{errors[id]}</p>}
      {options.hint && !errors[id] && (
        <p className="text-xs text-muted-foreground">{options.hint}</p>
      )}
    </div>
  );

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={
        step.kind === "form"
          ? "Edit user"
          : step.channel === "email"
            ? "Confirm new email"
            : "Confirm new mobile number"
      }
      description={
        step.kind === "form"
          ? "Name and company are saved directly. A new email or mobile number is saved only after it is confirmed with a code."
          : `A ${step.channel === "email" ? "verification code was emailed" : "verification code was sent by SMS"} to ${step.sentTo}. Enter it to save the change. Until then the current ${step.channel === "email" ? "email" : "mobile number"} stays.`
      }
    >
      {step.kind === "form" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("firstName", "First name", firstName, setFirstName, { maxLength: 100 })}
            {field("lastName", "Last name", lastName, setLastName, { maxLength: 100 })}
          </div>
          {field("companyName", "Company", companyName, setCompanyName, { maxLength: 150 })}
          {field("email", "Email", email, setEmail, {
            type: "email",
            maxLength: 150,
            hint: "Changing it sends a code to the new email.",
          })}
          {field("mobile", "Mobile number", mobile, setMobile, {
            type: "tel",
            maxLength: 30,
            hint: "Changing it sends an SMS code to the new number.",
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="otp-code">Verification code</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="bg-background font-mono tracking-[0.3em]"
            maxLength={8}
            value={code}
            autoFocus
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            disabled={busy || resendIn > 0}
            onClick={() => void handleResend()}
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
          {step.kind === "form" ? "Cancel" : "Cancel change"}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void (step.kind === "form" ? handleSave() : handleConfirm())}
        >
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {step.kind === "form" ? "Save" : "Confirm"}
        </Button>
      </div>
    </FormModal>
  );
}
