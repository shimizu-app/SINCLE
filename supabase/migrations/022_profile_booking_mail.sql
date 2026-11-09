-- ═══════════════════════════════════════════════════════════
-- 022 プロフィール・日程調整と予約ページ・AIメールの送信
--
-- ① メンバーの行：本人が書き換えてよい列を絞る（権限の穴を塞ぐ）
--    014 の「自分の行は更新できる」は、どの列でも書き換えられた。
--    そのため、ふつうのメンバーが自分を管理者にしたり（is_admin）、
--    workspace_id を書き換えて別の会社のワークスペースに入り込んだりできた。
--    更新の前に見張り役（trigger）を置いて、守る列を変えさせない。
--
-- ② プロフィールと個人の設定（SCREENS 11・12）
-- ③ 日程調整と予約ページ（SCREENS 10）
-- ④ AIメールの送信（SCREENS 9）
-- ═══════════════════════════════════════════════════════════

-- ── ① メンバーの行の見張り ────────────────────────────────

create or replace function public.guard_member_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  -- security definer の関数（参加の確定 claim_membership など）は関数の持ち主として動く。
  -- そこからの更新は、関数の中で確かめてあるので通す。
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- ワークスペースの移動・ログインの付け替えは、だれにもさせない
  if new.workspace_id is distinct from old.workspace_id
     or new.user_id is distinct from old.user_id then
    raise exception 'この項目は変更できません' using errcode = '42501';
  end if;

  -- メールの書き換えは、まだログインしていない人（招待中）を管理者が直すときだけ
  if lower(new.email) is distinct from lower(old.email)
     and not (old.user_id is null and public.is_ws_admin(old.workspace_id)) then
    raise exception 'メールアドレスは変更できません' using errcode = '42501';
  end if;

  -- 管理者にする・外す、参加の状態を変えるのは、管理者だけ
  if (new.is_admin is distinct from old.is_admin or new.status is distinct from old.status)
     and not public.is_ws_admin(old.workspace_id) then
    raise exception '管理者だけが変更できます' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_guard on public.workspace_members;
create trigger workspace_members_guard
  before update on public.workspace_members
  for each row execute function public.guard_member_update();

-- ── ② プロフィールと個人の設定 ────────────────────────────

alter table public.workspace_members
  -- AIメールの署名（SCREENS 11「差出人」）
  add column if not exists signature text,
  -- タスクの見せ方（SCREENS 11）：company＝会社ごと / assignee＝担当者ごと
  add column if not exists task_view text not null default 'company',
  -- Zoom など、決まった会議URL（日程調整で「Zoom」を選んだときに差し込む。SPEC 6章）
  add column if not exists meeting_url text;

do $$
begin
  alter table public.workspace_members drop constraint if exists workspace_members_task_view_check;
  alter table public.workspace_members add constraint workspace_members_task_view_check
    check (task_view in ('company', 'assignee'));

  -- 写真は小さく縮めて行の中に入れる（data URL）。大きすぎるものは入れさせない
  alter table public.workspace_members drop constraint if exists workspace_members_avatar_size;
  alter table public.workspace_members add constraint workspace_members_avatar_size
    check (octet_length(avatar::text) <= 200000);
  alter table public.workspace_members drop constraint if exists workspace_members_cover_size;
  alter table public.workspace_members add constraint workspace_members_cover_size
    check (cover is null or octet_length(cover::text) <= 400000);

  alter table public.workspace_members drop constraint if exists workspace_members_text_len;
  alter table public.workspace_members add constraint workspace_members_text_len
    check (char_length(name) <= 60 and char_length(role) <= 40
           and char_length(coalesce(note, '')) <= 200
           and char_length(coalesce(signature, '')) <= 1000
           and char_length(coalesce(meeting_url, '')) <= 500);
end $$;

-- ── ③ 日程調整と予約ページ（SCREENS 10） ─────────────────────
--
-- 予約ページはお客さまが開く。ログインしていない（anon）。
-- 確定のときは、発行したメンバーの Google カレンダーに予定を入れる。
-- そのため、発行したメンバーの連携トークン（暗号文）をサーバーが読む必要がある。
--
-- 守り方
--   ・予約ページのトークン（token）は推測できない長さ（32文字以上）
--   ・暗号文を返す関数と、確定を書き込む関数は、トークンに加えて「証明」（p_proof）を求める。
--     証明はサーバーだけが持つ鍵で token から作る値で、発行のときにその hash を残しておく。
--     トークンしか知らないお客さま（やリンクを拾った人）は、直接呼んでも何も返らない
--   ・有効期限・確定後は無効・候補にない時刻は受けない
--   ・同じリンクを2人が同時に確定しても、行の鍵で1件だけ通す

alter table public.booking_links
  add column if not exists member_id uuid references public.workspace_members(id) on delete cascade,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists proof_hash text,
  add column if not exists calendar_ids jsonb not null default '[]',
  add column if not exists confirmed_at timestamptz;

create index if not exists booking_links_member_idx on public.booking_links (member_id);
create index if not exists booking_links_company_idx on public.booking_links (company_id);
create index if not exists booking_links_contact_idx on public.booking_links (contact_id);
create index if not exists booking_links_event_idx on public.booking_links (confirmed_event_id);

