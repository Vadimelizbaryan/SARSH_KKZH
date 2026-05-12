create table if not exists public.sharsh_ocr_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  department_id text not null,
  department_name text not null,
  report_date text not null,
  photo_report_date text,
  save_status text not null check (save_status in ('accepted_as_is', 'corrected_by_operator')),
  image_name text,
  image_data_url text,
  recognized_keys text[] not null default '{}'::text[],
  changed_keys text[] not null default '{}'::text[],
  ocr_raw jsonb not null default '{}'::jsonb,
  final_values jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  cell_reviews jsonb not null default '[]'::jsonb
);

create index if not exists sharsh_ocr_feedback_created_at_idx
  on public.sharsh_ocr_feedback (created_at desc);

create index if not exists sharsh_ocr_feedback_department_id_idx
  on public.sharsh_ocr_feedback (department_id);

create index if not exists sharsh_ocr_feedback_save_status_idx
  on public.sharsh_ocr_feedback (save_status);

alter table public.sharsh_ocr_feedback enable row level security;

revoke all on table public.sharsh_ocr_feedback from anon, authenticated;

grant all privileges on table public.sharsh_ocr_feedback to service_role;
grant usage, select on sequence public.sharsh_ocr_feedback_id_seq to service_role;
