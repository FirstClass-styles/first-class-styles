-- First Class Styles: allow an administrator to mark an unpaid deposit as not received.
-- This migration supports either a PostgreSQL enum or a text/varchar column.
-- It does not modify existing appointment rows.

do $$
declare
  column_type_kind "char";
  column_type_name text;
  column_type_schema text;
  constraint_name text;
begin
  select t.typtype, t.typname, n.nspname
    into column_type_kind, column_type_name, column_type_schema
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'appointments'
    and a.attname = 'deposit_status'
    and not a.attisdropped;

  if column_type_name is null then
    raise exception 'public.appointments.deposit_status column was not found';
  end if;

  if column_type_kind = 'e' then
    execute format(
      'alter type %I.%I add value if not exists %L',
      column_type_schema, column_type_name, 'rejected'
    );
  else
    for constraint_name in
      select con.conname
      from pg_constraint con
      where con.conrelid = 'public.appointments'::regclass
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%deposit_status%'
    loop
      execute format('alter table public.appointments drop constraint %I', constraint_name);
    end loop;

    alter table public.appointments
      add constraint appointments_deposit_status_check
      check (deposit_status in ('pending', 'verified', 'refunded', 'rejected'));
  end if;
end
$$;
