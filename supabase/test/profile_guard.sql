-- ═══════════════════════════════════════════════════════════
-- 022 の確認：メンバーの行の見張りと、プロフィールの設定。
-- わざと失敗させるものがあるので ON_ERROR_STOP は掛けない。
-- ═══════════════════════════════════════════════════════════
\pset footer off
reset role;
select id as ws from public.workspaces where slug = 'orinami' \gset
select id as betsu from public.workspaces where slug = 'betsu' \gset
select id as staff from public.workspace_members where workspace_id = :'ws' and email = 'staff@example-orinami.jp' \gset

-- ── ひら社員として ──
select set_config('request.jwt.claims', json_build_object(
  'sub','33333333-3333-3333-3333-333333333333','email','staff@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;

\echo '── ① 自分の表示名・ひとこと・見せ方・署名は変えられる ──'
update public.workspace_members
   set name = 'ひら社員（営業）', note = 'よろしく', task_view = 'assignee', signature = '営業部 ひら'
 where id = :'staff';
select name, note, task_view, signature from public.workspace_members where id = :'staff';

\echo ''
\echo '── ② 自分を管理者にする → エラーになるのが正しい ──'
update public.workspace_members set is_admin = true where id = :'staff';

\echo ''
\echo '── ③ 別の会社のワークスペースへ移る → エラーになるのが正しい ──'
update public.workspace_members set workspace_id = :'betsu' where id = :'staff';

\echo ''
\echo '── ④ メールの書き換え・状態の書き換え → エラーになるのが正しい ──'
update public.workspace_members set email = 'boss@example-orinami.jp' where id = :'staff';
update public.workspace_members set status = 'invited' where id = :'staff';

\echo ''
\echo '── ⑤ 見せ方に知らない値 → エラーになるのが正しい ──'
update public.workspace_members set task_view = 'random' where id = :'staff';

\echo ''
\echo '── ⑥ 大きすぎる写真 → エラーになるのが正しい ──'
update public.workspace_members
   set avatar = jsonb_build_object('kind','photo','src', 'data:image/jpeg;base64,' || repeat('A', 210000))
 where id = :'staff';

reset role;
\echo ''
\echo '── ⑦ ひら社員はまだ管理者ではなく、orinami にいる ──'
select is_admin as "f が正しい", (workspace_id = :'ws') as "t が正しい", status as "active が正しい", email
  from public.workspace_members where id = :'staff';

-- ── 管理者（はる）として ──
select set_config('request.jwt.claims', json_build_object(
  'sub','11111111-1111-1111-1111-111111111111','email','haru@example-orinami.jp','role','authenticated')::text, false) \gset _
set role authenticated;
\echo ''
\echo '── ⑧ 管理者は、ほかのメンバーを管理者にできる（そして戻す）──'
update public.workspace_members set is_admin = true where id = :'staff';
select is_admin as "t が正しい" from public.workspace_members where id = :'staff';
update public.workspace_members set is_admin = false where id = :'staff';
\echo '管理者でも、ワークスペースの移動はできない（エラーが正しい）:'
update public.workspace_members set workspace_id = :'betsu' where id = :'staff';
reset role;
