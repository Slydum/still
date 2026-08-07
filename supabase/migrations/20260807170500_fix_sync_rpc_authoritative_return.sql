-- Phase 7 hardening: ensure every pushed sync key returns its authoritative row.
--
-- PostgreSQL data-modifying CTEs share a statement snapshot with the main query.
-- The previous function re-selected from still_records after the upsert, so a newly
-- inserted row (and the new value of an accepted update) was not visible to that
-- final SELECT. Return accepted rows directly from the upsert CTE and use the
-- pre-statement table snapshot only for mutations that lost conflict resolution.

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
      mutation_id,
      server_revision
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
      parsed.mutation_id,
      nextval('public.still_sync_server_revision_seq')
    from parsed
    on conflict (user_id, record_type, record_id)
    do update set
      schema_version = excluded.schema_version,
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      sync_counter = excluded.sync_counter,
      mutation_id = excluded.mutation_id,
      server_revision = nextval('public.still_sync_server_revision_seq'),
      modified_at = now()
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

comment on function public.sync_still_records(jsonb) is
  'Incremental Still sync upsert. Records resolve by (sync_counter, mutation_id), independent of device clock; accepted changes receive monotonic server_revision values. Every pushed key returns its authoritative server row, including new inserts, accepted updates, and losing mutations.';
