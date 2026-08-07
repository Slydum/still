-- Phase 2 sync protocol: deterministic client tie-breaks plus a server revision cursor.

create sequence if not exists public.still_sync_server_revision_seq;

alter table public.still_records
  add column if not exists mutation_id text,
  add column if not exists server_revision bigint;

update public.still_records
set mutation_id = coalesce(mutation_id, 'legacy-' || md5(record_type || ':' || record_id || ':' || updated_at::text)),
    server_revision = coalesce(server_revision, nextval('public.still_sync_server_revision_seq'))
where mutation_id is null or server_revision is null;

alter table public.still_records
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
      input.mutation_id
    from jsonb_to_recordset(p_records) as input(
      record_type text,
      record_id text,
      schema_version integer,
      payload jsonb,
      updated_at bigint,
      deleted_at bigint,
      mutation_id text
    )
    where input.record_type is not null
      and input.record_id is not null
      and input.updated_at is not null
      and input.mutation_id is not null
      and char_length(input.mutation_id) between 1 and 200
    order by
      input.record_type,
      input.record_id,
      input.updated_at desc,
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
      parsed.mutation_id,
      nextval('public.still_sync_server_revision_seq')
    from parsed
    on conflict (user_id, record_type, record_id)
    do update set
      schema_version = excluded.schema_version,
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      mutation_id = excluded.mutation_id,
      server_revision = nextval('public.still_sync_server_revision_seq'),
      modified_at = now()
    where (excluded.updated_at, excluded.mutation_id) > (current_record.updated_at, current_record.mutation_id)
       or (
         excluded.updated_at = current_record.updated_at
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
  'Incremental Still sync upsert. Client records resolve by (updated_at, mutation_id); accepted changes receive monotonic server_revision values for gap-safe pull cursors. Every pushed key returns its authoritative server row.';
