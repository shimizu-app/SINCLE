-- 自分だけのTODO（personal_todos）が、本人にしか見えないことの確認。
-- tasks_stages.sql の後に流す（orinami に、はる と ひら社員 がいる前提）。
\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset

-- はる が私用のTODOを書く
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
insert into public.personal_todos (workspace_id, member_id, title, priority)
values (:'ws', (select id from public.workspace_members where email = 'haru@example-orinami.jp'), '歯医者の予約', '中');

\echo '── 自分だけのTODO ──'
select count(*) as "本人から見える（1が正しい）" from public.personal_todos where title = '歯医者の予約';

-- 同じ会社の ひら社員 から
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select count(*) as "同じ会社の別の人から見える（0が正しい）" from public.personal_todos where title = '歯医者の予約';
update public.personal_todos set title = 'のぞき見' where title = '歯医者の予約';
reset role;
select count(*) as "別の人に書き換えられた（0が正しい）" from public.personal_todos where title = 'のぞき見';
