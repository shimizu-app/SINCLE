-- ═══════════════════════════════════════════════════════════
-- 017 フェーズ3：タスク・チャンネル・DM・メンバー
--
-- 画面から何度も往復させないよう、一覧系は必要な数字ごと
-- ひとつの関数で返す。書き込みはRLSが効くので素のテーブル操作でよいが、
-- 順序や採番が要るもの（DMの相手順・招待トークン）は関数にする。
-- ═══════════════════════════════════════════════════════════

-- ── タスク一覧 ────────────────────────────────────────────

create or replace function public.list_tasks(
  p_workspace_id uuid,
  p_done boolean default false,
  p_assignee uuid default null
)
returns table (
  id uuid, title text, due_at timestamptz, due_has_time boolean,
  priority text, share text, done boolean, created_at timestamptz,
  company_id uuid, company_name text,
  assignee_id uuid, assignee_name text, assignee_avatar jsonb,
  contact_name text,
  subtask_total bigint, subtask_done bigint
)
language sql security definer stable
set search_path = '' as $$
  select
    t.id, t.title, t.due_at, t.due_has_time,
    t.priority, t.share, t.done, t.created_at,
    t.company_id, c.name,
    t.assignee_id, m.name, m.avatar,
    ct.name,
    (select count(*) from public.subtasks s where s.task_id = t.id),
    (select count(*) from public.subtasks s where s.task_id = t.id and s.done)
  from public.tasks t
  left join public.companies c        on c.id  = t.company_id
  left join public.workspace_members m on m.id = t.assignee_id
  left join public.contacts ct        on ct.id = t.contact_id
  where t.workspace_id = p_workspace_id
    and public.is_member(p_workspace_id)
    and t.done = coalesce(p_done, false)
    and (p_assignee is null or t.assignee_id = p_assignee)
  order by
    t.due_at asc nulls last,
    case t.priority when '高' then 0 when '中' then 1 else 2 end,
    t.created_at desc
  limit 500;
$$;

-- ── カレンダー（SCREENS 7-2） ─────────────────────────────
-- 打合せ・タスク・個人TODO を1本にまとめて返す。
-- 表示範囲は 全員 / 自分 / チーム共有 の3つ。

