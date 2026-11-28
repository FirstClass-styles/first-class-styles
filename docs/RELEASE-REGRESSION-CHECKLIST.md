# First Class Styles Release Regression Checklist

Use this checklist against an isolated preview/staging database only. Do not create customer-like test records in production.

## Booking form and server validation
- [ ] Required name and phone fields reject empty values; phone accepts 10–15 digits after normalization.
- [ ] Invalid email and overly long fields are rejected.
- [ ] Unknown service is rejected.
- [ ] Invalid calendar date, unsupported start time, or closed weekday is rejected.
- [ ] Appointment less than 24 hours away is rejected.
- [ ] A start before 9 AM or service ending after 4 PM is rejected.
- [ ] A salon closure date is rejected; closure lookup failure returns a safe unavailable response.
- [ ] A booking request returns pending-deposit status and $25 deposit amount; it is not auto-confirmed.
- [ ] Customer and salon notification outcomes are reported as sent/partial failure without undoing the saved booking.

## Capacity and conflict protection
- [ ] Verify the configured rate limit: 5 booking submissions per 10 minutes per client key; excess requests return 429 and Retry-After.
- [ ] Four active bookings on a Maryland-local date are allowed; a fifth is rejected.
- [ ] Two overlapping active appointments cannot be inserted; conflict response says the time is unavailable.
- [ ] Cancelling/rejecting a pending booking releases its slot.
- [ ] Confirmed booking cancellation releases its slot.
- [ ] A no-show/manual cancellation can release a confirmed slot even when deposit was verified (owner workflow).
- [ ] Adjacent, non-overlapping appointments are allowed.

## Deposit and admin transitions
- [ ] Pending + pending deposit can be verified; status becomes confirmed.
- [ ] Pending + pending deposit can be rejected; status becomes cancelled.
- [ ] Repeated/stale deposit verification or rejection is blocked with conflict response.
- [ ] Cancel action only affects an active appointment.
- [ ] Test-record marking requires a cancelled record; mark it separately after cancellation, and only then may permanent deletion be enabled.
- [ ] Permanent deletion is restricted to cancelled records explicitly marked as test records.
- [ ] Admin login allows 10 attempts per 15 minutes per client key; excess returns 429 with Retry-After.
- [ ] Admin logout clears the session.
- [ ] Expired/invalid admin session cannot access appointment or closure APIs.
- [ ] Cross-origin admin writes are rejected.

## Closure calendar
- [ ] Admin can add a valid closure date and optional reason.
- [ ] Invalid date strings are rejected.
- [ ] Duplicate closure dates upsert rather than create duplicate rows.
- [ ] Admin can reopen a closure; missing closure returns 404.
- [ ] If closure dates cannot load, closure/reopen controls remain disabled and a visible warning appears.

## Rate-limit persistence and operations
- [ ] Rate limiter counts persist across separate requests/instances.
- [ ] RPC/database failure fails closed with 503 for protected endpoints.
- [ ] Keys are SHA-256 hashed; raw IP addresses are not stored.
- [ ] Confirm production deployment provides the trusted client-IP header before release.
- [ ] Plan periodic cleanup for expired rate-limit rows before sustained production traffic.

For a manual cleanup after confirming the migration is applied, run this in the Supabase SQL editor. It removes only rate-limit buckets whose window began more than one day ago; it does not touch appointments or closure dates:

```sql
DELETE FROM public.rate_limit_buckets
WHERE window_started_at < now() - interval '1 day';
```

Do not add a scheduled database job unless the project has a supported scheduler configured and the owner has approved it.

## Database enforcement verification (read-only SQL)
Run these read-only checks in the intended Supabase project before release. They do not create, update, or delete data.

### 1. Confirm active-overlap exclusion constraint
```sql
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname = 'appointments_no_active_time_overlap';
```
Expected: one exclusion constraint whose range uses half-open `[)` intervals and whose predicate applies to `pending_payment` and `confirmed`.

### 2. Confirm daily-cap trigger and function
```sql
select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.appointments'::regclass
  and not tgisinternal
  and tgname = 'appointments_salon_daily_limit';

select proname, pg_get_functiondef(oid) as definition
from pg_proc
where proname = 'enforce_salon_daily_appointment_limit';
```
Expected: the trigger fires before insert or updates to `starts_at` or `status`; function serializes same Maryland-local date reservations and rejects a fifth active record.

### 3. Confirm persistent rate-limit table and RPC
```sql
select to_regclass('public.rate_limit_buckets') as rate_limit_table,
       to_regprocedure('public.consume_rate_limit(text,integer,integer)') as rate_limit_rpc;
```
Expected: both identifiers are non-null. Separately confirm the intended migration was applied, and test RPC failure behavior only in isolated staging.

**Do not run concurrent-booking, insert, cancellation, or failure-injection tests against production.** Use isolated staging data only.

## Final release gate
- [ ] Migration applied to intended Supabase project and verified.
- [ ] Preview uses a safe isolated dataset; no live customer booking/email tests.
- [ ] Build and typecheck pass.
- [ ] End-to-end regression tests pass or gaps are documented.
- [ ] Review PR changes and deployment preview on mobile and desktop.
- [ ] Owner explicitly approves merge and production deployment.

## Reminder delivery reliability (known limitation; do not claim exactly-once delivery)
- [ ] Test owner reminder delivery independently from customer reminder delivery in isolated staging.
- [ ] Test successful SMTP delivery followed by a simulated database status-write failure.
- [ ] Test SMTP connection loss before DATA acceptance; delivery should be treated as failed only when rejection is definitive.
- [ ] Test timeout/disconnect after message DATA submission; treat outcome as ambiguous, not as confirmed failure.
- [ ] Ambiguous outcomes must not be automatically resent until reconciled; track an explicit uncertain state or equivalent operational review.
- [ ] Confirm a successful recipient timestamp is persisted before any subsequent scheduled retry can resend that recipient.
- [ ] Validate partial outcomes: owner delivered/customer failed, customer delivered/owner failed, both delivered, and both failed.

**Known limitation:** Gmail SMTP does not provide an application-level idempotency key for this custom send flow. The app cannot guarantee exactly-once email delivery. A timeout or status-write failure after SMTP acceptance can leave delivery uncertain. A safer implementation should record per-recipient delivery state (including an `uncertain` state) and avoid blind retry for uncertain sends, while offering an owner-visible reconciliation path. This is a design requirement, not a completed code change.
