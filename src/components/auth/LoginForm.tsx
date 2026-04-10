"use client";

import { FormEvent, useMemo, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductBadge, Surface } from "@/components/ledger/primitives";

export function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const errorParam = searchParams.get("error");

  const errorMessage =
    errorParam === "unauthorized"
      ? "This email is not allowed for this app."
      : errorParam === "invalid_link"
      ? "That sign-in link is invalid or expired."
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Please enter an email address.");
      return;
    }

    setIsSending(true);

    try {
      const redirectTo = `${window.location.origin}/auth/confirm`;
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsSent(true);
      toast.success("Check your email for the sign-in link.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Surface tone="dark" className="w-full max-w-md rounded-[1.75rem]">
      <div className="p-6">
        <ProductBadge icon={Mail} tone="dark">
          Private access
        </ProductBadge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
          Sign in with magic link
        </h1>
        <p className="mt-2 text-sm text-neutral-300">
          Only allowlisted email addresses can access this dashboard.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-neutral-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-11 border-white/20 bg-white/10 text-white placeholder:text-neutral-400"
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-white text-neutral-950 hover:bg-neutral-200"
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send magic link"
            )}
          </Button>
        </form>

        {isSent ? (
          <p className="mt-4 text-sm text-emerald-200">
            Link sent. Open it on this device to complete sign-in.
          </p>
        ) : null}
      </div>
    </Surface>
  );
}
