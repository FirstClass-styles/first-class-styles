-- First Class Styles: make appointment overlap prevention database-enforced.
-- Half-open ranges allow back-to-back appointments (end == next start).
-- Existing overlaps are checked first; if any exist, this migration stops safely
-- and reports that the records must be reviewed before enabling the constraint.

do $$
declare
  overlap_count bigint;
begin
  select count(*) into overlap_count
  from public.appointments a
  join public.appointments b
    on a.id < b.id
   and a.starts_at < b.ends_at
   and a.ends_at > b.starts_at
  where a.status in ('pending_payment', 'confirmed')
    and b.status in ('pending_payment', 'confirmed');

  if overlap_count > 0 then
    raise exception
      'Cannot enable appointment overlap protection: % overlapping active appointment pair(s) already exist. Review these records first.',
      overlap_count;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_no_active_time_overlap'
  ) then
    alter table public.appointments
      add constraint appointments_no_active_time_overlap
      exclude using gist (
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('pending_payment', 'confirmed'));
  end if;
end
$$;
