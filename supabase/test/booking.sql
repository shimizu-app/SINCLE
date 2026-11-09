-- ═══════════════════════════════════════════════════════════
-- 022 の確認：予約ページ（ログインしていないお客さまが使う）。
-- gmail の後に流す（はるの Google 連携が残っている前提）。
-- わざと失敗させるものがあるので ON_ERROR_STOP は掛けない。
-- ═══════════════════════════════════════════════════════════
\pset footer off
reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select c.id as co, ct.id as contact
  from public.companies c join public.contacts ct on ct.company_id = c.id
 where c.workspace_id = :'ws' order by c.created_at limit 1 \gset
select id as haru from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset
select (date_trunc('hour', now()) + interval '2 days')::timestamptz as slot1,
       (date_trunc('hour', now()) + interval '3 days')::timestamptz as slot2 \gset
\set tok 'tok_0123456789abcdefghijklmnopqrstuvwxyz'

-- ── はるが発行する ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
insert into public.booking_links
  (workspace_id, company_id, contact_id, member_id, token, proof_hash, slots, duration_min, format, expires_at, calendar_ids)
values
  (:'ws', :'co', :'contact', :'haru', :'tok', encode(sha256(convert_to('proof-ok', 'UTF8')), 'hex'),
   jsonb_build_array(:'slot1'::timestamptz, :'slot2'::timestamptz), 60, 'Google Meet',
   :'slot2'::timestamptz, '["primary"]');
-- 期限切れのもの
insert into public.booking_links
  (workspace_id, company_id, member_id, token, proof_hash, slots, duration_min, format, expires_at)
values
  (:'ws', :'co', :'haru', 'old_0123456789abcdefghijklmnopqrstuvwxyz', encode(sha256(convert_to('proof-ok', 'UTF8')), 'hex'),
   jsonb_build_array(now() - interval '1 day'), 30, 'Zoom', now() - interval '1 hour');

-- ── お客さま（ログインしていない）として ──
reset role;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, false) \gset _
set role anon;

\echo '── ① 予約ページは見える（秘密は無い）──'
select state, workspace_name, company_name, duration_min, format, jsonb_array_length(slots) as "候補（2が正しい）"
  from public.booking_page(:'tok');
select state as "期限切れ（expired が正しい）" from public.booking_page('old_0123456789abcdefghijklmnopqrstuvwxyz');
select count(*) as "でたらめな token（0が正しい）" from public.booking_page('nope_0123456789abcdefghijklmnopqrstuvwxyz');
select count(*) as "短い token（0が正しい）" from public.booking_page('short');

\echo ''
\echo '── ② 証明が無ければ、連携の暗号文は返らない ──'
select count(*) as "証明なし（0が正しい）" from public.booking_for_confirm(:'tok', '');
select count(*) as "違う証明（0が正しい）" from public.booking_for_confirm(:'tok', 'proof-ng');
select count(*) as "期限切れ（0が正しい）" from public.booking_for_confirm('old_0123456789abcdefghijklmnopqrstuvwxyz', 'proof-ok');
select organizer_name, contact_name, (access_token is not null) as "暗号文が来る（t が正しい）"
  from public.booking_for_confirm(:'tok', 'proof-ok');

\echo ''
\echo '── ③ 予約の表（booking_links）は、お客さまからは直接読めない（エラーか0が正しい）──'
select count(*) as "0が正しい" from public.booking_links;
select count(*) as "連携の表も（0が正しい）" from public.integrations;

\echo ''
\echo '── ④ 確定：違う証明・候補にない時刻はエラーになるのが正しい ──'
select public.confirm_booking(:'tok', 'proof-ng', :'slot1', '打合せ', '', 'gcal-1');
select public.confirm_booking(:'tok', 'proof-ok', :'slot1'::timestamptz + interval '30 minutes', '打合せ', '', 'gcal-1');

\echo ''
\echo '── ⑤ 確定できる。2回目はエラーになるのが正しい ──'
select public.confirm_booking(:'tok', 'proof-ok', :'slot1', '株式会社テスト 打合せ', 'https://meet.google.com/abc', 'gcal-1') is not null as "確定（t が正しい）";
select public.confirm_booking(:'tok', 'proof-ok', :'slot2', '二度目', '', 'gcal-2');
select state as "confirmed が正しい", confirmed_start = :'slot1'::timestamptz as "時刻（t が正しい）"
  from public.booking_page(:'tok');
select count(*) as "確定したら暗号文は返らない（0が正しい）" from public.booking_for_confirm(:'tok', 'proof-ok');

-- ── はるに戻って、書き込まれたものを見る ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑥ 打合せ・準備タスク・チャンネルへの知らせができている ──'
select title, format, meet_url, gcal_event_id, starts_at = :'slot1'::timestamptz as "時刻（t）"
  from public.events where gcal_event_id = 'gcal-1';
select title, priority, assignee_id = :'haru' as "担当ははる（t）",
       (due_at at time zone 'Asia/Tokyo')::date = ((:'slot1'::timestamptz at time zone 'Asia/Tokyo')::date - 1) as "前日（t）"
  from public.tasks where title like '打合せの準備：%';
select count(*) as "チャンネルの知らせ（1が正しい）" from public.messages
 where is_system and text like '%予約ページから%';

reset role;
\echo ''
\echo '── ⑦ 関数の公開範囲 ──'
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('booking_page','booking_for_confirm','confirm_booking','guard_member_update')
 order by 1;
