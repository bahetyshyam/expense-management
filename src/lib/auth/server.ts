import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth/config";

interface AuthenticatedResult {
  user: User | null;
  error: string | null;
  status: number;
}

export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthenticatedResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: "Authentication required",
      status: 401,
    };
  }

  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return {
      user: null,
      error: "This account is not authorized to access this application.",
      status: 403,
    };
  }

  return { user, error: null, status: 200 };
}

export async function requireApiUser(supabase: SupabaseClient) {
  const result = await getAuthenticatedUser(supabase);
  if (result.user) {
    return { user: result.user, response: null };
  }

  return {
    user: null,
    response: Response.json({ error: result.error }, { status: result.status }),
  };
}

export async function requirePageUser(supabase: SupabaseClient) {
  const result = await getAuthenticatedUser(supabase);
  if (result.user) return result.user;
  redirect("/login");
}
