-- ═══════════════════════════════════════════════════════════
-- 007 キーパーソン / 紹介の記録
-- ═══════════════════════════════════════════════════════════

create table public.key_persons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,  -- 名刺から作った場合
  name text not null,
  kana text,
  company_name text,                          -- 顧客でない場合もあるので文字列で持つ
  title text,
  genre text not null default 'other',
  sub_genres text[] not null default '{}',
  layers text[] not null default '{}',
    -- bigexec | smeexec | manager | academia | public | finance | media | community
  scope text not null default 'pref',         -- national | region | pref
  pref text,
  city text,
  met text,                                   -- 出会いのきっかけ
  about text,
  network text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint key_persons_genre_check check (genre in (
    'it','maker','food','medical','retail','ad','finance','logistics','public','other'
  )),
  constraint key_persons_scope_check check (scope in ('national','region','pref'))
);
create index on public.key_persons (workspace_id, genre);
create index on public.key_persons (workspace_id, scope);
create index on public.key_persons using gin (layers);
create index on public.key_persons using gin (sub_genres);

alter table public.key_persons enable row level security;

create policy "所属メンバーは参照できる" on public.key_persons
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.key_persons
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.key_persons
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.key_persons
  for delete using (public.is_member(workspace_id));

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key_person_id uuid not null references public.key_persons(id) on delete cascade,
  to_name text not null,                      -- 紹介先
  to_company_id uuid references public.companies(id) on delete set null,
  result text not null default '初回接触',
  happened_at date,
  created_at timestamptz not null default now()
);
create index on public.referrals (key_person_id, happened_at desc);

alter table public.referrals enable row level security;

create policy "所属メンバーは参照できる" on public.referrals
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.referrals
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.referrals
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.referrals
  for delete using (public.is_member(workspace_id));