/** 予約ページに出すもの。秘密は返さない。見つからなければ0行 */
create or replace function public.booking_page(p_token text)
returns table (
  state text,                 -- open | confirmed | expired
  workspace_name text,
  organizer_name text,
  company_name text,
  contact_name text,
  duration_min int,
  format text,
  slots jsonb,                -- まだ過ぎていない候補だけ
  confirmed_start timestamptz
)
language sql security definer stable
set search_path = '' as $$
  select
    case
      when b.confirmed_at is not null then 'confirmed'
      when b.expires_at < now() then 'expired'
      else 'open'
    end,
    w.name, m.name, c.name, ct.name, b.duration_min, b.format,
    coalesce((
      select jsonb_agg(s order by s)
        from jsonb_array_elements_text(b.slots) s
       where s::timestamptz > now()
    ), '[]'::jsonb),
    e.starts_at
  from public.booking_links b
  join public.workspaces w on w.id = b.workspace_id
  join public.companies c on c.id = b.company_id
  left join public.workspace_members m on m.id = b.member_id
  left join public.contacts ct on ct.id = b.contact_id
  left join public.events e on e.id = b.confirmed_event_id
  where b.token = p_token
    and char_length(coalesce(p_token, '')) >= 32;
$$;

/**
 * 確定の前に、サーバーが読むもの（発行したメンバーの連携の暗号文など）。
 * 証明が合わなければ0行。
 */
create or replace function public.booking_for_confirm(p_token text, p_proof text)
returns table (
  workspace_id uuid,
  workspace_name text,
  company_id uuid,
  company_name text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  member_id uuid,
  organizer_name text,
  organizer_email text,
  meeting_url text,
  duration_min int,
  format text,
  slots jsonb,
  calendar_ids jsonb,
  access_token text,
  refresh_token text,
  expires_at timestamptz
)
language sql security definer stable
set search_path = '' as $$
  select b.workspace_id, w.name, b.company_id, c.name, b.contact_id, ct.name, ct.email,
         b.member_id, m.name, m.email, m.meeting_url, b.duration_min, b.format, b.slots,
         b.calendar_ids, i.access_token, i.refresh_token, i.expires_at
  from public.booking_links b
  join public.workspaces w on w.id = b.workspace_id
  join public.companies c on c.id = b.company_id
  join public.workspace_members m on m.id = b.member_id
  left join public.contacts ct on ct.id = b.contact_id
  left join public.integrations i
         on i.member_id = b.member_id and i.workspace_id = b.workspace_id and i.provider = 'google'
  where b.token = p_token
    and char_length(coalesce(p_token, '')) >= 32
    and b.proof_hash is not null
    and b.proof_hash = encode(sha256(convert_to(coalesce(p_proof, ''), 'UTF8')), 'hex')
    and b.confirmed_at is null
    and b.expires_at > now();
$$;

/**
 * 確定を書き込む。打合せ（events）・準備タスク・会社チャンネルへの知らせまで一度に。
 * Google カレンダーへの登録はサーバーが先に済ませ、その結果（予定のID・会議URL）を渡す。
 */
create or replace function public.confirm_booking(
  p_token text,
  p_proof text,
  p_start timestamptz,
  p_title text,
  p_meet_url text,
  p_gcal_event_id text
)
returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  b public.booking_links%rowtype;
  v_event uuid;
  v_channel uuid;
  v_contact text;
  v_when text;
begin
  select * into b from public.booking_links
   where token = p_token
     and char_length(coalesce(p_token, '')) >= 32
   for update;

  if not found
     or b.proof_hash is null
     or b.proof_hash <> encode(sha256(convert_to(coalesce(p_proof, ''), 'UTF8')), 'hex') then
    raise exception '予約ページが見つかりません' using errcode = '42501';
  end if;
  if b.confirmed_at is not null then
    raise exception 'この予約ページは、もう確定しています' using errcode = '55000';
  end if;
  if b.expires_at < now() then
    raise exception 'この予約ページは期限が切れています' using errcode = '55000';
  end if;
  if p_start is null or p_start <= now() or not exists (
    select 1 from jsonb_array_elements_text(b.slots) s where s::timestamptz = p_start
  ) then
    raise exception 'その時刻は候補にありません' using errcode = '22023';
  end if;

  insert into public.events
    (workspace_id, company_id, contact_id, title, starts_at, duration_min, format, meet_url, gcal_event_id)
  values
    (b.workspace_id, b.company_id, b.contact_id, left(coalesce(nullif(trim(p_title), ''), '打合せ'), 200),
     p_start, b.duration_min, b.format, nullif(trim(p_meet_url), ''), nullif(trim(p_gcal_event_id), ''))
  returning id into v_event;

  update public.booking_links
     set confirmed_event_id = v_event, confirmed_at = now()
   where id = b.id;

  -- 準備タスク：打合せの前日（日本時間）までに、担当は発行した人
  insert into public.tasks (workspace_id, company_id, contact_id, title, assignee_id, due_at, due_has_time, priority, share)
  values (b.workspace_id, b.company_id, b.contact_id,
          left('打合せの準備：' || coalesce(nullif(trim(p_title), ''), '打合せ'), 200),
          b.member_id,
          (date_trunc('day', (p_start at time zone 'Asia/Tokyo')) - interval '1 day') at time zone 'Asia/Tokyo',
          false, '高', 'assignee');

  -- 会社チャンネルに知らせる
  select id into v_channel from public.channels
   where company_id = b.company_id and kind = 'company' limit 1;
  if v_channel is not null then
    select name into v_contact from public.contacts where id = b.contact_id;
    v_when := to_char(p_start at time zone 'Asia/Tokyo', 'FMMM"月"FMDD"日" HH24:MI');
    insert into public.messages (channel_id, workspace_id, author_id, text, is_system)
    values (v_channel, b.workspace_id, null,
            coalesce(v_contact || 'さんとの', '') || '打合せが ' || v_when || ' に決まりました（予約ページから・'
              || b.format || '）', true);
  end if;

  return v_event;
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('booking_page', 'booking_for_confirm', 'confirm_booking')
  loop
    -- お客さまはログインしていないので anon にも開く。中で token と証明を確かめる
    execute format('revoke execute on function %s from public', r.sig);
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_member_update'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
