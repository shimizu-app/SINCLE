-- 023：書けてはいけないものを試す。わざと失敗させるので ON_ERROR_STOP は掛けない。
-- card_privacy.sql の後に流す（ナカムラ商事は ひら社員 の自分だけの会社、はるの許可は外れている）。
\pset footer off
reset role;
select id as ws        from public.workspaces where slug = 'orinami' \gset
select id as haru      from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset
select id as staff     from public.workspace_members where workspace_id = :'ws' and email = 'staff@example-orinami.jp' \gset
select id as staff_co  from public.companies where name = '株式会社ナカムラ商事' \gset
select id as haru_co   from public.companies where name = 'ナカムラ商事' \gset
select id as shared_co from public.companies where name = 'ミライ精機株式会社' \gset
select id as staff_channel from public.channels where company_id = :'staff_co' \gset

-- ── ひら社員 ──
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo '自分に「全員の名刺を見る」を付ける → エラーになるのが正しい:'
update public.workspace_members set can_view_all = true where id = :'staff';
\echo '共有された会社の登録者を書き換える → エラーになるのが正しい:'
update public.companies set registered_by = :'staff' where id = :'shared_co';
\echo '人が共有した会社の共有を外す → エラーになるのが正しい:'
update public.companies set shared = false where id = :'shared_co';
\echo 'はるの会社のファイルを置く → ポリシー違反で弾かれるのが正しい:'
insert into storage.objects (bucket_id, name) values ('documents', :'ws' || '/' || :'haru_co' || '/evil.pdf');

-- ── はる（許可なし）──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo 'ひら社員の会社に名刺を足す → ポリシー違反で弾かれるのが正しい:'
insert into public.contacts (workspace_id, company_id, name) values (:'ws', :'staff_co', '偽の名刺');
\echo 'ひら社員の会社に記録を書く → エラーになるのが正しい:'
select public.log_activity(:'staff_co', 'のぞき見');
\echo 'ひら社員の会社を指定して名刺登録 → エラーになるのが正しい:'
select public.register_contact(:'ws', 'x', p_company_id => :'staff_co', p_contact_name => '偽');
\echo 'ひら社員の会社チャンネルに投稿 → ポリシー違反で弾かれるのが正しい:'
insert into public.messages (channel_id, workspace_id, author_id, text)
values (:'staff_channel', :'ws', :'haru', 'のぞき見');
\echo 'ひら社員の会社の名前を変える → 0件のままが正しい:'
with u as (update public.companies set name = '乗っ取り' where id = :'staff_co' returning 1)
select count(*) as "変わった件数（0）" from u;

-- ── はる（許可あり）：見えるが、書けない ──
update public.workspace_members set can_view_all = true where id = :'haru';
\echo ''
\echo '許可があっても、人の会社に記録を書く → エラーになるのが正しい:'
select public.log_activity(:'staff_co', '見るだけのはず');
\echo '許可があっても、人の会社に名刺を足す → ポリシー違反で弾かれるのが正しい:'
insert into public.contacts (workspace_id, company_id, name) values (:'ws', :'staff_co', '偽の名刺');
\echo '許可があっても、人の会社を書き換える → 0件のままが正しい:'
with u as (update public.companies set name = '乗っ取り' where id = :'staff_co' returning 1)
select count(*) as "変わった件数（0）" from u;
\echo '許可があっても、人の会社の案件を完了にする → エラーになるのが正しい:'
select public.complete_deal((select id from public.deals where company_id = :'staff_co' and active));
update public.workspace_members set can_view_all = false where id = :'haru';

reset role;
select name as "最後まで元の名前" from public.companies where id = :'staff_co';
select count(*) as "偽の名刺（0）" from public.contacts where name = '偽の名刺';
select can_view_all as "ひら社員の許可（f）" from public.workspace_members where id = :'staff';
