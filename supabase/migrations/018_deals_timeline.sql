-- ═══════════════════════════════════════════════════════════
-- 018 フェーズ5：案件・活動タイムライン・書類・キーパーソン
--
-- 放置判定のしきい値は lib/design.ts の DEAL_STATUS が正。
-- ここでは「最終更新から何日か」だけ返し、色と文言は画面側で決める。
-- ═══════════════════════════════════════════════════════════

-- ── 進行中の案件（SCREENS 3-2） ───────────────────────────

create or replace function public.list_deals(
  p_workspace_id uuid,
  p_sort text default 'stale'   -- stale | new | amount
)
returns table (
  id uuid, company_id uuid, company_name text, company_industry text,
  status text, memo text, amount text, deal_type text,
  updated_at timestamptz, days_since_update int,
  owner_id uuid, owner_name text, owner_avatar jsonb,
  contact_name text, open_task_count bigint
)
language sql security definer stable
set search_path = '' as $$
  select
    d.id, d.company_id, c.name, c.industry,
    d.status, d.memo, d.amount, c.deal_type,
    d.updated_at,
    greatest(0, (current_date - d.updated_at::date))::int,
    c.owner_id, m.name, m.avatar,
    ct.name,
    (select count(*) from public.tasks t where t.company_id = c.id and not t.done)
  from public.deals d
  join public.companies c on c.id = d.company_id
  left join public.workspace_members m on m.id = c.owner_id
  left join public.contacts ct on ct.id = c.primary_contact_id
  where d.workspace_id = p_workspace_id
    and d.active
    and c.archived_at is null
    and public.is_member(p_workspace_id)
  order by
    -- 既定は「止まっている順」
    case when p_sort = 'stale' then d.updated_at end asc,
    case when p_sort = 'new'   then d.updated_at end desc,
    d.updated_at asc;
$$;

/** 案件を完了にする。会社チャンネルにも残す（SCREENS 3-2）。 */
create or replace function public.complete_deal(p_deal_id uuid, p_note text default null)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_deal public.deals%rowtype;
  v_company text;
  v_channel uuid;
begin
  select * into v_deal from public.deals where id = p_deal_id;
  if not found then
    raise exception '案件が見つかりません' using errcode = 'P0002';
  end if;
  if public.my_member_id(v_deal.workspace_id) is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;

  update public.deals set active = false where id = p_deal_id;

  select name into v_company from public.companies where id = v_deal.company_id;
  select id into v_channel from public.channels
   where company_id = v_deal.company_id and kind = 'company';

  if v_channel is not null then
    insert into public.messages (channel_id, workspace_id, text, is_system)
    values (v_channel, v_deal.workspace_id,
            v_company || ' の案件を完了にしました。'
              || coalesce('（' || nullif(trim(p_note), '') || '）', ''),
            true);
  end if;
end;
$$;

-- ── 活動タイムライン（SCREENS 4「履歴」） ─────────────────
-- メール・打合せ・タスク・会話・システム更新を1本の時系列にする。

