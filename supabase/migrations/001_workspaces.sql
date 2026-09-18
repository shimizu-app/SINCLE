-- ═══════════════════════════════════════════════════════════
-- 001 ワークスペース / メンバー / 参加 / ステージ
-- RLS はテーブル作成直後に有効化する（SPEC 0章）
--
-- 順序に注意：Postgres は関数本体を作成時に検証するため
-- 「テーブル → ヘルパー関数 → ポリシー」の順で書く。
-- ═══════════════════════════════════════════════════════════

-- ── テーブル ──────────────────────────────────────────────

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,                                -- 同ドメイン参加の判定用
  open_join boolean not null default false,   -- 同ドメインなら承認なしで参加可
  color text not null default 'purple',
  shape text not null default 'flower',
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,  -- ログイン前は null
  email text not null,
  name text not null,
  role text not null default 'メンバー',
  is_admin boolean not null default false,
  status text not null default 'invited',     -- invited | active
  note text,                                  -- ひとこと
  avatar jsonb not null default '{"kind":"shape","shape":"flower","color":"purple"}',
  cover jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, email),
  constraint workspace_members_status_check check (status in ('invited', 'active'))
);
create index on public.workspace_members (workspace_id, status);
create index on public.workspace_members (user_id);
create index on public.workspace_members (lower(email));
alter table public.workspace_members enable row level security;

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  name text,
  via text not null,                          -- 'domain' | 'link'
  created_at timestamptz not null default now(),
  unique (workspace_id, email),
  constraint join_requests_via_check check (via in ('domain', 'link'))
);
alter table public.join_requests enable row level security;

create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token text not null unique,                 -- 32文字以上のランダム
  expires_at timestamptz not null,
  max_uses int not null default 10,
  uses int not null default 0,
  created_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_links_token_len check (char_length(token) >= 32)
);
alter table public.invite_links enable row level security;

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  position int not null
);
create index on public.stages (workspace_id, position);
alter table public.stages enable row level security;

-- ── 所属判定のヘルパー ────────────────────────────────────
-- security definer なので RLS を迂回する。
-- workspace_members 自身のポリシーから呼んでも再帰しない。

create or replace function public.is_member(ws uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_ws_admin(ws uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and status = 'active'
      and is_admin
  );
$$;

-- 自分の workspace_members.id（画面側で author_id / assignee_id に使う）
create or replace function public.my_member_id(ws uuid)
returns uuid language sql security definer stable
set search_path = '' as $$
  select id from public.workspace_members
  where workspace_id = ws
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- ── ポリシー ──────────────────────────────────────────────

-- workspaces: insert は create_workspace() 経由のみ（010）。直接の insert は許可しない。
create policy "所属メンバーは参照できる" on public.workspaces
  for select using (public.is_member(id));
create policy "管理者は更新できる" on public.workspaces
  for update using (public.is_ws_admin(id)) with check (public.is_ws_admin(id));
create policy "管理者は削除できる" on public.workspaces
  for delete using (public.is_ws_admin(id));

create policy "所属メンバーは参照できる" on public.workspace_members
  for select using (public.is_member(workspace_id));
create policy "管理者はメンバーを登録できる" on public.workspace_members
  for insert with check (public.is_ws_admin(workspace_id));
create policy "管理者は更新できる" on public.workspace_members
  for update using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));
create policy "自分の行は更新できる" on public.workspace_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "管理者は削除できる" on public.workspace_members
  for delete using (public.is_ws_admin(workspace_id));

-- join_requests: 参照・更新・削除は管理者のみ。作成は本人のみ。
create policy "管理者は参照できる" on public.join_requests
  for select using (public.is_ws_admin(workspace_id));
create policy "本人は申請できる" on public.join_requests
  for insert with check (
    auth.uid() is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "管理者は更新できる" on public.join_requests
  for update using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));
create policy "管理者は削除できる" on public.join_requests
  for delete using (public.is_ws_admin(workspace_id));

-- invite_links: トークン検証は join_via_invite() 経由（010）。直読みは管理者のみ。
create policy "管理者は参照できる" on public.invite_links
  for select using (public.is_ws_admin(workspace_id));
create policy "管理者は作成できる" on public.invite_links
  for insert with check (public.is_ws_admin(workspace_id));
create policy "管理者は更新できる" on public.invite_links
  for update using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));
create policy "管理者は削除できる" on public.invite_links
  for delete using (public.is_ws_admin(workspace_id));

create policy "所属メンバーは参照できる" on public.stages
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.stages
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.stages
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.stages
  for delete using (public.is_member(workspace_id));
