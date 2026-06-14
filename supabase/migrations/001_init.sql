-- Enable necessary extensions
create extension if not exists "pg_trgm";

-- Documents table: one row per uploaded file
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  file_path text not null,
  file_size bigint,
  created_at timestamptz default now() not null
);

alter table documents enable row level security;

create policy "Users access own documents"
  on documents for all
  using (auth.uid() = company_id);

-- Document chunks table: text chunks from each document for RAG
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  company_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  chunk_index integer not null,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored
);

alter table document_chunks enable row level security;

create policy "Users access own chunks"
  on document_chunks for all
  using (auth.uid() = company_id);

create index if not exists document_chunks_search_idx
  on document_chunks using gin(search_vector);

create index if not exists document_chunks_document_id_idx
  on document_chunks(document_id);
