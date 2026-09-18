-- ═══════════════════════════════════════════════════════════
-- 010 認証・参加のための RPC
--
-- RLS は「status='active' の所属メンバー」を前提にしている。
-- そのため素のテーブル操作だけでは
--   ・最初の1人がワークスペースを作れない（作る前は誰もメンバーでない）
--   ・招待された人が自分の行を active にできない
-- という行き止まりが生まれる。ここを security definer の関数で埋める。
-- ═══════════════════════════════════════════════════════════

-- ── フリーメールかどうか ──────────────────────────────────
-- 同ドメイン参加を gmail.com などに適用すると、赤の他人が
-- 「同じ会社にあります」と表示されてしまうため除外する。

create or replace function public.is_corporate_domain(p_domain text)
returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(p_domain, '') <> ''
     and lower(p_domain) not in (
       'gmail.com','googlemail.com','yahoo.co.jp','yahoo.com','ymail.com','ybb.ne.jp',
       'outlook.com','outlook.jp','hotmail.com','hotmail.co.jp','live.jp','live.com','msn.com',
       'icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me',
       'docomo.ne.jp','ezweb.ne.jp','au.com','softbank.ne.jp','i.softbank.jp','vodafone.ne.jp',
       'nifty.com','ocn.ne.jp','biglobe.ne.jp','so-net.ne.jp','plala.or.jp','excite.co.jp',
       'zoho.com','gmx.com','mail.com','yandex.com','qq.com','163.com'
     );
$$;

-- ログイン中のユーザーのメールアドレス
create or replace function public.my_email()
returns text language sql security definer stable
set search_path = '' as $$
  select email from auth.users where id = auth.uid();
$$;

-- ── slug の重複チェック ───────────────────────────────────

create or replace function public.is_slug_available(p_slug text)
returns boolean language sql security definer stable
set search_path = '' as $$
  select not exists (
    select 1 from public.workspaces where slug = lower(trim(p_slug))
  );
$$;

-- ── ワークスペースを作る ──────────────────────────────────
-- workspaces + 自分（管理者・active）+ 既定ステージ を1トランザクションで。

create or replace function public.create_workspace(
  p_name        text,
  p_slug        text,
  p_member_name text default null,
  p_role        text default 'メンバー',
  p_avatar      jsonb default null,
  p_color       text default 'purple',
  p_shape       text default 'flower',
  p_use_domain  boolean default true,
  p_open_join   boolean default false
)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_domain text;
  v_ws     uuid;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if coalesce(v_email, '') = '' then
    raise exception 'メールアドレスが取得できません' using errcode = '22023';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception '会社名を入力してください' using errcode = '22023';
  end if;
  if coalesce(trim(p_slug), '') = '' then
    raise exception 'URL名を入力してください' using errcode = '22023';
  end if;

  v_domain := lower(split_part(v_email, '@', 2));
  if not (coalesce(p_use_domain, true) and public.is_corporate_domain(v_domain)) then
    v_domain := null;
  end if;

  insert into public.workspaces (name, slug, domain, open_join, color, shape)
  values (
    trim(p_name),
    lower(trim(p_slug)),
    v_domain,
    coalesce(p_open_join, false),
    coalesce(p_color, 'purple'),
    coalesce(p_shape, 'flower')
  )
  returning id into v_ws;

  insert into public.workspace_members
    (workspace_id, user_id, email, name, role, is_admin, status, avatar)
  values (
    v_ws, v_uid, v_email,
    coalesce(nullif(trim(p_member_name), ''), split_part(v_email, '@', 1)),
    coalesce(nullif(trim(p_role), ''), 'メンバー'),
    true, 'active',
    coalesce(p_avatar, '{"kind":"shape","shape":"flower","color":"purple"}'::jsonb)
  );

  -- 既定の進捗ステージ（設定で変更できる）
  insert into public.stages (workspace_id, name, position)
  select v_ws, s.name, s.pos
  from (values ('初回接触', 0), ('ヒアリング', 1), ('提案', 2), ('見積', 3), ('受注', 4))
       as s(name, pos);

  return v_ws;
end;
$$;

-- ── 事前登録の引き取り ────────────────────────────────────
-- 管理者がメールだけ登録した行（status='invited'）に user_id を紐づけて active に。
-- ログイン直後に必ず1回呼ぶ。

create or replace function public.claim_membership()
returns int language plpgsql security definer
set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_n     int;
begin
  if v_uid is null then return 0; end if;

  select email into v_email from auth.users where id = v_uid;
  if coalesce(v_email, '') = '' then return 0; end if;

  update public.workspace_members
     set user_id = v_uid, status = 'active'
   where lower(email) = lower(v_email)
     and status = 'invited'
     and user_id is null;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── 同ドメインのワークスペースを探す ──────────────────────
