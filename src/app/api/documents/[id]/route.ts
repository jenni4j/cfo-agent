import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the document to get the storage path (and verify ownership via RLS)
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", id)
    .eq("company_id", user.id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete chunks first (FK constraint)
  await supabase.from("document_chunks").delete().eq("document_id", id);

  // Delete document record
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("company_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Remove from storage (best-effort)
  await supabase.storage.from("documents").remove([doc.file_path]);

  return new NextResponse(null, { status: 204 });
}
