-- ═══════════════════════════════════════════════════════════
-- 006 書類 / メモ
-- ═══════════════════════════════════════════════════════════

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  kind text not null default 'other',
    -- contract | quote | proposal | invoice | spec | other
  storage_path text not null,                 -- Supabase Storage のパス
  size_bytes bigint,
  mime_type text,
  note text,
  pinned boolean not null default false,
  uploaded_by uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint documents_kind_check check (
    kind in ('contract','quote','proposal','invoice','spec','other')
  )
);
create index on public.documents (workspace_id, company_id, kind);
create index on public.documents (company_id, pinned);

alter table public.documents enable row level security;

create policy "所属メンバーは参照できる" on public.documents
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.documents
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.documents
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.documents
  for delete using (public.is_member(workspace_id));

-- ── memos（本人のみ） ─────────────────────────────────────

create table public.memos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  text text not null,
  color text not null default 'yellow',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.memos (member_id, pinned, updated_at desc);

create trigger memos_touch before update on public.memos
  for each row execute function public.touch_updated_at();

alter table public.memos enable row level security;

create policy "本人のみ参照できる" on public.memos
  for select using (member_id = public.my_member_id(workspace_id));
create policy "本人のみ作成できる" on public.memos
  for insert with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ更新できる" on public.memos
  for update using (member_id = public.my_member_id(workspace_id))
             with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ削除できる" on public.memos
  for delete using (member_id = public.my_member_id(workspace_id));
