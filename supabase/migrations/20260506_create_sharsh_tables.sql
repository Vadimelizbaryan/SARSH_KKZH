create table if not exists public.sharsh_departments (
  department_id text primary key,
  department_name text not null,
  department_group text not null,
  values jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sharsh_report_meta (
  report_key text primary key,
  report_date text not null default '05,05,26',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.sharsh_departments enable row level security;
alter table public.sharsh_report_meta enable row level security;

revoke all on table public.sharsh_departments from anon, authenticated;
revoke all on table public.sharsh_report_meta from anon, authenticated;

grant all privileges on table public.sharsh_departments to service_role;
grant all privileges on table public.sharsh_report_meta to service_role;

insert into public.sharsh_report_meta (report_key, report_date)
values ('main', '05,05,26')
on conflict (report_key) do nothing;
