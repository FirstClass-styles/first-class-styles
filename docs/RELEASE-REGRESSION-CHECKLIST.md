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
- [ ] Test-record marking requires a cancelled record.
- [ ] Test-record cancellation is blocked for already-cancelled records.
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

## Final release gate
- [ ] Migration applied to intended Supabase project and verified.
- [ ] Preview uses a safe isolated dataset; no live customer booking/email tests.
- [ ] Build and typecheck pass.
- [ ] End-to-end regression tests pass or gaps are documented.
- [ ] Review PR changes and deployment preview on mobile and desktop.
- [ ] Owner explicitly approves merge and production deployment.
