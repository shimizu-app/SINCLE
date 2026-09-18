-- ═══════════════════════════════════════════════════════════
-- 002 会社 / 名刺 / 案件
-- ═══════════════════════════════════════════════════════════

-- ── 共通ユーティリティ ────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 会社名の正規化。lib/design.ts の normalizeCompanyName と同じ規則。
-- 「株式会社アルテック」と「アルテック」を同一とみなすため。
create or replace function public.normalize_company_name(p_name text)
returns text language sql immutable
set search_path = '' as $$
  select regexp_replace(
           regexp_replace(
             coalesce(p_name, ''),
             '株式会社|有限会社|合同会社|\(株\)|（株）|\(有\)|（有）', '', 'g'
           ),
           '\s+', '', 'g'
         );
$$;

create or replace function public.set_name_normalized()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.name_normalized = public.normalize_company_name(new.name);
  return new;
end;
$$;

-- ── companies ─────────────────────────────────────────────

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  name_normalized text not null default '',   -- トリガで自動生成（重複検出用）
  industry text,
  employees int default 0,
  revenue text,
  address text,
  web text,
  tier text,                                  -- 'A' | 'B' | 'C'
  tier_manual text,                           -- 手動上書き
  stage_id uuid references public.stages(id) on delete set null,
  owner_id uuid references public.workspace_members(id) on delete set null,
  primary_contact_id uuid,                    -- 窓口。contacts への FK は循環するのでアプリ側で担保
  deal_type text,
  comment text,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_tier_check check (tier is null or tier in ('A','B','C')),
  constraint companies_tier_manual_check check (tier_manual is null or tier_manual in ('A','B','C'))
);
create index on public.companies (workspace_id, archived_at);
create index on public.companies (workspace_id, name_normalized);
create index on public.companies (workspace_id, owner_id);

create trigger companies_normalize before insert or update of name on public.companies
  for each row execute function public.set_name_normalized();
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;

create policy "所属メンバーは参照できる" on public.companies
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.companies
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.companies
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.companies
  for delete using (public.is_member(workspace_id));

-- ── contacts（名刺） ──────────────────────────────────────

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  dept text,
  title text,
  email text,
  phone text,
  card_image_url text,                        -- 名刺画像（Storage のパス）
  mail_watch boolean not null default true,   -- Gmail 取り込み対象か
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.contacts (workspace_id, email);
create index on public.contacts (company_id, archived_at);

alter table public.contacts enable row level security;

create policy "所属メンバーは参照できる" on public.contacts
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.contacts
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.contacts
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.contacts
  for delete using (public.is_member(workspace_id));

-- ── deals（案件） ─────────────────────────────────────────
-- 当面は1社1案件（SPEC 3章）。並行案件が出たらこの制約を外す。

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  active boolean not null default true,
  status text not null default 'talking',
    -- talking | proposal | quote | working | review | paused
  memo text,
  amount text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  -- 放置判定に使う
  constraint deals_status_check check (
    status in ('talking','proposal','quote','working','review','paused')
  )
);
create index on public.deals (workspace_id, active, updated_at);
-- 1社につき進行中の案件は1件まで
create unique index deals_one_active_per_company
  on public.deals (company_id) where active;

create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

alter table public.deals enable row level security;

create policy "所属メンバーは参照できる" on public.deals
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.deals
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.deals
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.deals
  for delete using (public.is_member(workspace_id));
