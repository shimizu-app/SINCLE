-- ═══════════════════════════════════════════════════════════
-- 他のワークスペースのデータが見えないことの確認。
--
-- phase5.sql の後に流す。別のユーザーで別のワークスペースを作り、
-- 1件目のワークスペースのデータに手が届かないことを見る。
-- security definer の RPC も所属判定で止まることを確かめる。
--
-- 他社のIDは RLS 越しには引けないので、
-- ロールを戻した状態（テーブルの持ち主）で先に取っておく。
-- ═══════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\pset footer off

reset role;
select id as other_ws      from public.workspaces where slug = 'orinami' \gset
select id as other_company from public.companies  where name = 'ミライ精機株式会社' \gset
select id as other_deal    from public.deals      where company_id = :'other_company'::uuid \gset

insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'other@example-corp.jp');

select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '22222222-2222-2222-2222-222222222222',
    'email', 'other@example-corp.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

select public.create_workspace('別会社ホールディングス', 'betsu', 'よその人') \gset _

\echo '── 他社から見えた件数（すべて 0 が正しい）──'
select
  (select count(*) from public.companies)   as "会社",
  (select count(*) from public.contacts)    as "名刺",
  (select count(*) from public.deals)       as "案件",
  (select count(*) from public.documents)   as "書類",
  (select count(*) from public.key_persons) as "キーパーソン",
  (select count(*) from public.referrals)   as "紹介",
  (select count(*) from public.messages)    as "投稿",
  (select count(*) from public.tasks)       as "タスク";

\echo ''
\echo '── 他社のIDを指定して RPC を呼んでも空（すべて 0 が正しい）──'
select
  (select count(*) from public.list_deals(:'other_ws'::uuid))          as "list_deals",
  (select count(*) from public.list_key_persons(:'other_ws'::uuid))    as "list_key_persons",
  (select count(*) from public.key_person_facets(:'other_ws'::uuid))   as "key_person_facets",
  (select count(*) from public.search_companies(:'other_ws'::uuid))    as "search_companies",
  (select count(*) from public.company_timeline(:'other_company'::uuid)) as "company_timeline",
  (select count(*) from public.list_tasks(:'other_ws'::uuid))          as "list_tasks",
  (select count(*) from public.list_channels(:'other_ws'::uuid))       as "list_channels";

-- 書き込みが弾かれることは isolation_write.sql で見る（わざと失敗させるため）。
