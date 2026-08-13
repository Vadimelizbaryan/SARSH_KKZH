create or replace view public.sona_registry_summary as
  select
    registry_type,
    review_status,
    count(*)::integer as record_count,
    max(updated_at) as latest_record_at
  from public.sona_records
  group by registry_type, review_status;

revoke all on public.sona_registry_summary from anon, authenticated;
grant select on public.sona_registry_summary to service_role;
