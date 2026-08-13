-- Read models for the seven SONA registries.  The canonical data remains in
-- sona_records so a source document and its review history are never copied.

create or replace view public.sona_civil_hospitals as
  select * from public.sona_records where registry_type = 'civil_hospitals';

create or replace view public.sona_admitted_military as
  select * from public.sona_records where registry_type = 'admitted_military';

create or replace view public.sona_discharged_transferred as
  select * from public.sona_records where registry_type = 'discharged_transferred';

create or replace view public.sona_referrals_admissions as
  select * from public.sona_records where registry_type = 'referrals_admissions';

create or replace view public.sona_returned as
  select * from public.sona_records where registry_type = 'returned';

create or replace view public.sona_outpatient as
  select * from public.sona_records where registry_type = 'outpatient';

create or replace view public.sona_discharged_not_transferred as
  select * from public.sona_records where registry_type = 'discharged_not_transferred';

revoke all on public.sona_civil_hospitals from anon, authenticated;
revoke all on public.sona_admitted_military from anon, authenticated;
revoke all on public.sona_discharged_transferred from anon, authenticated;
revoke all on public.sona_referrals_admissions from anon, authenticated;
revoke all on public.sona_returned from anon, authenticated;
revoke all on public.sona_outpatient from anon, authenticated;
revoke all on public.sona_discharged_not_transferred from anon, authenticated;

grant select on public.sona_civil_hospitals to service_role;
grant select on public.sona_admitted_military to service_role;
grant select on public.sona_discharged_transferred to service_role;
grant select on public.sona_referrals_admissions to service_role;
grant select on public.sona_returned to service_role;
grant select on public.sona_outpatient to service_role;
grant select on public.sona_discharged_not_transferred to service_role;