-- 自分のメールのドメインに一致するものだけ。任意のドメインは検索できない。

create or replace function public.find_workspaces_by_domain()
returns table (
  id uuid, name text, slug text, color text, shape text,
  open_join boolean, member_count bigint, requested boolean
)
language sql security definer stable
set search_path = '' as $$
  with me as (
    select u.id as uid, u.email,
           lower(split_part(u.email, '@', 2)) as domain
    from auth.users u where u.id = auth.uid()
  )
  select w.id, w.name, w.slug, w.color, w.shape, w.open_join,
         (select count(*) from public.workspace_members m
           where m.workspace_id = w.id and m.status = 'active'),
         exists (select 1 from public.join_requests r
                  where r.workspace_id = w.id
                    and lower(r.email) = lower(me.email))
  from public.workspaces w, me
  where w.domain is not null
    and w.domain = me.domain
    and public.is_corporate_domain(me.domain)
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = w.id and m.user_id = me.uid and m.status = 'active'
    );
$$;

-- ── 同ドメインで参加する / 申請する ───────────────────────
-- open_join=true なら即参加して workspace_id を返す。
-- false なら join_requests に積んで null を返す。

create or replace function public.join_by_domain(
  p_workspace_id uuid,
  p_name text default null
)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_ws    public.workspaces%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;
  select * into v_ws from public.workspaces where id = p_workspace_id;
  if not found then
    raise exception 'ワークスペースが見つかりません' using errcode = 'P0002';
  end if;

  -- 自分のドメインと一致していることを必ず確認する
  if v_ws.domain is null
     or v_ws.domain <> lower(split_part(v_email, '@', 2))
     or not public.is_corporate_domain(v_ws.domain) then
    raise exception 'このワークスペースには申請できません' using errcode = '42501';
  end if;

  -- すでに参加済み
  if exists (select 1 from public.workspace_members
              where workspace_id = v_ws.id and user_id = v_uid and status = 'active') then
    return v_ws.id;
  end if;

  if v_ws.open_join then
    insert into public.workspace_members (workspace_id, user_id, email, name, status)
    values (v_ws.id, v_uid, v_email,
            coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)), 'active')
    on conflict (workspace_id, email)
      do update set user_id = excluded.user_id, status = 'active';
    delete from public.join_requests
     where workspace_id = v_ws.id and lower(email) = lower(v_email);
    return v_ws.id;
  end if;

  insert into public.join_requests (workspace_id, email, name, via)
  values (v_ws.id, v_email, nullif(trim(p_name), ''), 'domain')
  on conflict (workspace_id, email) do nothing;
  return null;
end;
$$;

-- ── 招待リンクで参加する ──────────────────────────────────

create or replace function public.join_via_invite(
  p_token text,
  p_name  text default null
)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_link  public.invite_links%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- 使用回数を安全に増やすため行ロックを取る
  select * into v_link from public.invite_links where token = p_token for update;
  if not found then
    raise exception '招待リンクが見つかりません' using errcode = 'P0002';
  end if;
  if v_link.expires_at <= now() then
    raise exception '招待リンクの有効期限が切れています' using errcode = '22023';
  end if;

  -- すでに参加済みなら回数を消費しない
  if exists (select 1 from public.workspace_members
              where workspace_id = v_link.workspace_id and user_id = v_uid and status = 'active') then
    return v_link.workspace_id;
  end if;

  if v_link.uses >= v_link.max_uses then
    raise exception '招待リンクの利用上限に達しています' using errcode = '22023';
  end if;

  insert into public.workspace_members (workspace_id, user_id, email, name, status)
  values (v_link.workspace_id, v_uid, v_email,
          coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)), 'active')
  on conflict (workspace_id, email)
    do update set user_id = excluded.user_id, status = 'active';

  update public.invite_links set uses = uses + 1 where id = v_link.id;

  delete from public.join_requests
   where workspace_id = v_link.workspace_id and lower(email) = lower(v_email);

  return v_link.workspace_id;
end;
$$;

-- ── 実行権限 ──────────────────────────────────────────────
-- 未ログイン（anon）からは呼べないようにする。

revoke execute on function
  public.create_workspace(text, text, text, text, jsonb, text, text, boolean, boolean),
  public.claim_membership(),
  public.find_workspaces_by_domain(),
  public.join_by_domain(uuid, text),
  public.join_via_invite(text, text),
  public.my_email(),
  public.is_slug_available(text)
from public;

grant execute on function
  public.create_workspace(text, text, text, text, jsonb, text, text, boolean, boolean),
  public.claim_membership(),
  public.find_workspaces_by_domain(),
  public.join_by_domain(uuid, text),
  public.join_via_invite(text, text),
  public.my_email(),
  public.is_slug_available(text)
to authenticated;
