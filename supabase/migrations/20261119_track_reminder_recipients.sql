-- Track each appointment reminder recipient independently.
-- This allows retries to skip an email recipient whose delivery was already recorded.
alter table public.appointments
  add column if not exists owner_reminder_sent_at timestamptz,
  add column if not exists customer_reminder_sent_at timestamptz;