create or replace function public.company_timeline(
  p_company_id uuid,
  p_filter text default 'all',   -- all | mail | meeting | task | talk
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  kind text,          -- mail | meeting | task | talk | system
  id uuid,
  title text,
  body text,
  at timestamptz,
  done boolean,
  direction text,
  author_name text,
  author_avatar jsonb
)
language sql security definer stable
set search_path = '' as $$
  with ws as (
    select workspace_id from public.companies where id = p_company_id
  )
  select * from (
    select 'mail'::text, m.id, m.subject, coalesce(m.excerpt, m.body), m.sent_at,
           m.replied, m.direction, null::text, null::jsonb
      from public.mails m, ws
     where m.company_id = p_company_id
       and public.is_member(ws.workspace_id)
       and p_filter in ('all', 'mail')

    union all

    select 'meeting', e.id, e.title, e.format, e.starts_at,
           e.starts_at < now(), null, null, null
      from public.events e, ws
     where e.company_id = p_company_id
       and public.is_member(ws.workspace_id)
       and p_filter in ('all', 'meeting')

    union all

    select 'task', t.id, t.title, null, coalesce(t.due_at, t.created_at),
           t.done, null, wm.name, wm.avatar
      from public.tasks t
      cross join ws
      left join public.workspace_members wm on wm.id = t.assignee_id
     where t.company_id = p_company_id
       and public.is_member(ws.workspace_id)
       and p_filter in ('all', 'task')

    union all

    select case when msg.is_system then 'system' else 'talk' end,
           msg.id, null, msg.text, msg.created_at,
           null, null, wm.name, wm.avatar
      from public.messages msg
      join public.channels ch on ch.id = msg.channel_id
      cross join ws
      left join public.workspace_members wm on wm.id = msg.author_id
     where ch.company_id = p_company_id
       and public.is_member(ws.workspace_id)
       and p_filter in ('all', 'talk')
  ) rows(kind, id, title, body, at, done, direction, author_name, author_avatar)
  order by at desc
  limit greatest(coalesce(p_limit, 30), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

/**
 * 記録を1行で残す（SCREENS 4「これが入力を促す最大の仕掛け」）。
 * 会社チャンネルに流し、案件の updated_at も更新する。
 * ＝ 記録した時点で放置判定から外れる。
 */
create or replace function public.log_activity(p_company_id uuid, p_text text)
returns uuid language plpgsql security definer
set search_path = '' as $$
declare
  v_ws uuid;
  v_me uuid;
  v_channel uuid;
  v_id uuid;
begin
  if coalesce(trim(p_text), '') = '' then
    raise exception '内容を入力してください' using errcode = '22023';
  end if;

  select workspace_id into v_ws from public.companies where id = p_company_id;
  if v_ws is null then
    raise exception '会社が見つかりません' using errcode = 'P0002';
  end if;
  v_me := public.my_member_id(v_ws);
  if v_me is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;

  select id into v_channel from public.channels
   where company_id = p_company_id and kind = 'company';
  if v_channel is null then
    insert into public.channels (workspace_id, kind, company_id, shape, color)
    values (v_ws, 'company', p_company_id, 'hex', 'purple')
    returning id into v_channel;
  end if;

  insert into public.messages (channel_id, workspace_id, author_id, text)
  values (v_channel, v_ws, v_me, trim(p_text))
  returning id into v_id;

  -- 動きがあったので、放置判定をリセットする
  update public.deals set updated_at = now()
   where company_id = p_company_id and active;

  return v_id;
end;
$$;

-- ── キーパーソン（SCREENS 3-3） ───────────────────────────
-- 4軸を組み合わせて絞る（複数選択・AND条件）。
-- ジャンルは本業と「顔が利くジャンル」の両方で見る。

create or replace function public.list_key_persons(
  p_workspace_id uuid,
  p_genres text[] default null,
  p_scopes text[] default null,
  p_prefs  text[] default null,
  p_layers text[] default null
)
returns table (
  id uuid, name text, kana text, company_name text, title text,
  genre text, sub_genres text[], layers text[], scope text,
  pref text, city text, met text, about text, network text, tags text[],
  referral_count bigint
)
language sql security definer stable
set search_path = '' as $$
  select
    k.id, k.name, k.kana, k.company_name, k.title,
    k.genre, k.sub_genres, k.layers, k.scope,
    k.pref, k.city, k.met, k.about, k.network, k.tags,
    (select count(*) from public.referrals r where r.key_person_id = k.id)
  from public.key_persons k
  where k.workspace_id = p_workspace_id
    and public.is_member(p_workspace_id)
    and (p_genres is null or array_length(p_genres, 1) is null
         or k.genre = any(p_genres) or k.sub_genres && p_genres)
    and (p_scopes is null or array_length(p_scopes, 1) is null or k.scope = any(p_scopes))
    and (p_prefs  is null or array_length(p_prefs, 1) is null  or k.pref  = any(p_prefs))
    and (p_layers is null or array_length(p_layers, 1) is null or k.layers && p_layers)
  order by 16 desc, k.created_at desc;
$$;

/** 絞り込みに出す選択肢は、登録のあるものだけ */
create or replace function public.key_person_facets(p_workspace_id uuid)
returns table (kind text, value text, count bigint)
language sql security definer stable
set search_path = '' as $$
  select 'genre', genre, count(*) from public.key_persons
   where workspace_id = p_workspace_id and public.is_member(p_workspace_id)
   group by genre
  union all
  select 'scope', scope, count(*) from public.key_persons
   where workspace_id = p_workspace_id and public.is_member(p_workspace_id)
   group by scope
  union all
  select 'pref', pref, count(*) from public.key_persons
   where workspace_id = p_workspace_id and public.is_member(p_workspace_id)
     and coalesce(pref, '') <> ''
   group by pref
  union all
  select 'layer', layer, count(*)
    from public.key_persons, unnest(layers) as layer
   where workspace_id = p_workspace_id and public.is_member(p_workspace_id)
   group by layer;
$$;

-- ── 実行権限 ──────────────────────────────────────────────

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'list_deals','complete_deal','company_timeline','log_activity',
      'list_key_persons','key_person_facets'
    )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

create index if not exists deals_stale_idx
  on public.deals (workspace_id, updated_at) where active;
create index if not exists referrals_person_idx
  on public.referrals (key_person_id);
