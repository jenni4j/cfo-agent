import { SupabaseClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 80;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.trim().length > 20) chunks.push(chunk.trim());
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

export async function storeChunks(
  supabase: SupabaseClient,
  documentId: string,
  companyId: string,
  chunks: string[]
): Promise<void> {
  const rows = chunks.map((content, chunk_index) => ({
    document_id: documentId,
    company_id: companyId,
    content,
    chunk_index,
  }));

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw new Error(`Failed to store chunks: ${error.message}`);
}

export async function retrieveContext(
  supabase: SupabaseClient,
  companyId: string,
  query: string,
  topK = 5
): Promise<string> {
  // Sanitize query for tsquery: alphanumeric tokens joined with OR
  const tokens = query
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => t + ":*")
    .join(" | ");

  if (!tokens) return "";

  const { data, error } = await supabase
    .from("document_chunks")
    .select("content")
    .eq("company_id", companyId)
    .textSearch("search_vector", tokens, { type: "plain" })
    .limit(topK);

  if (error || !data?.length) return "";

  return data.map((row, i) => `[Excerpt ${i + 1}]\n${row.content}`).join("\n\n");
}
