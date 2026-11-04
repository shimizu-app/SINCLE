-- ═══════════════════════════════════════════════════════════
-- 020 の確認：連携トークンの出し入れと、計画。
-- 最後に流す（phase5 の orinami、tasks_stages の staff、isolation の betsu がある前提）。
-- ═══════════════════════════════════════════════════════════

\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset

-- ── 本人（はる）として ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo '── ① 連携を保存して、本人が読み出せる ──'
select public.save_integration(:'ws', 'google', 'v1.enc-access', 'v1.enc-refresh',
  now() + interval '1 hour', '{https://www.googleapis.com/auth/calendar.readonly}', 'haru@gmail.example') \gset _
select access_token, refresh_token, account_email from public.my_integration(:'ws', 'google');

\echo ''
\echo '── ② 取り直しで refresh_token が来なくても、前のものが残る ──'
select public.save_integration(:'ws', 'google', 'v1.enc-access-2', null,
  now() + interval '1 hour', '{https://www.googleapis.com/auth/calendar.readonly}', null) \gset _
select access_token, refresh_token as "残っているべき", account_email as "残っているべき2" from public.my_integration(:'ws', 'google');

\echo ''
\echo '── ③ アクセストークンだけ差し替え・使うカレンダーを選ぶ ──'
select public.refresh_integration_token(:'ws', 'google', 'v1.enc-access-3', now() + interval '1 hour') \gset _
select public.set_integration_calendars(:'ws', 'google', '["primary","team@group.calendar.google.com"]') \gset _
select access_token, calendar_ids from public.my_integration(:'ws', 'google');
select provider, account_email, calendar_ids from public.integration_status();

\echo ''
\echo '── ④ 素の select では本人でも読めない（トークンは関数からだけ）──'
select count(*) as "直接読めた行（0が正しい）" from public.integrations;

-- ── 同じワークスペースの別の人（ひら社員）として ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ⑤ 同じ会社の別の人からは、はるのトークンは見えない ──'
select count(*) as "my_integration（0が正しい）" from public.my_integration(:'ws', 'google');
select count(*) as "integration_status（0が正しい）" from public.integration_status();
-- 消そうとしても、自分の行しか対象にならない
select public.delete_integration(:'ws', 'google') \gset _

-- ── 別の会社の人として ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','22222222-2222-2222-2222-222222222222','email','other@example-corp.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ⑥ 別の会社の人からも見えない・書けない ──'
select count(*) as "my_integration（0が正しい）" from public.my_integration(:'ws', 'google');
