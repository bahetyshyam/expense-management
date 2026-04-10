import { createClient } from "@/utils/supabase/server";
import { requireApiUser } from "@/lib/auth/server";
import { ingestQfxFile } from "@/lib/services/ingestion";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { response } = await requireApiUser(supabase);
    if (response) return response;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file content
    const fileContent = await file.text();

    // Validate file is a QFX/OFX file
    if (
      !fileContent.includes("<OFX>") &&
      !fileContent.includes("OFXHEADER")
    ) {
      return Response.json(
        {
          error:
            "Invalid file format. Expected QFX/OFX file. " +
            "Make sure you're uploading a .qfx or .ofx file from your bank.",
        },
        { status: 400 }
      );
    }

    // Ingest the file (account matching happens inside automatically)
    const result = await ingestQfxFile(
      supabase,
      file.name,
      fileContent
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
