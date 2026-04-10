import { LoginForm } from "@/components/auth/LoginForm";
import { isAllowlistConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const allowlistReady = isAllowlistConfigured();

  return (
    <main className="ledger-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        {!allowlistReady ? (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Set `OWNER_EMAIL` or `ALLOWED_EMAILS` in your environment before
            signing in.
          </div>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
