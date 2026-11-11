-- Run this once in the Supabase SQL Editor for the First Class Styles project.
-- These fields allow the reminder job to claim appointments and prevent duplicates.
alter table public.appointments
  add column if not exists reminder_claimed_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists appointments_due_reminders_idx
  on public.appointments (starts_at)
  where status = 'confirmed'
    and deposit_status = 'verified'
    and reminder_sent_at is null;
