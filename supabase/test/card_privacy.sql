-- ═══════════════════════════════════════════════════════════
-- 023 の確認：名刺（会社）の見える範囲。
-- 最後に流す（orinami に はる（管理者）と ひら社員 がいる前提）。
--
--   ・登録した本人と担当者だけが見える。管理者でも、許可が無ければ見えない
--   ・「全員の名刺を見る」許可があると、全員の登録が見え、同じ会社は1つにまとまる
--   ・チームに共有した会社は、全員が見て書ける
-- ═══════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\pset footer off

reset role;
select id as ws    from public.workspaces where slug = 'orinami' \gset
select id as haru  from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset
select id as staff from public.workspace_members where workspace_id = :'ws' and email = 'staff@example-orinami.jp' \gset

\echo '── ⓪ 管理者でも、許可は自動では付かない ──'
select is_admin as "はるは管理者", can_view_all as "許可（f が正しい）"
  from public.workspace_members where id = :'haru';

-- ── ひら社員として、名刺を1枚登録する ──
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

select (public.register_contact(:'ws', '株式会社ナカムラ商事',
          p_contact_name => '中村 一郎', p_title => '部長',
          p_email => 'nakamura@nakamura.example'))->>'company_id' as staff_co \gset
select id as staff_channel from public.channels where company_id = :'staff_co' \gset
select public.log_activity(:'staff_co', 'ひら社員のメモ：来月また連絡') \gset _
insert into public.mails (workspace_id, company_id, direction, subject, sent_at, rfc_message_id, imported_by)
values (:'ws', :'staff_co', 'in', 'ナカムラ商事からの相談', now(), 'naka-1@nakamura.example', :'staff');

\echo ''
\echo '── ① 登録した本人には全部見える ──'
select
  (select count(*) from public.companies where id = :'staff_co')                       as "会社（1）",
  (select count(*) from public.contacts where company_id = :'staff_co')                as "名刺（1）",
  (select count(*) from public.deals where company_id = :'staff_co')                   as "案件（1）",
  (select count(*) from public.messages where channel_id = :'staff_channel')           as "投稿（2）",
  (select count(*) from public.search_companies(:'ws') where id = :'staff_co')         as "一覧（1）",
  (select count(*) from public.list_channels(:'ws') where company_id = :'staff_co')    as "チャンネル一覧（1）",
  (select registered_by = :'staff' from public.companies where id = :'staff_co')       as "登録者は本人（t）";

-- ── はる（管理者・許可なし）として ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ② 管理者でも、許可が無ければ ひら社員 の名刺は見えない（すべて 0 が正しい）──'
select
  (select count(*) from public.companies where id = :'staff_co')                as "会社",
  (select count(*) from public.contacts where company_id = :'staff_co')         as "名刺",
  (select count(*) from public.deals where company_id = :'staff_co')            as "案件",
  (select count(*) from public.tasks where company_id = :'staff_co')            as "タスク",
  (select count(*) from public.mails where company_id = :'staff_co')            as "メール",
  (select count(*) from public.channels where id = :'staff_channel')            as "チャンネル",
  (select count(*) from public.messages where channel_id = :'staff_channel')    as "投稿";
select
  (select count(*) from public.search_companies(:'ws', p_scope => 'all') where id = :'staff_co') as "一覧（全員）",
  (select count(*) from public.company_timeline(:'staff_co'))                                   as "履歴",
  (select count(*) from public.list_deals(:'ws') where company_id = :'staff_co')                as "案件一覧",
  (select count(*) from public.list_tasks(:'ws') where company_id = :'staff_co')                as "タスク一覧",
  (select count(*) from public.list_channels(:'ws') where company_id = :'staff_co')             as "チャンネル一覧",
  (select count(*) from public.company_groups(:'ws'))                                           as "全社のまとめ",
  (select count(*) from public.company_group_contacts(:'ws', 'ナカムラ商事'))                     as "まとめの名刺",
  (select count(*) from public.find_similar_companies(:'ws', 'ナカムラ商事'))                     as "重複の候補",
  (select count(*) from public.my_mail_contacts(:'ws') where company_id = :'staff_co')          as "Gmailの照合";

\echo ''
\echo '── ③ はるも同じ会社を自分で登録できる（自分の1件になる）──'
select (public.register_contact(:'ws', 'ナカムラ商事', p_contact_name => '中村 一郎',
          p_email => 'nakamura@nakamura.example'))->>'is_new' as "新しく作った（true）";
select id as haru_co from public.companies where name = 'ナカムラ商事' \gset

