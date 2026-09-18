-- ═══════════════════════════════════════════════════════════
-- 009 外部連携のトークン
-- 本人のみ。access_token はクライアントに返さない（DATABASE.md）
-- ═══════════════════════════════════════════════════════════

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  provider text not null,                     -- 'google'
  access_token text not null,                 -- 暗号化して保存する
  refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  gmail_scope text not null default 'registered',  -- registered | domain | all
  calendar_ids jsonb not null default '[]',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, member_id, provider),
  constraint integrations_gmail_scope_check check (gmail_scope in ('registered','domain','all'))
);

alter table public.integrations enable row level security;

-- 直接の select は誰にも許可しない（トークンが漏れるため）。
-- 画面には下の integration_status ビューを使う。
create policy "本人のみ作成できる" on public.integrations
  for insert with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ更新できる" on public.integrations
  for update using (member_id = public.my_member_id(workspace_id))
             with check (member_id = public.my_member_id(workspace_id));
create policy "本人のみ削除できる" on public.integrations
  for delete using (member_id = public.my_member_id(workspace_id));

-- 連携済みかどうかだけを返す。トークンは含めない。
create or replace function public.integration_status()
returns table (
  workspace_id uuid,
  provider text,
  scopes text[],
  gmail_scope text,
  calendar_ids jsonb,
  expires_at timestamptz,
  last_sync_at timestamptz
) language sql security definer stable
set search_path = '' as $$
  select i.workspace_id, i.provider, i.scopes, i.gmail_scope,
         i.calendar_ids, i.expires_at, i.last_sync_at
  from public.integrations i
  join public.workspace_members m on m.id = i.member_id
  where m.user_id = auth.uid();
$$;

revoke execute on function public.integration_status() from public;
grant execute on function public.integration_status() to authenticated;
