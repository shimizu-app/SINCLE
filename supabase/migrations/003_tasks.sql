-- ═══════════════════════════════════════════════════════════
-- 003 タスク / チェックリスト / 個人TODO
-- ═══════════════════════════════════════════════════════════

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  due_at timestamptz,                         -- 時刻なしの場合は日付のみ扱い
  due_has_time boolean not null default false,
  assignee_id uuid references public.workspace_members(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  priority text not null default '中',        -- 高 | 中 | 低
  share text not null default 'assignee',     -- self | assignee | team
  done boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tasks_priority_check check (priority in ('高','中','低')),
  constraint tasks_share_check check (share in ('self','assignee','team'))
);
create index on public.tasks (workspace_id, done, due_at);
create index on public.tasks (company_id, done);
create index on public.tasks (assignee_id, done);

alter table public.tasks enable row level security;

create policy "所属メンバーは参照できる" on public.tasks
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.tasks
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.tasks
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.tasks
  for delete using (public.is_member(workspace_id));

-- ── subtasks ──────────────────────────────────────────────
-- workspace_id を持たないので、親タスク経由で判定する。

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null,
  at timestamptz,
  done boolean not null default false,
  position int not null default 0
);
create index on public.subtasks (task_id, position);

alter table public.subtasks enable row level security;

create policy "親タスクが見えるなら参照できる" on public.subtasks
  for select using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_member(t.workspace_id)
  ));
create policy "親タスクが見えるなら作成できる" on public.subtasks
  for insert with check (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_member(t.workspace_id)
  ));
create policy "親タスクが見えるなら更新できる" on public.subtasks
  for update using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_member(t.workspace_id)
  ));
create policy "親タスクが見えるなら削除できる" on public.subtasks
  for delete using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_member(t.workspace_id)
  ));

-- ── personal_todos ────────────────────────────────────────
-- 本人のみ（DATABASE.md の例外表）

create table public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  due_has_time boolean not null default false,
  priority text not null default '中',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  constraint personal_todos_priority_check check (priority in ('高','中','低'))
);
create index on public.personal_todos (member_id, done, due_at);

alter table public.personal_todos enable row level security;

create policy "本人のみ参照できる" on public.personal_todos
  for select using (member_id = public.my_member_id(workspace_id));
create policy "本人のみ作成できる" on public.personal_todos
  for insert with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ更新できる" on public.personal_todos
  for update using (member_id = public.my_member_id(workspace_id))
             with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ削除できる" on public.personal_todos
  for delete using (member_id = public.my_member_id(workspace_id));
