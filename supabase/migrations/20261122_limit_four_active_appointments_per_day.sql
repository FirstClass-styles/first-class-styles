-- First Class Styles: enforce a maximum of four active appointments per Maryland salon day.
-- Pending deposit requests count as reserved appointments; cancelled appointments do not.
create or replace function public.enforce_salon_daily_appointment_limit()
returns trigger
language plpgsql
as $$
declare
  salon_day date;
  active_count integer;
begin
  if new.status not in ('pending_payment', 'confirmed') then
    return new;
  end if;

  salon_day := (new.starts_at at time zone 'America/New_York')::date;

  -- Serialize concurrent reservations for the same local salon day.
  perform pg_advisory_xact_lock(hashtext('first_class_styles_daily_limit'), hashtext(salon_day::text));

  select count(*) into active_count
  from public.appointments a
  where a.status in ('pending_payment', 'confirmed')
    and (a.starts_at at time zone 'America/New_York')::date = salon_day
    and (tg_op = 'INSERT' or a.id <> new.id);

  if active_count >= 4 then
    raise exception using
      errcode = '23514',
      message = 'salon_daily_booking_limit',
      detail = 'The salon already has four active appointments for this local date.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_salon_daily_limit on public.appointments;
create trigger appointments_salon_daily_limit
before insert or update of starts_at, status on public.appointments
for each row execute function public.enforce_salon_daily_appointment_limit();
