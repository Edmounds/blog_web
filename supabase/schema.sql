create extension if not exists "pgcrypto";

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null,
  author_name text not null,
  content text not null,
  status text not null default 'approved',
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post_slug_created_at
  on public.comments (post_slug, created_at desc);

create index if not exists idx_comments_status
  on public.comments (status);
