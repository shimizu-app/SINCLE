-- ═══════════════════════════════════════════════════════════
-- 019 の確認：会社で絞れるタスク一覧と、ステージの編集権限。
-- phase5.sql の後に流す（会社と初回タスクが出来ている前提）。
-- ═══════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\pset footer off

reset role;
select id as ws      from public.workspaces where slug = 'orinami' \gset
select id as company from public.companies  where name = 'ミライ精機株式会社' \gset

select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '11111111-1111-1111-1111-111111111111',
    'email', 'haru@example-orinami.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

\echo '── ① 会社で絞ったタスク一覧 ──'
select
  (select count(*) from public.list_tasks(:'ws'::uuid)) as "全部",
  (select count(*) from public.list_tasks(:'ws'::uuid, false, null, :'company'::uuid)) as "この会社",
  (select count(*) from public.list_tasks(:'ws'::uuid, false, null,
     '00000000-0000-0000-0000-000000000000'::uuid)) as "別の会社";

\echo ''
\echo '── ② 管理者はステージを編集できる ──'
insert into public.stages (workspace_id, name, position)
values (:'ws'::uuid, '社内稟議', (select max(position) + 1 from public.stages where workspace_id = :'ws'::uuid));
update public.stages set name = '初回おとずれ'
 where workspace_id = :'ws'::uuid and position = 0;
-- 並べ替えは position の入れ替えだけ（一意制約は無い）
update public.stages set position = 99 where workspace_id = :'ws'::uuid and position = 0;
update public.stages set position = 0  where workspace_id = :'ws'::uuid and position = 1;
update public.stages set position = 1  where workspace_id = :'ws'::uuid and position = 99;
select position, name from public.stages where workspace_id = :'ws'::uuid order by position;

\echo ''
\echo '── ③ 管理者でないメンバーは編集できない ──'
-- 事前登録してから本人がログインする、という本番と同じ道筋を通す
insert into public.workspace_members (workspace_id, email, name, role, is_admin, status)
values (:'ws'::uuid, 'staff@example-orinami.jp', 'ひら社員', 'メンバー', false, 'invited');

reset role;
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'staff@example-orinami.jp');
select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '33333333-3333-3333-3333-333333333333',
    'email', 'staff@example-orinami.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

select public.claim_membership() as "参加できた行数";
select count(*) as "ステージは読める" from public.stages where workspace_id = :'ws'::uuid;