\echo ''
\echo '── ④ 担当にされたタスクは、会社が見えなくても見えて、完了にできる ──'
insert into public.tasks (workspace_id, company_id, title, assignee_id)
values (:'ws', :'haru_co', 'ひら社員にお願い：見積を作る', :'staff');

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select
  (select count(*) from public.list_tasks(:'ws') where title = 'ひら社員にお願い：見積を作る') as "タスク（1）",
  (select count(*) from public.companies where id = :'haru_co')                              as "その会社（0）";
update public.tasks set done = true where title = 'ひら社員にお願い：見積を作る';
select count(*) as "完了にできた（1）" from public.tasks
 where title = 'ひら社員にお願い：見積を作る' and done;

-- ── はるに戻って、自分に許可を付ける ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ⑤ 管理者が自分に「全員の名刺を見る」を付けると、全員の登録が見える ──'
update public.workspace_members set can_view_all = true where id = :'haru';
select
  (select count(*) from public.companies where id = :'staff_co')                                as "会社（1）",
  (select count(*) from public.contacts where company_id = :'staff_co')                         as "名刺（1）",
  (select count(*) from public.messages where channel_id = :'staff_channel')                    as "投稿（2）",
  (select count(*) from public.mails where company_id = :'staff_co')                            as "メール（1）",
  (select count(*) from public.company_timeline(:'staff_co')) > 0                               as "履歴（t）";
select
  (select count(*) from public.search_companies(:'ws') where id = :'staff_co')                  as "自分の一覧には出ない（0）",
  (select count(*) from public.search_companies(:'ws', p_scope => 'all') where id = :'staff_co') as "全員の一覧には出る（1）",
  (select count(*) from public.list_channels(:'ws') where company_id = :'staff_co')             as "チャンネル一覧には混ぜない（0）",
  (select count(*) from public.my_mail_contacts(:'ws') where company_id = :'staff_co')          as "Gmailの照合にも使わない（0）";

\echo ''
\echo '── ⑥ 全社のまとめ：同じ会社は1つにまとまる ──'
select name, record_count as "登録の数（2）", array_to_string(registrants, '・') as "登録した人",
       contact_count as "名刺（2）", active_deals as "案件（2）"
  from public.company_groups(:'ws') where key = 'ナカムラ商事';
select registrant_name as "登録した人", name, contact_count as "名刺"
  from public.company_group(:'ws', 'ナカムラ商事') order by created_at;
select count(*) as "名刺（2）", count(distinct lower(email)) as "同じ人は1人（1）"
  from public.company_group_contacts(:'ws', 'ナカムラ商事');

\echo ''
\echo '── ⑦ 許可を外すと、また見えなくなる ──'
update public.workspace_members set can_view_all = false where id = :'haru';
select
  (select count(*) from public.companies where id = :'staff_co') as "会社（0）",
  (select count(*) from public.company_groups(:'ws'))            as "まとめ（0）";

-- ── ひら社員が共有する ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
update public.companies set shared = true where id = :'staff_co';

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ⑧ チームに共有すると、全員が見て書ける ──'
select
  (select count(*) from public.companies where id = :'staff_co')                     as "会社（1）",
  (select count(*) from public.messages where channel_id = :'staff_channel')         as "投稿（2）",
  (select count(*) from public.search_companies(:'ws') where id = :'staff_co')       as "自分の一覧に出る（1）",
  (select count(*) from public.find_similar_companies(:'ws', 'ナカムラ商事'))          as "重複の候補（2）";
select public.log_activity(:'staff_co', 'はるも書ける') is not null as "書ける（t）";

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
update public.companies set shared = false where id = :'staff_co';

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select count(*) as "共有を外すと見えない（0）" from public.companies where id = :'staff_co';

\echo ''
\echo '── ⑨ ファイル：会社が見えなければ開けない ──'
reset role;
insert into storage.objects (bucket_id, name)
values ('documents', :'ws' || '/' || :'staff_co' || '/x_secret.pdf');
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select count(*) as "はるから（0）" from storage.objects where name like '%x_secret.pdf';
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select count(*) as "ひら社員から（1）" from storage.objects where name like '%x_secret.pdf';

reset role;
\echo ''
\echo '── ⑩ 新しい関数は、ログインしていない人（anon）には開いていない ──'
select p.proname, has_function_privilege('anon', p.oid, 'execute') as "anon（f）",
       has_function_privilege('authenticated', p.oid, 'execute') as "authenticated（t）"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in (
   'company_groups', 'company_group', 'company_group_contacts', 'my_mail_contacts',
   'my_company_ids', 'my_visible_company_ids', 'search_companies')
 order by 1;
