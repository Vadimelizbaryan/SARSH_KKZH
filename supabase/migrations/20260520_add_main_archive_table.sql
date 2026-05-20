create table if not exists public.sharsh_main_archives (
  archive_key text primary key,
  archive_label text not null,
  captured_at timestamptz not null default timezone('utc', now()),
  report_date text not null,
  source text not null default 'remote',
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.sharsh_main_archives enable row level security;

revoke all on table public.sharsh_main_archives from anon, authenticated;

grant all privileges on table public.sharsh_main_archives to service_role;
