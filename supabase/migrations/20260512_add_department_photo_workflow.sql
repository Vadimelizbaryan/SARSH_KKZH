alter table public.sharsh_departments
  add column if not exists photo_workflow_status text not null default 'idle',
  add column if not exists photo_feedback_id bigint,
  add column if not exists photo_feedback_updated_at timestamptz,
  add column if not exists photo_name text;

create index if not exists sharsh_departments_photo_feedback_idx
  on public.sharsh_departments (photo_feedback_id);
