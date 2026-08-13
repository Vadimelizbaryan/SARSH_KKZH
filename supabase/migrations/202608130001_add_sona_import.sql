-- Private SONA archive.  All writes are made only by the owner-authorized
-- Edge Function using the service role; no patient document is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sona-source',
  'sona-source',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/rtf',
    'text/rtf',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.sona_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  source_folder text not null default '',
  source_date text,
  status text not null default 'draft'
    check (status in ('draft', 'uploading', 'ready', 'processing', 'completed', 'completed_with_review', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sona_documents (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null unique,
  canonical_storage_path text not null,
  original_name text not null,
  extension text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null check (byte_size >= 0),
  extracted_text text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'extracted', 'unsupported', 'failed')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'processed', 'needs_review', 'failed', 'not_required')),
  processing_error text,
  processed_with_model text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sona_batch_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sona_import_batches(id) on delete cascade,
  document_id uuid references public.sona_documents(id) on delete set null,
  source_path text not null,
  storage_path text not null unique,
  original_name text not null,
  extension text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null check (byte_size >= 0),
  upload_status text not null default 'registered'
    check (upload_status in ('registered', 'processing', 'processed', 'unsupported', 'failed')),
  processing_error text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, source_path)
);

create table if not exists public.sona_records (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sona_documents(id) on delete cascade,
  record_index integer not null check (record_index >= 0),
  registry_type text not null
    check (registry_type in (
      'civil_hospitals',
      'admitted_military',
      'discharged_transferred',
      'referrals_admissions',
      'returned',
      'outpatient',
      'discharged_not_transferred',
      'archive_only',
      'unclassified'
    )),
  patient_name text,
  military_unit text,
  rank text,
  birth_year integer check (birth_year is null or birth_year between 1900 and 2100),
  draft_year integer check (draft_year is null or draft_year between 1900 and 2100),
  medical_center text,
  department_name text,
  diagnosis text,
  event_date text,
  admission_date text,
  discharge_date text,
  referral_date text,
  transfer_destination text,
  notes text,
  source_row integer,
  source_text text,
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  details jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_id, record_index)
);

create index if not exists sona_batch_files_batch_id_idx on public.sona_batch_files(batch_id, uploaded_at desc);
create index if not exists sona_batch_files_document_id_idx on public.sona_batch_files(document_id);
create index if not exists sona_records_document_id_idx on public.sona_records(document_id);
create index if not exists sona_records_registry_review_idx on public.sona_records(registry_type, review_status, created_at desc);

alter table public.sona_import_batches enable row level security;
alter table public.sona_documents enable row level security;
alter table public.sona_batch_files enable row level security;
alter table public.sona_records enable row level security;

revoke all on table public.sona_import_batches from anon, authenticated;
revoke all on table public.sona_documents from anon, authenticated;
revoke all on table public.sona_batch_files from anon, authenticated;
revoke all on table public.sona_records from anon, authenticated;

grant all privileges on table public.sona_import_batches to service_role;
grant all privileges on table public.sona_documents to service_role;
grant all privileges on table public.sona_batch_files to service_role;
grant all privileges on table public.sona_records to service_role;
