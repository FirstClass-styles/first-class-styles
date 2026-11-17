-- First Class Styles: owner-managed salon closure dates
-- Run this once in Supabase SQL Editor before using the dashboard closure controls.
create table if not exists public.salon_closed_dates (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.salon_closed_dates enable row level security;
revoke all on public.salon_closed_dates from anon, authenticated;
grant all on public.salon_closed_dates to service_role;
