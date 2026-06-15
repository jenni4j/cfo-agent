# CFO Agent

An AI-powered financial intelligence assistant that lets companies chat with their own financial documents. Upload PDFs to a private data room, then ask questions about the documents.

## Demo

[CFO Agent Demo](https://www.loom.com/share/35ef1bb71ff540d9ba6c8722271cb16d)

## Features

- **Document data room**: upload PDF financial documents (10-Qs, income statements, board decks, etc.)
- **RAG-powered chat**: questions are answered using full-text search over your uploaded documents, so the agent cites real numbers from real files
- **Scoped to finance**: the agent refuses off-topic questions and stays focused on financials, accounting, cash flow, fundraising, and related topics
- **Per-user isolation**: each account's documents and conversations are fully private via Supabase row-level security
- **Streaming responses**: answers stream token-by-token powered by Claude

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI | Claude (`claude-opus-4-8`) via Anthropic SDK |
| Database + Auth | Supabase (Postgres + RLS + Storage) |
| RAG | PostgreSQL full-text search over chunked PDF text |
| PDF extraction | pdf-parse v2 + pdfjs-dist |
| Styling | Tailwind CSS v4 |
| Deployment | Vercel (Node 22.x) |

## How It Works

1. **Upload**: PDFs are uploaded to Supabase Storage. Text is extracted server-side with pdf-parse, split into overlapping 600-word chunks, and stored in a `document_chunks` table with a generated `tsvector` column.
2. **Query**: when you send a chat message, the last user message is tokenized and run as a full-text search against your chunks. The top 5 matching excerpts are injected into the system prompt.
3. **Answer**: Claude sees both the system instructions and the retrieved excerpts, then streams a response grounded in your actual documents.

## Project Structure

```
src/
  app/
    api/
      chat/       # streaming chat endpoint
      documents/  # upload + list + delete PDFs
    auth/         # Supabase auth callbacks
    dataroom/     # document management UI
    portal/       # chat interface
  lib/
    rag.ts        # PDF extraction, chunking, retrieval
    supabase/     # server + client Supabase helpers
supabase/
  migrations/     # Postgres schema + RLS + storage policies
```
