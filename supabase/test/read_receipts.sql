-- 024 の確認：既読。card_privacy の後に流す。
-- ナカムラ商事（株式会社）は ひら社員 の自分だけの会社。はるの許可は外れている。
\set ON_ERROR_STOP on
\pset footer off

reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select id as haru from public.workspace_members where workspace_id = :'ws' and email = 'haru@example-orinami.jp' \gset
select id as staff from public.workspace_members where workspace_id = :'ws' and email = 'staff@example-orinami.jp' \gset
select id as staff_channel from public.channels where company_id = (select id from public.companies where name = '株式会社ナカムラ商事') \gset
select id as shared_channel from public.channels where company_id = (select id from public.companies where name = 'ミライ精機株式会社') \gset

\echo '── ① 既読の動きは画面に配信される ──'
select count(*) as "channel_members が配信に入っている（1）"
  from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'channel_members';

-- ── はる：許可を付けて、人の会社のチャンネルを開く ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
update public.workspace_members set can_view_all = true where id = :'haru';

select public.mark_channel_read(:'staff_channel') \gset _
\echo ''
\echo '── ② 許可で人の会社のチャンネルを見ても、既読はつかず参加者にも入らない ──'
select count(*) as "はるの行（0）" from public.channel_members
 where channel_id = :'staff_channel' and member_id = :'haru';

update public.workspace_members set can_view_all = false where id = :'haru';

\echo ''
\echo '── ③ 共有の会社のチャンネルは、開くと既読がつく ──'
select public.mark_channel_read(:'shared_channel') \gset _
select last_read_at is not null as "既読の時刻が入る（t）" from public.channel_members
 where channel_id = :'shared_channel' and member_id = :'haru';

-- ── ひら社員：自分の会社のチャンネルを開く ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
select public.mark_channel_read(:'staff_channel') \gset _
\echo ''
\echo '── ④ 自分の会社のチャンネルは既読がつき、だれがどこまで読んだかが見える ──'
select count(*) as "ひら社員の行（1）" from public.channel_members
 where channel_id = :'staff_channel' and member_id = :'staff' and last_read_at is not null;
select count(*) as "共有の会社の既読が見える（1以上）" from public.channel_members
 where channel_id = :'shared_channel' and last_read_at is not null;
