-- 書けてはいけないものを試す。わざと失敗させるので ON_ERROR_STOP は掛けない。
\pset footer off
reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select id as co from public.companies where workspace_id = :'ws' order by created_at limit 1 \gset

select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo '範囲に知らない値 → エラーになるのが正しい:'
select public.set_gmail_scope(:'ws', 'everything');

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','22222222-2222-2222-2222-222222222222','email','other@example-corp.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo 'よそのワークスペースにメールを入れる → エラーになるのが正しい:'
insert into public.mails (workspace_id, company_id, direction, subject, sent_at, rfc_message_id)
values (:'ws', :'co', 'in', '偽のメール', now(), 'evil@example');
