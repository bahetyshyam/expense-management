import { createClient } from "@/utils/supabase/server";
import { requireApiUser } from "@/lib/auth/server";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { response } = await requireApiUser(supabase);
    if (response) return response;

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select(
        `
        *,
        card_holders (*)
      `
      )
      .order("institution")
      .order("name");

    if (error) {
      return Response.json(
        { error: `Failed to fetch accounts: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ accounts }, { status: 200 });
  } catch (error) {
    console.error("Accounts GET error:", error);
    return Response.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

interface AccountPatchBody {
  id?: string;
  display_name?: string;
  institution?: string;
  account_type?: string;
  is_hidden?: boolean;
  notes?: string | null;
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { response } = await requireApiUser(supabase);
    if (response) return response;

    const body = (await request.json()) as AccountPatchBody;

    if (!body.id) {
      return Response.json({ error: "Missing account id" }, { status: 400 });
    }

    const updates: Omit<AccountPatchBody, "id"> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.institution !== undefined) updates.institution = body.institution;
    if (body.account_type !== undefined) updates.account_type = body.account_type;
    if (body.is_hidden !== undefined) updates.is_hidden = body.is_hidden;
    if (body.notes !== undefined) updates.notes = body.notes;

    const { data: account, error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: `Failed to update account: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ account }, { status: 200 });
  } catch (error) {
    console.error("Accounts PATCH error:", error);
    return Response.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response } = await requireApiUser(supabase);
    if (response || !user) return response;

    const body = await request.json();
    const { name, institution, account_type, last_four } = body;

    if (!name || !institution || !account_type) {
      return Response.json(
        {
          error:
            "Missing required fields: name, institution, account_type",
        },
        { status: 400 }
      );
    }

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name,
        institution,
        account_type,
        last_four: last_four || null,
      })
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: `Failed to create account: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Accounts POST error:", error);
    return Response.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
