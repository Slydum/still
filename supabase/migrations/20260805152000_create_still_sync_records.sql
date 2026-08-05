create table public.still_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (
    record_type in (
      'task',
      'event',
      'journal_entry',
      'expense',
      'entity_link',
      'work_shift',
      'check_in',
      'settings'
    )
  ),
  record_id text not null check (char_length(record_id) between 1 and 200),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at bigint not null check (updated_at >= 0),
  deleted_at bigint check (deleted_at is null or deleted_at >= 0),
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

create index still_records_active_type_idx
  on public.still_records (user_id, record_type, updated_at desc)
  where deleted_at is null;

create index still_records_updated_idx
  on public.still_records (user_id, updated_at desc);

alter table public.still_records enable row level security;

create policy "Users can read their own Still records"
  on public.still_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own Still records"
  on public.still_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own Still records"
  on public.still_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own Still records"
  on public.still_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.still_records to authenticated;
revoke all on public.still_records from anon;

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
      input.deleted_at
    from jsonb_to_recordset(p_records) as input(
      record_type text,
      record_id text,
      schema_version integer,
      payload jsonb,
      updated_at bigint,
      deleted_at bigint
    )
    where input.record_type is not null
      and input.record_id is not null
      and input.updated_at is not null
    order by
      input.record_type,
      input.record_id,
      input.updated_at desc,
      input.deleted_at desc nulls last
  )
  insert into public.still_records as current_record (
    user_id,
    record_type,
    record_id,
    schema_version,
    payload,
    updated_at,
    deleted_at
  )
  select
    (select auth.uid()),
    parsed.record_type,
    parsed.record_id,
    parsed.schema_version,
    parsed.payload,
    parsed.updated_at,
    parsed.deleted_at
  from parsed
  on conflict (user_id, record_type, record_id)
  do update set
    schema_version = excluded.schema_version,
    payload = excluded.payload,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    modified_at = now()
  where excluded.updated_at > current_record.updated_at
    or (
      excluded.updated_at = current_record.updated_at
      and excluded.deleted_at is not null
      and current_record.deleted_at is null
    )
  returning current_record.*;
end;
$$;

revoke all on function public.sync_still_records(jsonb) from public;
revoke all on function public.sync_still_records(jsonb) from anon;
grant execute on function public.sync_still_records(jsonb) to authenticated;

comment on table public.still_records is
  'Authenticated, user-owned local-first records for the Still application.';
comment on function public.sync_still_records(jsonb) is
  'Conflict-safe last-write-wins upsert for authenticated Still records. Deletions win timestamp ties.';
