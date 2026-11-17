-- 025 の確認：カレンダーから入れた予定。read_receipts の後に流す。
\set ON_ERROR_STOP on
\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select id as haru from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset
select id as shared_co from public.companies where name = 'ミライ精機株式会社' \gset

-- ── はる：会社なしの予定と、共有の会社の予定を入れる ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

insert into public.events (workspace_id, title, starts_at, duration_min, format, created_by)
values (:'ws', '歯医者', date_trunc('day', now()) + interval '15 hours', 45, '対面', :'haru');
insert into public.events (workspace_id, company_id, title, starts_at, duration_min, format, created_by)
values (:'ws', :'shared_co', 'ミライ精機と打合せ', date_trunc('day', now()) + interval '10 hours', 60, 'Google Meet', :'haru');

\echo '── ① 入れた本人には両方見え、終わりの時刻もわかる ──'
select title, extract(epoch from (end_at - at)) / 60 as "長さ（分）", company_name
  from public.calendar_items(:'ws', current_date - 1, current_date + 1)
 where kind = 'event' order by at;

-- ── ひら社員 ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo ''
\echo '── ② 同じ会社の人には、会社なしの予定（私用）は見えない。共有の会社の予定は見える ──'
select title from public.calendar_items(:'ws', current_date - 1, current_date + 1) where kind = 'event';
select count(*) as "直接読んでも私用は見えない（0）" from public.events where title = '歯医者';
