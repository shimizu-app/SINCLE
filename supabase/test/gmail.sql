-- ═══════════════════════════════════════════════════════════
-- 021 の確認：Gmail の取り込み。
-- calendar_roadmap の後に流す（orinami・staff・betsu がある前提。はるの連携は消えている）。
-- ═══════════════════════════════════════════════════════════

\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select id as co from public.companies where workspace_id = :'ws' order by created_at limit 1 \gset

-- ── はるとして ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select id as haru from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset

\echo '── ① Gmail の許可つきでつなぐ。範囲を変え、取り込みの結果を残す ──'
select public.save_integration(:'ws', 'google', 'v1.a', 'v1.r', now() + interval '1 hour',
  '{openid,https://www.googleapis.com/auth/gmail.readonly}', 'haru@gmail.example') \gset _
select gmail_scope as "既定（registered）", last_sync_at is null as "まだ取り込んでいない" from public.integration_status();
select public.set_gmail_scope(:'ws', 'domain') \gset _
select public.mark_gmail_synced(:'ws', '{"imported":2,"ads":1}') \gset _
select gmail_scope as "domain になる", gmail_stats, last_sync_at is not null as "取り込んだ時刻が入る"
  from public.integration_status();

\echo ''
\echo '── ② 同じメール（Message-ID が同じ）は2回入れても1件 ──'
insert into public.mails (workspace_id, company_id, direction, subject, sent_at,
                          gmail_message_id, gmail_thread_id, rfc_message_id, imported_by)
values (:'ws', :'co', 'in', 'お見積のご依頼', now(), 'g-haru-1', 't-haru', 'abc@client.example', :'haru')
on conflict (workspace_id, rfc_message_id) do nothing;
insert into public.mails (workspace_id, company_id, direction, subject, sent_at,
                          gmail_message_id, gmail_thread_id, rfc_message_id, imported_by)
values (:'ws', :'co', 'in', 'お見積のご依頼', now(), 'g-haru-1', 't-haru', 'abc@client.example', :'haru')
on conflict (workspace_id, rfc_message_id) do nothing;
select count(*) as "1が正しい" from public.mails where rfc_message_id = 'abc@client.example';

\echo ''
\echo '── ③ 手で入れたメール（Message-ID なし）は何件でも入る ──'
insert into public.mails (workspace_id, company_id, direction, subject, sent_at)
values (:'ws', :'co', 'out', '手入力1', now()), (:'ws', :'co', 'out', '手入力2', now());
select count(*) as "2が正しい" from public.mails where subject like '手入力%';

-- ── 同じワークスペースのひら社員として ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select id as staff from public.workspace_members where workspace_id = :'ws' and email = 'staff@example-orinami.jp' \gset

\echo ''
\echo '── ④ 同じお客さまのメールを、ひら社員の Gmail からも取り込む（Gmail のIDは違う）→ 増えない ──'
insert into public.mails (workspace_id, company_id, direction, subject, sent_at,
                          gmail_message_id, gmail_thread_id, rfc_message_id, imported_by)
values (:'ws', :'co', 'in', 'お見積のご依頼', now(), 'g-staff-9', 't-staff', 'abc@client.example', :'staff')
on conflict (workspace_id, rfc_message_id) do nothing;
select count(*) as "1のまま", min(gmail_message_id) as "はるの取り込みが残る"
  from public.mails where rfc_message_id = 'abc@client.example';

\echo ''
\echo '── ⑤ 取り込んだメールはチームの全員に見える ──'
select count(*) as "ひら社員から見える（3が正しい）" from public.mails where workspace_id = :'ws';

\echo ''
\echo '── ⑥ ひら社員が範囲を変えても、はるの設定は変わらない ──'
select public.set_gmail_scope(:'ws', 'all') \gset _
select public.mark_gmail_synced(:'ws', '{"imported":999}') \gset _
select count(*) as "ひら社員の連携（0が正しい）" from public.integration_status();

\echo ''
\echo '── ⑦ タスクにしたメールは、タスクを消すと印も外れる ──'
insert into public.tasks (workspace_id, company_id, title, assignee_id)
values (:'ws', :'co', '返信：お見積のご依頼', :'staff') returning id as task \gset
update public.mails set task_id = :'task' where rfc_message_id = 'abc@client.example';
select task_id is not null as "印がつく" from public.mails where rfc_message_id = 'abc@client.example';
delete from public.tasks where id = :'task';
select task_id is null as "印が外れる" from public.mails where rfc_message_id = 'abc@client.example';

-- ── はるに戻る ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑧ はるの範囲と結果は、ひら社員に上書きされていない ──'
select gmail_scope as "domain のまま", gmail_stats->>'imported' as "2のまま" from public.integration_status();

-- ── 別の会社の人として ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','22222222-2222-2222-2222-222222222222','email','other@example-corp.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑨ 別の会社の人からは、メールが1件も見えない ──'
select count(*) as "0が正しい" from public.mails where workspace_id = :'ws';
select public.set_gmail_scope(:'ws', 'all') \gset _

reset role;
\echo ''
\echo '── ⑩ どの関数も、ログインしていない人（anon）には開いていない ──'
select p.proname, has_function_privilege('anon', p.oid, 'execute') as "anon（f が正しい）",
       has_function_privilege('authenticated', p.oid, 'execute') as "authenticated（t が正しい）"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('set_gmail_scope', 'mark_gmail_synced', 'integration_status')
 order by 1;
select gmail_scope as "最後まで domain" from public.integrations where provider = 'google'
   and member_id = (select id from public.workspace_members where email = 'haru@example-orinami.jp' and workspace_id = :'ws');
