begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

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
  'users can insert their own records'
);

select throws_ok(
  $$insert into public.still_records (user_id, record_type, record_id, payload, updated_at, mutation_id)
    values ('22222222-2222-2222-2222-222222222222', 'task', 'forbidden', '{}', 2, 'cross-user-insert')$$,
  '42501',
  'new row violates row-level security policy for table "still_records"',
  'users cannot insert records for another user'
);

update public.still_records
set payload = '{"changed":true}'
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select payload->>'owner' from public.still_records where record_id = 'other'),
  'two',
  'users cannot update another users rows'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
delete from public.still_records
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select count(*)::integer from public.still_records where record_id = 'other'),
  1,
  'users cannot delete another users rows'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::integer from public.sync_still_records('[{"record_type":"task","record_id":"rpc-owned","schema_version":1,"payload":{"ok":true},"updated_at":3,"sync_counter":1,"mutation_id":"rls-test"}]'::jsonb)),
  1,
  'sync RPC writes through the authenticated users RLS context'
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

select * from finish();
rollback;
