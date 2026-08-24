begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.still_records (user_id, record_type, record_id, payload, updated_at, mutation_id)
values
  ('11111111-1111-1111-1111-111111111111', 'task', 'owned', '{"owner":"one"}', 1, 'seed-owned'),
  ('22222222-2222-2222-2222-222222222222', 'task', 'other', '{"owner":"two"}', 1, 'seed-other');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::integer from public.still_records),
  1,
  'authenticated users only see their own Still rows'
);

select is(
  (select payload->>'owner' from public.still_records where record_id = 'owned'),
  'one',
  'the visible row belongs to the current user'
);

select lives_ok(
  $$insert into public.still_records (user_id, record_type, record_id, payload, updated_at, mutation_id)
    values ('11111111-1111-1111-1111-111111111111', 'task', 'new-owned', '{}', 2, 'own-insert')$$,
  'users can insert their own records through the protocol-safe column set'
);

select lives_ok(
  $$insert into public.still_records (user_id, record_type, record_id, payload, updated_at, mutation_id)
    values ('11111111-1111-1111-1111-111111111111', 'work_settings', 'work', '{}', 2, 'work-settings-insert')$$,
  'granular settings record types are accepted'
);

select throws_ok(
  $$insert into public.still_records (user_id, record_type, record_id, payload, updated_at, mutation_id)
    values ('22222222-2222-2222-2222-222222222222', 'task', 'forbidden', '{}', 2, 'cross-user-insert')$$,
  '42501',
  'new row violates row-level security policy for table "still_records"',
  'users cannot insert records for another user'
);

update public.still_records
set payload = '{"changed":true}', sync_counter = 2, mutation_id = 'cross-user-update'
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select payload->>'owner' from public.still_records where record_id = 'other'),
  'two',
  'users cannot update another users rows'
);

select is(
  has_table_privilege('authenticated', 'public.still_records', 'DELETE'),
  false,
  'authenticated API role has no physical DELETE privilege'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(
  $$delete from public.still_records where record_id = 'owned'$$,
  '42501',
  'permission denied for table still_records',
  'physical deletes are blocked so synchronized deletion must use tombstones'
);

select is(
  (select count(*)::integer from public.sync_still_records('[{"record_type":"task","record_id":"rpc-owned","schema_version":1,"payload":{"stage":"inserted"},"updated_at":3,"sync_counter":1,"mutation_id":"rls-test"}]'::jsonb)),
  1,
  'sync RPC returns a newly inserted authoritative row'
);

select is(
  (select payload->>'stage' from public.sync_still_records('[{"record_type":"task","record_id":"rpc-owned","schema_version":1,"payload":{"stage":"accepted-update"},"updated_at":4,"sync_counter":2,"mutation_id":"rls-test-update"}]'::jsonb)),
  'accepted-update',
  'sync RPC returns the accepted update rather than the pre-update snapshot'
);

select is(
  (select payload->>'stage' from public.sync_still_records('[{"record_type":"task","record_id":"rpc-owned","schema_version":1,"payload":{"stage":"losing-update"},"updated_at":5,"sync_counter":1,"mutation_id":"older-loser"}]'::jsonb)),
  'accepted-update',
  'sync RPC returns the existing authoritative row when a mutation loses conflict resolution'
);

select throws_ok(
  $$update public.still_records set payload = '{"owner":"one","stage":"stale"}' where record_id = 'owned'$$,
  '22023',
  'Still record updates must advance (sync_counter, mutation_id), except deletion may win an exact-version tie.',
  'direct writes cannot mutate payload without advancing the logical version'
);

select lives_ok(
  $$update public.still_records
    set payload = '{"owner":"one","stage":"valid-direct"}', sync_counter = 2, mutation_id = 'valid-direct'
    where record_id = 'owned'$$,
  'a direct own-row update is allowed when it obeys the sync version protocol'
);

reset role;
select is(
  has_column_privilege('authenticated', 'public.still_records', 'server_revision', 'UPDATE'),
  false,
  'authenticated API role cannot set server_revision'
);

select is(
  has_column_privilege('authenticated', 'public.still_records', 'user_id', 'UPDATE'),
  false,
  'authenticated API role cannot change record ownership or identity'
);

select is(
  has_column_privilege('authenticated', 'public.still_records', 'payload', 'UPDATE'),
  true,
  'authenticated API role retains the payload update privilege required by sync'
);

select is(
  has_table_privilege('authenticated', 'public.still_records', 'TRUNCATE'),
  false,
  'authenticated API role does not inherit destructive TRUNCATE privilege'
);

select is(
  has_sequence_privilege('authenticated', 'public.still_sync_server_revision_seq', 'USAGE'),
  true,
  'authenticated RPC role can allocate server revisions through the sequence'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(
  $$select count(*) from public.sync_still_records(
    (select jsonb_agg(jsonb_build_object(
      'record_type', 'task',
      'record_id', 'batch-' || n::text,
      'schema_version', 1,
      'payload', '{}'::jsonb,
      'updated_at', n,
      'sync_counter', 1,
      'mutation_id', 'batch-' || n::text
    )) from generate_series(1, 501) as n)
  )$$,
  '22023',
  'p_records may contain at most 500 records.',
  'sync RPC rejects oversized batches server-side'
);

reset role;
set local role anon;
set local "request.jwt.claims" = '{}';
select throws_ok(
  $$select count(*) from public.still_records$$,
  '42501',
  'permission denied for table still_records',
  'anonymous API role cannot read Still records'
);

reset role;
select is(
  has_function_privilege('anon', 'public.sync_still_records(jsonb)', 'EXECUTE'),
  false,
  'anonymous API role cannot execute the sync RPC'
);

select * from finish();
rollback;
