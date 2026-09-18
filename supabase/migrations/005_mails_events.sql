-- ═══════════════════════════════════════════════════════════
-- 005 メール / 打合せ予定 / 予約ページ
-- ═══════════════════════════════════════════════════════════

create table public.mails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  direction text not null,                    -- 'in' | 'out'
  subject text not null,
  body text,
  excerpt text,
  from_email text,
  to_email text,
  gmail_message_id text,                      -- 重複取り込み防止
  gmail_thread_id text,
  replied boolean not null default false,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, gmail_message_id),
  constraint mails_direction_check check (direction in ('in','out'))
);
create index on public.mails (workspace_id, company_id, sent_at desc);
create index on public.mails (workspace_id, direction, replied);

alter table public.mails enable row level security;

create policy "所属メンバーは参照できる" on public.mails
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.mails
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.mails
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.mails
  for delete using (public.is_member(workspace_id));

-- ── events（打合せ） ──────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  format text not null default 'Google Meet',
  meet_url text,
  gcal_event_id text,
  created_at timestamptz not null default now()
);
create index on public.events (workspace_id, starts_at);
create index on public.events (company_id, starts_at);

alter table public.events enable row level security;

create policy "所属メンバーは参照できる" on public.events
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.events
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.events
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.events
  for delete using (public.is_member(workspace_id));

-- ── booking_links（予約ページ） ───────────────────────────
-- 顧客は未ログインで見るため、参照は get_booking() 経由のみ。

create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique,                 -- 32文字以上のランダム
  slots jsonb not null,                       -- 候補日時の配列
  duration_min int not null default 60,
  format text not null,
  expires_at timestamptz not null,
  confirmed_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint booking_links_token_len check (char_length(token) >= 32)
);

alter table public.booking_links enable row level security;

create policy "所属メンバーは参照できる" on public.booking_links
  for select using (public.is_member(workspace_id));
create policy "所属メンバーは作成できる" on public.booking_links
  for insert with check (public.is_member(workspace_id));
create policy "所属メンバーは更新できる" on public.booking_links
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "所属メンバーは削除できる" on public.booking_links
  for delete using (public.is_member(workspace_id));

-- 未ログインでもトークンで候補を取得できる（DATABASE.md）
create or replace function public.get_booking(p_token text)
returns jsonb language sql security definer stable
set search_path = '' as $$
  select jsonb_build_object(
    'company_name', c.name,
    'slots', b.slots,
    'duration_min', b.duration_min,
    'format', b.format,
    'confirmed', b.confirmed_event_id is not null
  )
  from public.booking_links b
  join public.companies c on c.id = b.company_id
  where b.token = p_token
    and b.expires_at > now()
    and b.confirmed_event_id is null;
$$;

grant execute on function public.get_booking(text) to anon, authenticated;
