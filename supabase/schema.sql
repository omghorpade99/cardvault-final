-- CardVault schema for anonymous per-browser user collections.
-- Run this in Supabase SQL Editor. Enable Anonymous Sign-Ins under Authentication settings.
create extension if not exists pgcrypto;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade an existing CardVault table created by the earlier shared-workspace version.
-- Old notes with NULL user_id are intentionally not shown to anonymous users. Export/back up any old data before migration if it matters.
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade;

create table if not exists public.note_images (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  storage_path text not null unique,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists note_images_note_id_idx on public.note_images(note_id);
create index if not exists notes_user_updated_idx on public.notes(user_id, updated_at desc);

alter table public.notes enable row level security;
alter table public.note_images enable row level security;
-- No direct table policies: browser talks to the Express API; server validates the Supabase JWT
-- and scopes every query by the authenticated user ID. The service key stays server-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-card-images', 'business-card-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