create or replace function public.calendar_items(
  p_workspace_id uuid,
  p_from date,
  p_to   date,
  p_scope text default 'all'   -- all | mine | team
)
returns table (
  kind text,            -- event | task | todo
  id uuid,
  title text,
  at timestamptz,
  has_time boolean,
  done boolean,
  priority text,
  share text,
  company_name text,
  assignee_id uuid
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select 'event', e.id, e.title, e.starts_at, true, false, null, null, c.name, null::uuid
    from public.events e
    left join public.companies c on c.id = e.company_id
   where e.workspace_id = p_workspace_id
     and e.starts_at >= p_from::timestamptz
     and e.starts_at <  (p_to + 1)::timestamptz
     and public.is_member(p_workspace_id)
     and p_scope <> 'team'

  union all

  select 'task', t.id, t.title, t.due_at, t.due_has_time, t.done, t.priority, t.share,
         c.name, t.assignee_id
    from public.tasks t
    left join public.companies c on c.id = t.company_id
    cross join me
   where t.workspace_id = p_workspace_id
     and t.due_at is not null
     and t.due_at >= p_from::timestamptz
     and t.due_at <  (p_to + 1)::timestamptz
     and public.is_member(p_workspace_id)
     and (
       p_scope = 'all'
       or (p_scope = 'mine' and t.assignee_id = me.member_id)
       or (p_scope = 'team' and t.share = 'team')
     )

  union all

  select 'todo', p.id, p.title, p.due_at, p.due_has_time, p.done, p.priority, 'self',
         null, p.member_id
    from public.personal_todos p
    cross join me
   where p.workspace_id = p_workspace_id
     and p.member_id = me.member_id
     and p.due_at is not null
     and p.due_at >= p_from::timestamptz
     and p.due_at <  (p_to + 1)::timestamptz
     and p_scope <> 'team'

  order by 4 asc nulls last;
$$;

-- ── チャンネル一覧（未読つき） ────────────────────────────

create or replace function public.list_channels(p_workspace_id uuid)
returns table (
  id uuid, kind text, name text, shape text, color text,
  company_id uuid, company_name text, company_industry text,
  member_count bigint, unread bigint,
  last_text text, last_at timestamptz, last_is_system boolean
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select
    ch.id, ch.kind,
    coalesce(ch.name, c.name), ch.shape, ch.color,
    ch.company_id, c.name, c.industry,
    (select count(*) from public.channel_members cm where cm.channel_id = ch.id),
    (select count(*) from public.messages msg
      where msg.channel_id = ch.id
        and msg.created_at > coalesce(
              (select cm.last_read_at from public.channel_members cm
                where cm.channel_id = ch.id and cm.member_id = me.member_id),
              '-infinity'::timestamptz)
        and msg.author_id is distinct from me.member_id),
    (select msg.text from public.messages msg
      where msg.channel_id = ch.id order by msg.created_at desc limit 1),
    (select msg.created_at from public.messages msg
      where msg.channel_id = ch.id order by msg.created_at desc limit 1),
    (select msg.is_system from public.messages msg
      where msg.channel_id = ch.id order by msg.created_at desc limit 1)
  from public.channels ch
  cross join me
  left join public.companies c on c.id = ch.company_id
  where ch.workspace_id = p_workspace_id
    and public.is_member(p_workspace_id)
    and (
      ch.kind = 'company'
      or exists (select 1 from public.channel_members cm
                  where cm.channel_id = ch.id and cm.member_id = me.member_id)
    )
  order by 12 desc nulls last;
$$;

/** DM の一覧。相手・未読・最後の発言。 */
create or replace function public.list_dm_threads(p_workspace_id uuid)
returns table (
  id uuid, other_id uuid, other_name text, other_role text, other_avatar jsonb,
  unread bigint, last_text text, last_at timestamptz
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select
    t.id,
    other.id, other.name, other.role, other.avatar,
    (select count(*) from public.dm_messages d
      where d.thread_id = t.id and d.author_id <> me.member_id and d.read_at is null),
    (select d.text from public.dm_messages d
      where d.thread_id = t.id order by d.created_at desc limit 1),
    (select d.created_at from public.dm_messages d
      where d.thread_id = t.id order by d.created_at desc limit 1)
  from public.dm_threads t
  cross join me
  join public.workspace_members other
    on other.id = case when t.member_a = me.member_id then t.member_b else t.member_a end
  where t.workspace_id = p_workspace_id
    and me.member_id in (t.member_a, t.member_b)
  order by 8 desc nulls last;
$$;

/** DM を開く。無ければ作る。member_a < member_b の順序はここで守る。 */
create or replace function public.open_dm(p_workspace_id uuid, p_other_id uuid)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_me uuid := public.my_member_id(p_workspace_id);
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;
  if v_me = p_other_id then
    raise exception '自分とのDMは作れません' using errcode = '22023';
  end if;
  if not exists (select 1 from public.workspace_members
                  where id = p_other_id and workspace_id = p_workspace_id) then
    raise exception '相手が見つかりません' using errcode = 'P0002';
  end if;

  v_a := least(v_me, p_other_id);
  v_b := greatest(v_me, p_other_id);

  select id into v_id from public.dm_threads
   where workspace_id = p_workspace_id and member_a = v_a and member_b = v_b;
  if v_id is null then
    insert into public.dm_threads (workspace_id, member_a, member_b)
    values (p_workspace_id, v_a, v_b)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

/** 既読にする */
create or replace function public.mark_channel_read(p_channel_id uuid)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_ws uuid;
  v_me uuid;
begin
  select workspace_id into v_ws from public.channels where id = p_channel_id;
  if v_ws is null then return; end if;
  v_me := public.my_member_id(v_ws);
  if v_me is null then return; end if;

  insert into public.channel_members (channel_id, member_id, last_read_at)
  values (p_channel_id, v_me, now())
  on conflict (channel_id, member_id) do update set last_read_at = now();
end;
$$;

create or replace function public.mark_dm_read(p_thread_id uuid)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_ws uuid;
  v_me uuid;
begin
  select workspace_id into v_ws from public.dm_threads where id = p_thread_id;
  if v_ws is null then return; end if;
  v_me := public.my_member_id(v_ws);
  if v_me is null then return; end if;

  update public.dm_messages
     set read_at = now()
   where thread_id = p_thread_id and author_id <> v_me and read_at is null;
end;
$$;

-- ── メンバー一覧（SCREENS 5「メンバー」） ─────────────────

create or replace function public.list_members(p_workspace_id uuid)
returns table (
  id uuid, name text, role text, email text, avatar jsonb, note text,
  is_admin boolean, status text, is_me boolean,
  company_count bigint, open_task_count bigint
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select
    m.id, m.name, m.role, m.email, m.avatar, m.note,
    m.is_admin, m.status, m.id = me.member_id,
    (select count(*) from public.companies c
      where c.owner_id = m.id and c.archived_at is null),
    (select count(*) from public.tasks t where t.assignee_id = m.id and not t.done)
  from public.workspace_members m
  cross join me
  where m.workspace_id = p_workspace_id
    and public.is_member(p_workspace_id)
  order by m.is_admin desc, m.created_at;
$$;

-- ── メンバー招待（SPEC 4章の3経路） ───────────────────────

/** 招待リンクを発行する。トークンはサーバー側で作る。 */
create or replace function public.create_invite_link(
  p_workspace_id uuid,
  p_days int default 7,
  p_max_uses int default 10
)
returns table (token text, expires_at timestamptz, max_uses int)
language plpgsql security definer
set search_path = '' as $$
declare
  v_token text;
begin
  if not public.is_ws_admin(p_workspace_id) then
    raise exception '招待リンクを作れるのは管理者だけです' using errcode = '42501';
  end if;

  -- 32文字以上のランダム（SPEC 4章）
  v_token := replace(
    encode(extensions.gen_random_bytes(32), 'base64'),
    '/', '_'
  );
  v_token := replace(replace(v_token, '+', '-'), '=', '');

  return query
  insert into public.invite_links (workspace_id, token, expires_at, max_uses, created_by)
  values (
    p_workspace_id, v_token,
    now() + make_interval(days => greatest(coalesce(p_days, 7), 1)),
    greatest(coalesce(p_max_uses, 10), 1),
    public.my_member_id(p_workspace_id)
  )
  returning invite_links.token, invite_links.expires_at, invite_links.max_uses;
end;
$$;

/** 参加申請を承認する（＝メンバーとして事前登録する） */
create or replace function public.approve_join_request(p_request_id uuid)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_req public.join_requests%rowtype;
  v_member uuid;
begin
  select * into v_req from public.join_requests where id = p_request_id;
  if not found then
    raise exception '申請が見つかりません' using errcode = 'P0002';
  end if;
  if not public.is_ws_admin(v_req.workspace_id) then
    raise exception '承認できるのは管理者だけです' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, email, name, status)
  values (v_req.workspace_id, v_req.email,
          coalesce(nullif(trim(v_req.name), ''), split_part(v_req.email, '@', 1)),
          'invited')
  on conflict (workspace_id, email) do update set status = 'invited'
  returning id into v_member;

  delete from public.join_requests where id = p_request_id;
  return v_member;
end;
$$;

create or replace function public.reject_join_request(p_request_id uuid)
returns void language plpgsql security definer
set search_path = '' as $$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.join_requests where id = p_request_id;
  if v_ws is null then return; end if;
  if not public.is_ws_admin(v_ws) then
    raise exception '却下できるのは管理者だけです' using errcode = '42501';
  end if;
  delete from public.join_requests where id = p_request_id;
end;
$$;

-- ── グループチャンネルを作る ──────────────────────────────

create or replace function public.create_group_channel(
  p_workspace_id uuid,
  p_name  text,
  p_shape text default 'flower',
  p_color text default 'purple',
  p_members uuid[] default '{}'
)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_me uuid := public.my_member_id(p_workspace_id);
  v_id uuid;
  v_member uuid;
begin
  if v_me is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'チャンネル名を入力してください' using errcode = '22023';
  end if;

  insert into public.channels (workspace_id, kind, name, shape, color)
  values (p_workspace_id, 'group', trim(p_name),
          coalesce(p_shape, 'flower'), coalesce(p_color, 'purple'))
  returning id into v_id;

  -- 作った本人は必ず入れる
  insert into public.channel_members (channel_id, member_id) values (v_id, v_me);

  foreach v_member in array coalesce(p_members, '{}') loop
    if v_member <> v_me and exists (
      select 1 from public.workspace_members
       where id = v_member and workspace_id = p_workspace_id
    ) then
      insert into public.channel_members (channel_id, member_id)
      values (v_id, v_member) on conflict do nothing;
    end if;
  end loop;

  return v_id;
end;
$$;

-- ── 実行権限 ──────────────────────────────────────────────

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'list_tasks','calendar_items','list_channels','list_dm_threads','open_dm',
      'mark_channel_read','mark_dm_read','list_members','create_invite_link',
      'approve_join_request','reject_join_request','create_group_channel'
    )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ── Realtime（SPEC 1章） ──────────────────────────────────
-- チャンネルとDMを同期する。RLS はそのまま効く。

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'dm_messages'
  ) then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;
