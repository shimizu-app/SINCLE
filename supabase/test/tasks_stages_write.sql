-- 管理者でないメンバーの書き換えが弾かれることの確認。
-- わざと失敗させるので ON_ERROR_STOP は掛けない。
\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '33333333-3333-3333-3333-333333333333',
    'email', 'staff@example-orinami.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

\echo 'ステージの名前を変える → 0件のままになるのが正しい:'
update public.stages set name = 'かってに変える' where workspace_id = :'ws'::uuid;
select count(*) as "変わってしまった件数" from public.stages
 where workspace_id = :'ws'::uuid and name = 'かってに変える';

\echo 'ステージを足す → ポリシー違反で弾かれるのが正しい:'
insert into public.stages (workspace_id, name, position) values (:'ws'::uuid, 'かってに足す', 9);
