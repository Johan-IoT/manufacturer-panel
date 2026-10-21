import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userService } from "@/services";
import { ApiError, toUserMessage } from "@/services/client";
import type { AppUser } from "@/types/entities";

type Channel = "email" | "mobile";

const RESEND_SECONDS = 60;

/**
 * Confirms a not yet verified user's email and mobile number with the codes
 * sent to them (email OTP and SMS OTP, same codes as the app sign-up).
 */
export function VerifyContacts({
  user,
  onVerified,
  initialCooldown = false,
}: {
  user: AppUser;
  onVerified: (user: AppUser) => void;
  /** True right after the codes were sent (resend waits the cooldown). */
  initialCooldown?: boolean | undefined;
}) {
  return (
    <div className="space-y-4">
      <ContactCodeRow
        channel="email"
        label="Email"
        target={user.Email}
        verified={user.EmailVerified}
        userId={user.id}
        onVerified={onVerified}
        initialCooldown={!!initialCooldown}
      />
      <ContactCodeRow
        channel="mobile"
        label="Mobile number"
        target={user.MobileNumber}
        verified={user.MobileVerified}
        userId={user.id}
        onVerified={onVerified}
        initialCooldown={!!initialCooldown}
      />
    </div>
  );
}

function ContactCodeRow({
  channel,
  label,
  target,
  verified,
  userId,
  onVerified,
  initialCooldown,
}: {
  channel: Channel;
  label: string;
  target: string;
  verified: boolean;
  userId: string;
  onVerified: (user: AppUser) => void;
  initialCooldown: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(initialCooldown ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  if (verified) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm">{target}</p>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" /> Verified
        </span>
      </div>
    );
  }

  const confirm = async () => {
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError("Enter the code that was sent.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await userService.verifyContact(userId, channel, code.trim());
      toast.success(`${label} verified.`);
      setCode("");
      onVerified(updated);
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

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      await userService.resendVerificationCode(userId, channel);
      setResendIn(RESEND_SECONDS);
      toast.success(`A new code was sent to ${target}.`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? e.message
          : toUserMessage(e, "Unable to send a new code. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const inputId = `verify-${channel}-code`;
  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {label}: code sent {channel === "email" ? "by email" : "by SMS"} to{" "}
        <span className="text-foreground">{target}</span>
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-9 w-40 bg-background font-mono tracking-[0.3em]"
          maxLength={8}
          value={code}
          disabled={busy}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
        <Button type="button" size="sm" disabled={busy} onClick={() => void confirm()}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Confirm
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-1"
          disabled={busy || resendIn > 0}
          onClick={() => void resend()}
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
