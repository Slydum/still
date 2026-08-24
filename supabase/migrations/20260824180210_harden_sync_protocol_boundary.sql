-- Phase 2 hardening: enforce Still sync invariants at the database boundary.
--
-- Keep the public RPC SECURITY INVOKER so RLS remains authoritative, but reduce
-- the authenticated API role to the exact table/column privileges the protocol
-- needs. Direct writes remain possible only when they are protocol-equivalent:
-- the logical version must advance, server_revision stays server-managed, and
-- physical deletes are forbidden in favor of tombstones.

alter table public.still_records
  drop constraint if exists still_records_record_type_check,
  drop constraint if exists still_records_sync_counter_check,
  drop constraint if exists still_records_mutation_id_check,
  drop constraint if exists still_records_server_revision_check;

alter table public.still_records
  add constraint still_records_record_type_check check (
    record_type in (
      'task',
      'event',
      'journal_entry',
      'expense',
      'entity_link',
      'work_shift',
      'check_in',
      'settings',
      'work_settings',
      'money_settings',
      'health_settings'
    )
  ),
  add constraint still_records_sync_counter_check check (sync_counter > 0),
  add constraint still_records_mutation_id_check check (char_length(mutation_id) between 1 and 200),
  add constraint still_records_server_revision_check check (server_revision > 0);

create or replace function public.enforce_still_record_version_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.record_type is distinct from old.record_type
     or new.record_id is distinct from old.record_id then
    raise exception 'Still record identity fields cannot be changed.' using errcode = '22023';
  end if;

  if (new.sync_counter, new.mutation_id) > (old.sync_counter, old.mutation_id)
     or (
       new.sync_counter = old.sync_counter
       and new.mutation_id = old.mutation_id
       and new.deleted_at is not null
       and old.deleted_at is null
     ) then
    new.server_revision := nextval('public.still_sync_server_revision_seq');
    new.created_at := old.created_at;
    new.modified_at := now();
    return new;
  end if;

  raise exception 'Still record updates must advance (sync_counter, mutation_id), except deletion may win an exact-version tie.' using errcode = '22023';
end;
$$;

drop trigger if exists still_records_enforce_version_update on public.still_records;
create trigger still_records_enforce_version_update
before update on public.still_records
for each row execute function public.enforce_still_record_version_update();

create or replace function public.sync_still_records(p_records jsonb)
returns setof public.still_records
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to sync Still records.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'p_records must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_records) > 500 then
    raise exception 'p_records may contain at most 500 records.' using errcode = '22023';
  end if;

  return query
  with parsed as (
    select distinct on (input.record_type, input.record_id)
      input.record_type,
      input.record_id,
      coalesce(input.schema_version, 1) as schema_version,
      coalesce(input.payload, '{}'::jsonb) as payload,
      input.updated_at,
      input.deleted_at,
      input.sync_counter,
      input.mutation_id
    from jsonb_to_recordset(p_records) as input(
      record_type text,
      record_id text,
      schema_version integer,
      payload jsonb,
      updated_at bigint,
      deleted_at bigint,
      sync_counter bigint,
      mutation_id text
    )
    where input.record_type is not null
      and input.record_id is not null
      and input.updated_at is not null
      and input.sync_counter is not null
      and input.sync_counter > 0
      and input.mutation_id is not null
      and char_length(input.mutation_id) between 1 and 200
    order by
      input.record_type,
      input.record_id,
      input.sync_counter desc,
      input.mutation_id desc,
      input.deleted_at desc nulls last
  ), upserted as (
    insert into public.still_records as current_record (
      user_id,
      record_type,
      record_id,
      schema_version,
      payload,
      updated_at,
      deleted_at,
      sync_counter,
      mutation_id
    )
    select
      (select auth.uid()),
      parsed.record_type,
      parsed.record_id,
      parsed.schema_version,
      parsed.payload,
      parsed.updated_at,
      parsed.deleted_at,
      parsed.sync_counter,
      parsed.mutation_id
    from parsed
    on conflict (user_id, record_type, record_id)
    do update set
      schema_version = excluded.schema_version,
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      sync_counter = excluded.sync_counter,
      mutation_id = excluded.mutation_id
    where (excluded.sync_counter, excluded.mutation_id) > (current_record.sync_counter, current_record.mutation_id)
       or (
         excluded.sync_counter = current_record.sync_counter
         and excluded.mutation_id = current_record.mutation_id
         and excluded.deleted_at is not null
         and current_record.deleted_at is null
       )
    returning current_record.*
  ), existing_losers as (
    select current_record.*
    from parsed
    join public.still_records as current_record
      on current_record.user_id = (select auth.uid())
     and current_record.record_type = parsed.record_type
     and current_record.record_id = parsed.record_id
    where not exists (
      select 1
      from upserted
      where upserted.user_id = current_record.user_id
        and upserted.record_type = current_record.record_type
        and upserted.record_id = current_record.record_id
    )
  ), authoritative as (
    select upserted.* from upserted
    union all
    select existing_losers.* from existing_losers
  )
  select authoritative.*
  from authoritative
  order by authoritative.record_type, authoritative.record_id;
end;
$$;

-- Client access is deliberately narrower than Supabase's historical public-schema
-- defaults. The RPC still runs as the caller and therefore needs only these same
-- privileges plus sequence USAGE for server revision assignment.
drop policy if exists "Users can delete their own Still records" on public.still_records;

revoke all on table public.still_records from anon, authenticated;
grant select on table public.still_records to authenticated;
grant insert (
  user_id,
  record_type,
  record_id,
  schema_version,
  payload,
  updated_at,
  deleted_at,
  sync_counter,
  mutation_id
) on public.still_records to authenticated;
grant update (
  schema_version,
  payload,
  updated_at,
  deleted_at,
  sync_counter,
  mutation_id
) on public.still_records to authenticated;

revoke all on sequence public.still_sync_server_revision_seq from public, anon;
grant usage on sequence public.still_sync_server_revision_seq to authenticated;

revoke all on function public.sync_still_records(jsonb) from public, anon;
grant execute on function public.sync_still_records(jsonb) to authenticated;

-- Trigger functions are implementation details, not API endpoints. Trigger
-- execution does not require callers to hold EXECUTE after trigger creation.
revoke all on function public.enforce_still_record_version_update() from public, anon, authenticated;

comment on function public.enforce_still_record_version_update() is
  'Enforces Still logical-version update ordering and assigns a fresh server_revision to every accepted update.';

comment on function public.sync_still_records(jsonb) is
  'Incremental Still sync upsert for authenticated users. Accepts at most 500 records per call, resolves conflicts by (sync_counter, mutation_id), and returns the authoritative server row for every pushed key.';