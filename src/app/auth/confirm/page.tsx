"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [debugStep, setDebugStep] = useState("Parsing callback URL");

  const debugShape =
    typeof window === "undefined"
      ? "pending"
      : (() => {
          const url = new URL(window.location.href);
          const code = url.searchParams.get("code");
          const tokenHash = url.searchParams.get("token_hash") || url.searchParams.get("token");
          const type = url.searchParams.get("type");
          const hashParams = new URLSearchParams(
            window.location.hash.startsWith("#")
              ? window.location.hash.slice(1)
              : window.location.hash
          );
          const hashAccessToken = hashParams.get("access_token");

          if (code) return "query: code";
          if (tokenHash && type) return "query: token_hash+type";
          if (hashAccessToken) return "hash: access_token";
          return "missing params";
        })();

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const nextPath = safeNextPath(url.searchParams.get("next"));
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash") || url.searchParams.get("token");
    const type = url.searchParams.get("type") as EmailOtpType | null;

    const redirectInvalid = () => router.replace("/login?error=invalid_link");
    const redirectOk = () => router.replace(nextPath);

    const completeAuth = async () => {
      if (code) {
        setDebugStep("Exchanging code for session");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return redirectInvalid();
        return redirectOk();
      }

      if (tokenHash && type) {
        setDebugStep("Verifying OTP token");
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (error) return redirectInvalid();
        return redirectOk();
      }

      // Some templates/providers return auth tokens in URL hash.
      // Give the client SDK a short window to absorb the session.
      setDebugStep("Waiting for hash/session callback");
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) return redirectOk();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      return redirectInvalid();
    };

    void completeAuth();
  }, [router]);

  return (
    <main className="ledger-grid flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-white/20 bg-black/85 px-5 py-4 text-sm text-neutral-200">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finalizing sign-in...
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-neutral-300">
          <div suppressHydrationWarning>Callback shape: {debugShape}</div>
          <div className="mt-1">Step: {debugStep}</div>
        </div>
      </div>
    </main>
  );
}
