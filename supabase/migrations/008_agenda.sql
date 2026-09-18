-- ═══════════════════════════════════════════════════════════
-- 008 計画（ロードマップ）の議題とやること
-- ═══════════════════════════════════════════════════════════

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dept text not null,                         -- sales | is | cs | dev
  year int not null,
  month int not null,
  title text not null,
  state text not null default 'todo',         -- decided | talking | todo
  decision text,
  decided_at date,
  scheduled_text text,                        -- 「8/12（火）14:00 に話す」
  participants uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint agenda_items_state_check check (state in ('decided','talking','todo')),
  constraint agenda_items_month_check check (month between 1 and 12)
);
create index on public.agenda_items (workspace_id, year, month, dept);

alter table public.agenda_items enable row level security;

create policy "所属メンバーは参照できる" on public.agenda_items
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.agenda_items
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.agenda_items
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.agenda_items
  for delete using (public.is_member(workspace_id));

create table public.agenda_actions (
  id uuid primary key default gen_random_uuid(),
  agenda_item_id uuid not null references public.agenda_items(id) on delete cascade,
  text text not null,
  assignee_id uuid references public.workspace_members(id) on delete set null,
  done boolean not null default false,
  position int not null default 0
);
create index on public.agenda_actions (agenda_item_id, position);

alter table public.agenda_actions enable row level security;

create policy "親議題が見えるなら参照できる" on public.agenda_actions
  for select using (exists (
    select 1 from public.agenda_items a where a.id = agenda_item_id and public.is_member(a.workspace_id)
  ));
create policy "親議題が見えるなら作成できる" on public.agenda_actions
  for insert with check (exists (
    select 1 from public.agenda_items a where a.id = agenda_item_id and public.is_member(a.workspace_id)
  ));
create policy "親議題が見えるなら更新できる" on public.agenda_actions
  for update using (exists (
    select 1 from public.agenda_items a where a.id = agenda_item_id and public.is_member(a.workspace_id)
  ));
create policy "親議題が見えるなら削除できる" on public.agenda_actions
  for delete using (exists (
    select 1 from public.agenda_items a where a.id = agenda_item_id and public.is_member(a.workspace_id)
  ));
