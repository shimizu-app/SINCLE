-- ═══════════════════════════════════════════════════════════
-- フェーズ5の通し確認（案件・履歴・書類・キーパーソン）
--
-- 本番ではなく、手元の PostgreSQL に対して流す。
-- ログイン中のユーザーを request.jwt.claims で作り、
-- authenticated ロールのまま RLS 越しに触る。
-- 実行は supabase/test/run.sh から。
-- ═══════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\pset footer off

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'haru@example-orinami.jp');

select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '11111111-1111-1111-1111-111111111111',
    'email', 'haru@example-orinami.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

\echo '── 前提：ワークスペースを作る ──'
select public.create_workspace('株式会社Orinami', 'orinami', 'はる') as workspace_id \gset
select (:'workspace_id' <> '') as "ワークスペースが出来た";

\echo ''
\echo '── ① 名刺を登録すると連鎖する（015）──'
select public.register_contact(
  p_workspace_id := :'workspace_id',
  p_company_name := 'ミライ精機株式会社',
  p_contact_name := '佐藤 花子',
  p_title        := '取締役',
  p_industry     := '製造/機械',
  p_employees    := 180,
  p_deal_type    := 'システム開発',
  p_deal_memo    := '生産管理システムの入れ替えを検討中'
) as reg \gset
select (:'reg'::jsonb ->> 'company_id') as company_id \gset
select
  (:'reg'::jsonb ->> 'company_id') is not null as "会社",
  (:'reg'::jsonb ->> 'contact_id') is not null as "名刺",
  (:'reg'::jsonb ->> 'deal_id')    is not null as "案件",
  (select tier from public.companies where id = :'company_id'::uuid) as "ティア",
  (select count(*) from public.tasks    where company_id = :'company_id'::uuid) as "初回タスク",
  (select count(*) from public.channels where company_id = :'company_id'::uuid) as "会社チャンネル";

\echo ''
\echo '── ② 進行中の案件と放置日数（018）──'
-- updated_at には触ると now() に戻すトリガがある。
-- 「9日前から動いていない」状態を作るため、ここだけ外す。
reset role;
alter table public.deals disable trigger user;
set role authenticated;
update public.deals set updated_at = now() - interval '9 days'
 where company_id = :'company_id'::uuid;
-- talking のしきい値は7日（lib/design.ts の DEAL_STATUS）。
-- 9日なら「動きがありません」、14日以上で「止まっています」。
select company_name, status, deal_type, days_since_update as "放置日数",
       contact_name, open_task_count as "未完了タスク"
  from public.list_deals(:'workspace_id'::uuid);

\echo ''
\echo '── ③ 記録を1行入れると放置日数が戻る ──'
select public.log_activity(:'company_id'::uuid, '先方に電話しました。来週訪問します。') is not null
       as "会社チャンネルに残った";
select days_since_update as "記録した後の放置日数" from public.list_deals(:'workspace_id'::uuid);
reset role;
alter table public.deals enable trigger user;
set role authenticated;

\echo ''
\echo '── ④ 履歴（company_timeline）──'
select kind, left(coalesce(title, body), 30) as text, done
  from public.company_timeline(:'company_id'::uuid) order by at;
select
  (select count(*) from public.company_timeline(:'company_id'::uuid, 'talk')) as "会話だけ",
  (select count(*) from public.company_timeline(:'company_id'::uuid, 'task')) as "タスクだけ";

\echo ''
\echo '── ⑤ 書類（006 + 011）──'
insert into public.documents
  (workspace_id, company_id, name, kind, storage_path, size_bytes, mime_type, uploaded_by)
values (:'workspace_id'::uuid, :'company_id'::uuid, '御見積書.pdf', 'quote',
        :'workspace_id' || '/' || :'company_id' || '/abc_見積.pdf', 20480, 'application/pdf',
        public.my_member_id(:'workspace_id'::uuid));
update public.documents set pinned = true where company_id = :'company_id'::uuid;
select name, kind, pinned as "よく使う",
       public.ws_from_path(storage_path) = :'workspace_id'::uuid as "保存先がワークスペース配下"
  from public.documents where company_id = :'company_id'::uuid;

\echo ''
\echo '── ⑥ キーパーソンと紹介（007 + 018）──'
insert into public.key_persons
  (workspace_id, name, company_name, title, genre, sub_genres, layers, scope, pref, met)
values
 (:'workspace_id'::uuid, '田中 一郎', '田中商事', '会長', 'maker', '{it}', '{smeexec}',  'pref',     '愛知県', '商工会の会合'),
 (:'workspace_id'::uuid, '鈴木 次郎', '鈴木総研', '理事', 'it',    '{}',   '{academia}', 'national', '東京都', '紹介');
insert into public.referrals (workspace_id, key_person_id, to_name, result, happened_at)
select :'workspace_id'::uuid, id, 'ミライ精機株式会社', '受注', current_date
  from public.key_persons where name = '田中 一郎';

select name, genre, scope, pref, referral_count as "紹介数"
  from public.list_key_persons(:'workspace_id'::uuid);
-- ジャンルは本業（genre）と顔が利くジャンル（sub_genres）の両方で当てる
select coalesce(string_agg(name, ' / '), '（該当なし）') as "ジャンル it で絞る"
  from public.list_key_persons(:'workspace_id'::uuid, '{it}');
-- 軸を重ねると AND で絞まる
select coalesce(string_agg(name, ' / '), '（該当なし）') as "it かつ 東京都"
  from public.list_key_persons(:'workspace_id'::uuid, '{it}', null, '{東京都}');
select kind, value, count from public.key_person_facets(:'workspace_id'::uuid)
 order by kind, value;

\echo ''
\echo '── ⑦ 案件を完了にする ──'
select id as deal_id from public.deals where company_id = :'company_id'::uuid \gset
select public.complete_deal(:'deal_id'::uuid, '受注しました') \gset _
-- 完了は active=false で表す。status に「完了」は無い（DATABASE.md）。
select active as "進行中のまま？", status from public.deals where id = :'deal_id'::uuid;
select count(*) as "進行中の件数" from public.list_deals(:'workspace_id'::uuid);
select kind, left(coalesce(title, body), 26) as text
  from public.company_timeline(:'company_id'::uuid) order by at desc limit 1;

\echo ''
\echo '── ⑧ 一覧の集計（016）──'
select * from public.customer_counts(:'workspace_id'::uuid);
