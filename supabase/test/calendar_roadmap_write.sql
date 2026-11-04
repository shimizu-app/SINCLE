-- 別の会社の人が、よそのワークスペースに連携を書き込もうとする。
-- わざと失敗させるので ON_ERROR_STOP は掛けない。
\pset footer off
reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select set_config('request.jwt.claims', json_build_object(
  'sub','22222222-2222-2222-2222-222222222222','email','other@example-corp.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo 'よそのワークスペースに save_integration → エラーになるのが正しい:'
select public.save_integration(:'ws', 'google', 'v1.evil', 'v1.evil', now(), '{}', 'evil@example.com');

-- ── 本人に戻って、まだ残っているか（ひら社員の delete で消えていないか）──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑦ 他人の delete では消えず、本人の delete で消える ──'
select count(*) as "まだ残っている（1が正しい）" from public.my_integration(:'ws', 'google');
select public.delete_integration(:'ws', 'google') \gset _
select count(*) as "本人が消した後（0が正しい）" from public.my_integration(:'ws', 'google');

\echo ''
\echo '── ⑧ 計画：議題・やること・チャンネル ──'
insert into public.agenda_items (workspace_id, dept, year, month, title, participants)
values (:'ws', 'sales', 2026, 11, '来期の重点業種をどこにするか',
        array[(select id from public.workspace_members where email = 'haru@example-orinami.jp')]);
select id as agenda from public.agenda_items where title = '来期の重点業種をどこにするか' \gset
insert into public.agenda_actions (agenda_item_id, text, position) values (:'agenda', '過去の受注を業種別に集計する', 0);
update public.agenda_actions set done = true where agenda_item_id = :'agenda';
update public.agenda_items set state = 'decided', decision = '製造業に絞る', decided_at = current_date where id = :'agenda';
select public.create_group_channel(:'ws', '議題：来期の重点業種', 'flower', 'red',
  array[(select id from public.workspace_members where email = 'haru@example-orinami.jp')]) as ch \gset
update public.agenda_items set channel_id = :'ch' where id = :'agenda';
select a.state, a.decision, (a.channel_id is not null) as "チャンネルを覚えた",
       (select count(*) from public.agenda_actions x where x.agenda_item_id = a.id and x.done) as "終わったやること"
  from public.agenda_items a where a.id = :'agenda';

-- ── 別の会社の人からは計画が見えない ──
reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub','22222222-2222-2222-2222-222222222222','email','other@example-corp.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑨ 別の会社の人から計画は見えない（0が正しい）──'
select
  (select count(*) from public.agenda_items)   as "議題",
  (select count(*) from public.agenda_actions) as "やること";
