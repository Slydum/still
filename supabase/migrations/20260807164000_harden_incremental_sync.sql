-- Phase 2 sync protocol: Lamport-style record revisions plus a server pull cursor.

create sequence if not exists public.still_sync_server_revision_seq;

alter table public.still_records
  add column if not exists sync_counter bigint,
  add column if not exists mutation_id text,
  add column if not exists server_revision bigint;

update public.still_records
set sync_counter = coalesce(sync_counter, 1),
    mutation_id = coalesce(mutation_id, 'legacy-' || md5(record_type || ':' || record_id || ':' || updated_at::text)),
    server_revision = coalesce(server_revision, nextval('public.still_sync_server_revision_seq'))
where sync_counter is null or mutation_id is null or server_revision is null;

alter table public.still_records
  alter column sync_counter set not null,
  alter column sync_counter set default 1,
  alter column mutation_id set not null,
  alter column server_revision set not null,
  alter column server_revision set default nextval('public.still_sync_server_revision_seq');

alter sequence public.still_sync_server_revision_seq owned by public.still_records.server_revision;

create unique index if not exists still_records_user_server_revision_idx
  on public.still_records (user_id, server_revision);

create index if not exists still_records_pull_cursor_idx
  on public.still_records (user_id, server_revision asc);

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
  )
  select current_record.*
  from parsed
  join public.still_records as current_record
    on current_record.user_id = (select auth.uid())
   and current_record.record_type = parsed.record_type
   and current_record.record_id = parsed.record_id
  order by current_record.record_type, current_record.record_id;
end;
$$;

comment on function public.sync_still_records(jsonb) is
  'Incremental Still sync upsert. Records resolve by (sync_counter, mutation_id), independent of device clock; accepted changes receive monotonic server_revision values for gap-safe pull cursors. Every pushed key returns its authoritative server row.';
