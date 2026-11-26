-- Persistent throttling for public booking submissions and admin login.
-- Rate-limit keys are SHA-256 hashes; raw IP addresses are not stored.
create table if not exists public.rate_limit_buckets (
  rate_limit_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

-- Enable row-level security in addition to the explicit privilege restrictions.
alter table public.rate_limit_buckets enable row level security;

revoke all on public.rate_limit_buckets from anon, authenticated, public;
grant all on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public
as $$
declare
  current_start timestamptz;
  current_count integer;
  now_at timestamptz := clock_timestamp();
begin
  if p_key is null or length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.rate_limit_buckets (rate_limit_key, window_started_at, request_count)
  values (p_key, now_at, 1)
  on conflict (rate_limit_key) do update
    set window_started_at = case
          when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now_at
          then now_at else public.rate_limit_buckets.window_started_at end,
        request_count = case
          when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now_at
          then 1 else public.rate_limit_buckets.request_count + 1 end
  returning window_started_at, request_count into current_start, current_count;

  return query select
    (current_count <= p_limit),
    greatest(0, ceil(extract(epoch from (current_start + make_interval(secs => p_window_seconds) - now_at)))::integer);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
