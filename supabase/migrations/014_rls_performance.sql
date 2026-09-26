-- ═══════════════════════════════════════════════════════════
-- 014 RLS の評価回数を減らす
--
-- これまでのポリシーは using (public.is_member(workspace_id)) で、
-- 引数が列なので相関サブクエリ扱いになり、行ごとに関数が呼ばれていた。
-- is_member は security definer なので Postgres がインライン展開できず、
-- 1行ごとに workspace_members を引きに行っていた。
--
-- 所属ワークスペースの一覧を「引数なしの関数」で返すようにすると、
-- workspace_id in (select public.my_workspace_ids()) は相関がなくなり、
-- 文の実行ごとに1回だけ評価される（InitPlan）。
--
-- 出どころ: .agents/skills/supabase-postgres-best-practices/
--           references/security-rls-performance.md（impact: HIGH）
-- ═══════════════════════════════════════════════════════════

-- ── 引数なしのヘルパー（相関しない） ──────────────────────
-- auth.uid() も (select auth.uid()) で包む。同じ理由。

create or replace function public.my_workspace_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select workspace_id from public.workspace_members
  where user_id = (select auth.uid()) and status = 'active';
$$;

create or replace function public.my_admin_workspace_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select workspace_id from public.workspace_members
  where user_id = (select auth.uid()) and status = 'active' and is_admin;
$$;

/** 自分の workspace_members.id（複数ワークスペースぶん） */
create or replace function public.my_member_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select id from public.workspace_members
  where user_id = (select auth.uid()) and status = 'active';
$$;

/** 自分が参加しているグループチャンネル */
create or replace function public.my_channel_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select cm.channel_id from public.channel_members cm
  where cm.member_id in (
    select id from public.workspace_members
    where user_id = (select auth.uid()) and status = 'active'
  );
$$;

/** 自分が当事者の DM スレッド */
create or replace function public.my_dm_thread_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  with me as (
    select id from public.workspace_members
    where user_id = (select auth.uid()) and status = 'active'
  )
  select t.id from public.dm_threads t
  where t.member_a in (select id from me) or t.member_b in (select id from me);
$$;

