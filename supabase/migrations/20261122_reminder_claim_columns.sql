-- Ensure the reminder claim and completion columns are provisioned through the migration history.
-- Idempotent: safe if the standalone reminder SQL was already applied.
alter table public.appointments
  add column if not exists reminder_claimed_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists appointments_due_reminders_idx
  on public.appointments (starts_at)
  where status = 'confirmed'
    and deposit_status = 'verified'
    and reminder_sent_at is null;
