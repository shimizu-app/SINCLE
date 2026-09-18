-- ═══════════════════════════════════════════════════════════
-- 004 チャンネル / メッセージ / 個人チャット（DM）
-- テーブル → 関数 → ポリシー の順（関数本体は作成時に検証されるため）
-- ═══════════════════════════════════════════════════════════

-- ── テーブル ──────────────────────────────────────────────

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,                         -- 'company' | 'group'
  company_id uuid references public.companies(id) on delete cascade,
  name text,                                  -- group のとき使う
  shape text default 'flower',
  color text default 'purple',
  created_at timestamptz not null default now(),
  constraint channels_kind_check check (kind in ('company','group')),
  constraint channels_shape_check check (
    (kind = 'company' and company_id is not null) or
    (kind = 'group'   and name is not null)
  )
);
create index on public.channels (workspace_id, kind);
create unique index channels_one_per_company on public.channels (company_id)
  where kind = 'company';
alter table public.channels enable row level security;

create table public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  last_read_at timestamptz,
  primary key (channel_id, member_id)
);
create index on public.channel_members (member_id);
alter table public.channel_members enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid references public.workspace_members(id) on delete set null,  -- system は null
  text text not null,
  is_system boolean not null default false,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.messages (channel_id, created_at desc);
alter table public.messages enable row level security;

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_a uuid not null references public.workspace_members(id) on delete cascade,
  member_b uuid not null references public.workspace_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, member_a, member_b),
  -- member_a < member_b の順で保存する（DBレベルで強制）
  constraint dm_threads_ordered check (member_a < member_b)
);
alter table public.dm_threads enable row level security;

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.workspace_members(id) on delete cascade,
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.dm_messages (thread_id, created_at desc);
alter table public.dm_messages enable row level security;

-- ── 関数 ──────────────────────────────────────────────────

-- 会社チャンネルは所属メンバー全員が読める。グループチャンネルは参加者のみ。
create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = p_channel
      and public.is_member(c.workspace_id)
      and (
        c.kind = 'company'
        or exists (
          select 1 from public.channel_members cm
          where cm.channel_id = c.id
            and cm.member_id = public.my_member_id(c.workspace_id)
        )
      )
  );
$$;

-- DM は当事者2人のみ。
create or replace function public.in_dm_thread(p_thread uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread
      and public.my_member_id(t.workspace_id) in (t.member_a, t.member_b)
  );
$$;

-- ── ポリシー ──────────────────────────────────────────────

create policy "所属メンバーは参照できる" on public.channels
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.channels
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.channels
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.channels
  for delete using (public.is_member(workspace_id));

create policy "所属メンバーは参照できる" on public.channel_members
  for select using (exists (
    select 1 from public.channels c where c.id = channel_id and public.is_member(c.workspace_id)
  ));
create policy "所属メンバーは追加できる" on public.channel_members
  for insert with check (exists (
    select 1 from public.channels c where c.id = channel_id and public.is_member(c.workspace_id)
  ));
create policy "所属メンバーは更新できる" on public.channel_members
  for update using (exists (
    select 1 from public.channels c where c.id = channel_id and public.is_member(c.workspace_id)
  ));
create policy "所属メンバーは削除できる" on public.channel_members
  for delete using (exists (
    select 1 from public.channels c where c.id = channel_id and public.is_member(c.workspace_id)
  ));

create policy "読めるチャンネルのメッセージは参照できる" on public.messages
  for select using (public.can_read_channel(channel_id));
create policy "読めるチャンネルには投稿できる" on public.messages
  for insert with check (
    public.can_read_channel(channel_id) and public.is_member(workspace_id)
  );
create policy "自分の発言は更新できる" on public.messages
  for update using (author_id = public.my_member_id(workspace_id))
             with check (author_id = public.my_member_id(workspace_id));
create policy "自分の発言は削除できる" on public.messages
  for delete using (author_id = public.my_member_id(workspace_id));

create policy "当事者のみ参照できる" on public.dm_threads
  for select using (public.my_member_id(workspace_id) in (member_a, member_b));
create policy "当事者のみ作成できる" on public.dm_threads
  for insert with check (public.my_member_id(workspace_id) in (member_a, member_b));
create policy "当事者のみ削除できる" on public.dm_threads
  for delete using (public.my_member_id(workspace_id) in (member_a, member_b));

create policy "当事者のみ参照できる" on public.dm_messages
  for select using (public.in_dm_thread(thread_id));
create policy "当事者のみ投稿できる" on public.dm_messages
  for insert with check (
    public.in_dm_thread(thread_id) and author_id = public.my_member_id(workspace_id)
  );
-- 既読（read_at）は相手も更新するため、当事者なら更新可
create policy "当事者のみ更新できる" on public.dm_messages
  for update using (public.in_dm_thread(thread_id));
create policy "自分の発言は削除できる" on public.dm_messages
  for delete using (author_id = public.my_member_id(workspace_id));
