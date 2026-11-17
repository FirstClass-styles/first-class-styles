-- Allow every currently advertised First Class Styles service in appointments.
-- Run once in Supabase SQL Editor. Existing appointment rows are preserved.
alter table public.appointments
  drop constraint if exists appointments_service_check;

alter table public.appointments
  add constraint appointments_service_check
  check (service in (
    'Closure Sew-In',
    'Loc Journey',
    'Loc Refresh',
    'Quick Weave',
    'Signature Sew-In with Leave Out',
    'Signature Shampoo & Blow Dry',
    'Signature Silk Press'
  ));
