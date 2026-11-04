-- ═══════════════════════════════════════════════════════════
-- 020 Google カレンダー連携と、計画のチャンネル
--
-- ① 連携トークンの出し入れ
--    integrations は誰にも select を許していない（009）。
--    トークンを使うのはサーバーだけで、しかも暗号化して入れてある
--    （lib/token-crypto.ts。鍵はサーバーの環境変数にだけある）。
--    本人の行だけを、security definer の関数で出し入れする。
--
--    素の upsert / delete では動かない。RLS では、既にある行を読む操作
--    （on conflict do update や where つきの delete）に select の許可が要るが、
--    その許可を誰にも出していないため。
--
-- ② 計画の「チャンネルで話す」
--    議題ごとにグループチャンネルを1つ作り、2回目からは同じものを開く。
-- ═══════════════════════════════════════════════════════════

-- ── ① 連携 ────────────────────────────────────────────────

-- どの Google アカウントで連携したかを画面に出すため
alter table public.integrations add column if not exists account_email text;

/** 本人の連携を読む。トークンは暗号文のまま返す（鍵が無ければ開けない） */
create or replace function public.my_integration(p_workspace_id uuid, p_provider text)
returns table (
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  calendar_ids jsonb,
  account_email text
)
language sql security definer stable
set search_path = '' as $$
  select i.access_token, i.refresh_token, i.expires_at, i.scopes, i.calendar_ids, i.account_email
  from public.integrations i
  where i.workspace_id = p_workspace_id
    and i.provider = p_provider
    and i.member_id = public.my_member_id(p_workspace_id);
$$;

/** 連携を保存する。新しく作るときも、つなぎ直すときもこれ */
create or replace function public.save_integration(
  p_workspace_id  uuid,
  p_provider      text,
  p_access_token  text,
  p_refresh_token text,
  p_expires_at    timestamptz,
  p_scopes        text[],
  p_account_email text
)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_member uuid := public.my_member_id(p_workspace_id);
begin
  if v_member is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;
  if coalesce(p_access_token, '') = '' then
    raise exception 'トークンがありません' using errcode = '22023';
  end if;

  insert into public.integrations
    (workspace_id, member_id, provider, access_token, refresh_token, expires_at, scopes, account_email)
  values
    (p_workspace_id, v_member, p_provider, p_access_token, p_refresh_token,
     p_expires_at, coalesce(p_scopes, '{}'), p_account_email)
  on conflict (workspace_id, member_id, provider) do update set
    access_token  = excluded.access_token,
    -- Google は2回目以降の同意で refresh_token を返さないことがある。
    -- 来なかったら前のものを残す（消すと、1時間後に使えなくなる）
    refresh_token = coalesce(excluded.refresh_token, public.integrations.refresh_token),
    expires_at    = excluded.expires_at,
    scopes        = excluded.scopes,
    account_email = coalesce(excluded.account_email, public.integrations.account_email);
end;
$$;

/** アクセストークンの取り直し（1時間で切れる）。refresh_token には触らない */
create or replace function public.refresh_integration_token(
  p_workspace_id uuid,
  p_provider     text,
  p_access_token text,
  p_expires_at   timestamptz
)
returns void language sql security definer
set search_path = '' as $$
  update public.integrations
     set access_token = p_access_token, expires_at = p_expires_at
   where workspace_id = p_workspace_id
     and provider = p_provider
     and member_id = public.my_member_id(p_workspace_id);
$$;

/** 使うカレンダーを選ぶ（SCREENS 11「使うカレンダーの選択」） */
create or replace function public.set_integration_calendars(
  p_workspace_id uuid,
  p_provider     text,
  p_calendar_ids jsonb
)
returns void language sql security definer
set search_path = '' as $$
  update public.integrations
     set calendar_ids = coalesce(p_calendar_ids, '[]'::jsonb)
   where workspace_id = p_workspace_id
     and provider = p_provider
     and member_id = public.my_member_id(p_workspace_id);
$$;

/** 連携を外す */
create or replace function public.delete_integration(p_workspace_id uuid, p_provider text)
returns void language sql security definer
set search_path = '' as $$
  delete from public.integrations
   where workspace_id = p_workspace_id
     and provider = p_provider
     and member_id = public.my_member_id(p_workspace_id);
$$;

-- 画面向けの連携状況に、アカウントのメールを足す。
-- 返り値の形が変わるので、作り直す。
drop function if exists public.integration_status();
create function public.integration_status()
returns table (
  workspace_id uuid,
  provider text,
  scopes text[],
  gmail_scope text,
  calendar_ids jsonb,
  expires_at timestamptz,
  last_sync_at timestamptz,
  account_email text
) language sql security definer stable
set search_path = '' as $$
  select i.workspace_id, i.provider, i.scopes, i.gmail_scope,
         i.calendar_ids, i.expires_at, i.last_sync_at, i.account_email
  from public.integrations i
  join public.workspace_members m on m.id = i.member_id
  where m.user_id = (select auth.uid());
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'my_integration', 'save_integration', 'refresh_integration_token',
      'set_integration_calendars', 'delete_integration', 'integration_status'
    )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ── ② 計画のチャンネル ────────────────────────────────────

alter table public.agenda_items
  add column if not exists channel_id uuid references public.channels(id) on delete set null;