-- 既存のヘルパーも (select auth.uid()) に揃えておく。
-- 単発で呼ぶぶんには変わらないが、ポリシーに残っている箇所で効く。
create or replace function public.is_member(ws uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.is_ws_admin(ws uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = (select auth.uid())
      and status = 'active'
      and is_admin
  );
$$;

create or replace function public.my_member_id(ws uuid)
returns uuid language sql security definer stable
set search_path = '' as $$
  select id from public.workspace_members
  where workspace_id = ws
    and user_id = (select auth.uid())
    and status = 'active'
  limit 1;
$$;

revoke execute on function
  public.my_workspace_ids(), public.my_admin_workspace_ids(),
  public.my_member_ids(), public.my_channel_ids(), public.my_dm_thread_ids()
from public;

grant execute on function
  public.my_workspace_ids(), public.my_admin_workspace_ids(),
  public.my_member_ids(), public.my_channel_ids(), public.my_dm_thread_ids()
to authenticated;

-- ── ポリシーの貼り替え ────────────────────────────────────
-- workspace_id を持つテーブルは機械的に同じ形になるので、まとめて作る。

do $$
declare
  t text;
  ws_tables text[] := array[
    'stages', 'companies', 'contacts', 'deals',
    'tasks', 'personal_todos',
    'channels', 'messages', 'dm_threads', 'dm_messages',
    'mails', 'events', 'booking_links',
    'documents', 'memos',
    'key_persons', 'referrals',
    'agenda_items', 'integrations'
  ];
begin
  foreach t in array ws_tables loop
    -- 既存のポリシーを落とす（名前は 001〜009 で付けたもの）
    execute format('drop policy if exists "所属メンバーは参照できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは作成できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは更新できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは削除できる" on public.%I', t);
  end loop;
end $$;

-- 一般のテーブル：所属ワークスペースなら読み書きできる
do $$
declare
  t text;
  plain_tables text[] := array[
    'stages', 'companies', 'contacts', 'deals', 'tasks',
    'channels', 'mails', 'events', 'booking_links',
    'documents', 'key_persons', 'referrals', 'agenda_items'
  ];
begin
  foreach t in array plain_tables loop
    execute format($f$
      create policy "所属メンバーは参照できる" on public.%I
        for select using (workspace_id in (select public.my_workspace_ids()));
      $f$, t);
    execute format($f$
      create policy "所属メンバーは作成できる" on public.%I
        for insert with check (workspace_id in (select public.my_workspace_ids()));
      $f$, t);
    execute format($f$
      create policy "所属メンバーは更新できる" on public.%I
        for update using (workspace_id in (select public.my_workspace_ids()))
                   with check (workspace_id in (select public.my_workspace_ids()));
      $f$, t);
    execute format($f$
      create policy "所属メンバーは削除できる" on public.%I
        for delete using (workspace_id in (select public.my_workspace_ids()));
      $f$, t);
  end loop;
end $$;

-- ── 本人のみのテーブル ────────────────────────────────────
-- 何度流しても同じ結果になるよう、作る前に必ず落とす。

drop policy if exists "本人のみ参照できる" on public.personal_todos;
drop policy if exists "本人のみ作成できる" on public.personal_todos;
drop policy if exists "本人のみ更新できる" on public.personal_todos;
drop policy if exists "本人のみ削除できる" on public.personal_todos;

create policy "本人のみ参照できる" on public.personal_todos
  for select using (member_id in (select public.my_member_ids()));
create policy "本人のみ作成できる" on public.personal_todos
  for insert with check (member_id in (select public.my_member_ids()));
create policy "本人のみ更新できる" on public.personal_todos
  for update using (member_id in (select public.my_member_ids()))
             with check (member_id in (select public.my_member_ids()));
create policy "本人のみ削除できる" on public.personal_todos
  for delete using (member_id in (select public.my_member_ids()));

drop policy if exists "本人のみ参照できる" on public.memos;
drop policy if exists "本人のみ作成できる" on public.memos;
drop policy if exists "本人のみ更新できる" on public.memos;
drop policy if exists "本人のみ削除できる" on public.memos;

create policy "本人のみ参照できる" on public.memos
  for select using (member_id in (select public.my_member_ids()));
create policy "本人のみ作成できる" on public.memos
  for insert with check (member_id in (select public.my_member_ids()));
create policy "本人のみ更新できる" on public.memos
  for update using (member_id in (select public.my_member_ids()))
             with check (member_id in (select public.my_member_ids()));
create policy "本人のみ削除できる" on public.memos
  for delete using (member_id in (select public.my_member_ids()));

drop policy if exists "本人のみ作成できる" on public.integrations;
drop policy if exists "本人のみ更新できる" on public.integrations;
drop policy if exists "本人のみ削除できる" on public.integrations;

create policy "本人のみ作成できる" on public.integrations
  for insert with check (member_id in (select public.my_member_ids()));
create policy "本人のみ更新できる" on public.integrations
  for update using (member_id in (select public.my_member_ids()))
             with check (member_id in (select public.my_member_ids()));
create policy "本人のみ削除できる" on public.integrations
  for delete using (member_id in (select public.my_member_ids()));

-- ── workspaces ────────────────────────────────────────────

drop policy if exists "所属メンバーは参照できる" on public.workspaces;
drop policy if exists "管理者は更新できる" on public.workspaces;
drop policy if exists "管理者は削除できる" on public.workspaces;

create policy "所属メンバーは参照できる" on public.workspaces
  for select using (id in (select public.my_workspace_ids()));
create policy "管理者は更新できる" on public.workspaces
  for update using (id in (select public.my_admin_workspace_ids()))
             with check (id in (select public.my_admin_workspace_ids()));
create policy "管理者は削除できる" on public.workspaces
  for delete using (id in (select public.my_admin_workspace_ids()));

-- ── workspace_members ─────────────────────────────────────

drop policy if exists "所属メンバーは参照できる" on public.workspace_members;
drop policy if exists "管理者はメンバーを登録できる" on public.workspace_members;
drop policy if exists "管理者は更新できる" on public.workspace_members;
drop policy if exists "自分の行は更新できる" on public.workspace_members;
drop policy if exists "管理者は削除できる" on public.workspace_members;

create policy "所属メンバーは参照できる" on public.workspace_members
  for select using (workspace_id in (select public.my_workspace_ids()));
create policy "管理者はメンバーを登録できる" on public.workspace_members
  for insert with check (workspace_id in (select public.my_admin_workspace_ids()));
create policy "管理者は更新できる" on public.workspace_members
  for update using (workspace_id in (select public.my_admin_workspace_ids()))
             with check (workspace_id in (select public.my_admin_workspace_ids()));
create policy "自分の行は更新できる" on public.workspace_members
  for update using (user_id = (select auth.uid()))
             with check (user_id = (select auth.uid()));
create policy "管理者は削除できる" on public.workspace_members
  for delete using (workspace_id in (select public.my_admin_workspace_ids()));

-- ── 管理者のみのテーブル ──────────────────────────────────

do $$
declare
  t text;
  admin_tables text[] := array['join_requests', 'invite_links'];
begin
  foreach t in array admin_tables loop
    execute format('drop policy if exists "管理者は参照できる" on public.%I', t);
    execute format('drop policy if exists "管理者は作成できる" on public.%I', t);
    execute format('drop policy if exists "管理者は更新できる" on public.%I', t);
    execute format('drop policy if exists "管理者は削除できる" on public.%I', t);

    execute format($f$
      create policy "管理者は参照できる" on public.%I
        for select using (workspace_id in (select public.my_admin_workspace_ids()));
      $f$, t);
    execute format($f$
      create policy "管理者は更新できる" on public.%I
        for update using (workspace_id in (select public.my_admin_workspace_ids()))
                   with check (workspace_id in (select public.my_admin_workspace_ids()));
      $f$, t);
    execute format($f$
      create policy "管理者は削除できる" on public.%I
        for delete using (workspace_id in (select public.my_admin_workspace_ids()));
      $f$, t);
  end loop;
end $$;

create policy "管理者は作成できる" on public.invite_links
  for insert with check (workspace_id in (select public.my_admin_workspace_ids()));

-- join_requests の作成は本人のみ（管理者でなくても申請できる必要がある）
drop policy if exists "本人は申請できる" on public.join_requests;
create policy "本人は申請できる" on public.join_requests
  for insert with check (
    (select auth.uid()) is not null
    and lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

-- ── 親をたどるテーブル ────────────────────────────────────

drop policy if exists "親タスクが見えるなら参照できる" on public.subtasks;
drop policy if exists "親タスクが見えるなら作成できる" on public.subtasks;
drop policy if exists "親タスクが見えるなら更新できる" on public.subtasks;
drop policy if exists "親タスクが見えるなら削除できる" on public.subtasks;

create policy "親タスクが見えるなら参照できる" on public.subtasks
  for select using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親タスクが見えるなら作成できる" on public.subtasks
  for insert with check (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親タスクが見えるなら更新できる" on public.subtasks
  for update using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親タスクが見えるなら削除できる" on public.subtasks
  for delete using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.workspace_id in (select public.my_workspace_ids())
  ));

drop policy if exists "親議題が見えるなら参照できる" on public.agenda_actions;
drop policy if exists "親議題が見えるなら作成できる" on public.agenda_actions;
drop policy if exists "親議題が見えるなら更新できる" on public.agenda_actions;
drop policy if exists "親議題が見えるなら削除できる" on public.agenda_actions;

create policy "親議題が見えるなら参照できる" on public.agenda_actions
  for select using (exists (
    select 1 from public.agenda_items a
    where a.id = agenda_item_id and a.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親議題が見えるなら作成できる" on public.agenda_actions
  for insert with check (exists (
    select 1 from public.agenda_items a
    where a.id = agenda_item_id and a.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親議題が見えるなら更新できる" on public.agenda_actions
  for update using (exists (
    select 1 from public.agenda_items a
    where a.id = agenda_item_id and a.workspace_id in (select public.my_workspace_ids())
  ));
create policy "親議題が見えるなら削除できる" on public.agenda_actions
  for delete using (exists (
    select 1 from public.agenda_items a
    where a.id = agenda_item_id and a.workspace_id in (select public.my_workspace_ids())
  ));

-- ── channel_members ───────────────────────────────────────

drop policy if exists "所属メンバーは参照できる" on public.channel_members;
drop policy if exists "所属メンバーは追加できる" on public.channel_members;
drop policy if exists "所属メンバーは更新できる" on public.channel_members;
drop policy if exists "所属メンバーは削除できる" on public.channel_members;

create policy "所属メンバーは参照できる" on public.channel_members
  for select using (exists (
    select 1 from public.channels c
    where c.id = channel_id and c.workspace_id in (select public.my_workspace_ids())
  ));
create policy "所属メンバーは追加できる" on public.channel_members
  for insert with check (exists (
    select 1 from public.channels c
    where c.id = channel_id and c.workspace_id in (select public.my_workspace_ids())
  ));
create policy "所属メンバーは更新できる" on public.channel_members
  for update using (exists (
    select 1 from public.channels c
    where c.id = channel_id and c.workspace_id in (select public.my_workspace_ids())
  ));
create policy "所属メンバーは削除できる" on public.channel_members
  for delete using (exists (
    select 1 from public.channels c
    where c.id = channel_id and c.workspace_id in (select public.my_workspace_ids())
  ));

-- ── messages ──────────────────────────────────────────────
-- 会社チャンネルは所属メンバー全員、グループは参加者のみ。

drop policy if exists "読めるチャンネルのメッセージは参照できる" on public.messages;
drop policy if exists "読めるチャンネルには投稿できる" on public.messages;
drop policy if exists "自分の発言は更新できる" on public.messages;
drop policy if exists "自分の発言は削除できる" on public.messages;

create policy "読めるチャンネルのメッセージは参照できる" on public.messages
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      channel_id in (select public.my_channel_ids())
      or exists (select 1 from public.channels c where c.id = channel_id and c.kind = 'company')
    )
  );
create policy "読めるチャンネルには投稿できる" on public.messages
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      channel_id in (select public.my_channel_ids())
      or exists (select 1 from public.channels c where c.id = channel_id and c.kind = 'company')
    )
  );
create policy "自分の発言は更新できる" on public.messages
  for update using (author_id in (select public.my_member_ids()))
             with check (author_id in (select public.my_member_ids()));
create policy "自分の発言は削除できる" on public.messages
  for delete using (author_id in (select public.my_member_ids()));

-- ── DM ────────────────────────────────────────────────────

drop policy if exists "当事者のみ参照できる" on public.dm_threads;
drop policy if exists "当事者のみ作成できる" on public.dm_threads;
drop policy if exists "当事者のみ削除できる" on public.dm_threads;

create policy "当事者のみ参照できる" on public.dm_threads
  for select using (
    member_a in (select public.my_member_ids())
    or member_b in (select public.my_member_ids())
  );
create policy "当事者のみ作成できる" on public.dm_threads
  for insert with check (
    member_a in (select public.my_member_ids())
    or member_b in (select public.my_member_ids())
  );
create policy "当事者のみ削除できる" on public.dm_threads
  for delete using (
    member_a in (select public.my_member_ids())
    or member_b in (select public.my_member_ids())
  );

drop policy if exists "当事者のみ参照できる" on public.dm_messages;
drop policy if exists "当事者のみ投稿できる" on public.dm_messages;
drop policy if exists "当事者のみ更新できる" on public.dm_messages;
drop policy if exists "自分の発言は削除できる" on public.dm_messages;

create policy "当事者のみ参照できる" on public.dm_messages
  for select using (thread_id in (select public.my_dm_thread_ids()));
create policy "当事者のみ投稿できる" on public.dm_messages
  for insert with check (
    thread_id in (select public.my_dm_thread_ids())
    and author_id in (select public.my_member_ids())
  );
create policy "当事者のみ更新できる" on public.dm_messages
  for update using (thread_id in (select public.my_dm_thread_ids()));
create policy "自分の発言は削除できる" on public.dm_messages
  for delete using (author_id in (select public.my_member_ids()));

-- ── ポリシーで引く列に索引を足す ──────────────────────────
-- RLS の条件に使う列は必ず索引を張る（skill の指摘）。

create index if not exists workspace_members_user_status_idx
  on public.workspace_members (user_id, status) include (workspace_id, id, is_admin);
create index if not exists channel_members_member_channel_idx
  on public.channel_members (member_id, channel_id);
create index if not exists dm_threads_members_idx
  on public.dm_threads (member_a, member_b);
create index if not exists messages_workspace_idx
  on public.messages (workspace_id);
create index if not exists dm_messages_author_idx
  on public.dm_messages (author_id);
