import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText, chunkText, storeChunks } from "@/lib/rag";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, name, file_size, created_at")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File size must be under 20 MB" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, buffer, { contentType: "application/pdf" });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Insert document record
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      company_id: user.id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    // Clean up orphaned storage object
    await supabase.storage.from("documents").remove([filePath]);
    return NextResponse.json({ error: `Database insert failed: ${insertError?.message}` }, { status: 500 });
  }

  // Extract text and store chunks for RAG
  try {
    const text = await extractPdfText(buffer);
    const chunks = chunkText(text);
    if (chunks.length > 0) {
      await storeChunks(supabase, doc.id, user.id, chunks);
    }
  } catch (ragError) {
    // Non-fatal: document is uploaded, just won't be searchable
    console.error("RAG processing failed:", ragError);
  }

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
