-- ═══════════════════════════════════════════════════════════
-- 016 会社一覧の検索・絞り込み・並べ替え
--
-- SCREENS 3-1 の検索対象は会社と名刺にまたがる（会社名・担当者名・
-- 役職・部署・メール・業種・案件種別・タグ）。画面から何度も往復
-- させたくないので、ひとつの関数で必要な数字ごと返す。
-- ═══════════════════════════════════════════════════════════

create or replace function public.search_companies(
  p_workspace_id uuid,
  p_q            text default null,
  p_tier         text default null,   -- 'A' | 'B' | 'C'
  p_industry     text default null,
  p_deal_type    text default null,
  p_sort         text default 'new',  -- new | old | tier | stage | name
  p_limit        int  default 200
)
returns table (
  id uuid,
  name text,
  industry text,
  tier text,
  employees int,
  deal_type text,
  comment text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  stage_name text,
  stage_position int,
  stage_total bigint,
  primary_contact_name text,
  primary_contact_title text,
  contact_count bigint,
  open_task_count bigint,
  deal_status text,
  deal_updated_at timestamptz
)
language sql security definer stable
set search_path = '' as $$
  with q as (
    select nullif(lower(trim(coalesce(p_q, ''))), '') as needle
  ),
  total as (
    select count(*) as n from public.stages where workspace_id = p_workspace_id
  )
  select
    c.id, c.name, c.industry, c.tier, c.employees, c.deal_type, c.comment, c.tags,
    c.created_at, c.updated_at,
    s.name, s.position, total.n,
    pc.name, pc.title,
    (select count(*) from public.contacts ct
      where ct.company_id = c.id and ct.archived_at is null),
    (select count(*) from public.tasks t
      where t.company_id = c.id and not t.done),
    d.status, d.updated_at
  from public.companies c
  cross join q
  cross join total
  left join public.stages   s  on s.id  = c.stage_id
  left join public.contacts pc on pc.id = c.primary_contact_id
  left join public.deals    d  on d.company_id = c.id and d.active
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and public.is_member(p_workspace_id)
    and (p_tier      is null or c.tier      = p_tier)
    and (p_industry  is null or c.industry  = p_industry)
    and (p_deal_type is null or c.deal_type = p_deal_type)
    and (
      q.needle is null
      or lower(c.name)               like '%' || q.needle || '%'
      or lower(coalesce(c.industry,  '')) like '%' || q.needle || '%'
      or lower(coalesce(c.deal_type, '')) like '%' || q.needle || '%'
      or lower(coalesce(c.comment,   '')) like '%' || q.needle || '%'
      or exists (select 1 from unnest(c.tags) tg where lower(tg) like '%' || q.needle || '%')
      or exists (
        select 1 from public.contacts ct
        where ct.company_id = c.id and ct.archived_at is null
          and (
            lower(ct.name)              like '%' || q.needle || '%'
            or lower(coalesce(ct.title, '')) like '%' || q.needle || '%'
            or lower(coalesce(ct.dept,  '')) like '%' || q.needle || '%'
            or lower(coalesce(ct.email, '')) like '%' || q.needle || '%'
          )
      )
    )
  order by
    case when p_sort = 'tier' then c.tier end asc nulls last,
    case when p_sort = 'stage' then s.position end desc nulls last,
    case when p_sort = 'name' then c.name end asc,
    case when p_sort = 'old'  then c.created_at end asc,
    case when p_sort = 'new'  then c.created_at end desc,
    c.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

/** ヘッダーに出す件数。一覧と同じ条件では引かない（全体の数） */
create or replace function public.customer_counts(p_workspace_id uuid)
returns table (companies bigint, tier_a bigint, open_tasks bigint, unreplied_mails bigint)
language sql security definer stable
set search_path = '' as $$
  select
    (select count(*) from public.companies
      where workspace_id = p_workspace_id and archived_at is null),
    (select count(*) from public.companies
      where workspace_id = p_workspace_id and archived_at is null
        and coalesce(tier_manual, tier) = 'A'),
    (select count(*) from public.tasks
      where workspace_id = p_workspace_id and not done),
    (select count(*) from public.mails
      where workspace_id = p_workspace_id and direction = 'in' and not replied)
  where public.is_member(p_workspace_id);
$$;

/** 絞り込みに出す選択肢は、実際に登録のあるものだけにする */
create or replace function public.company_facets(p_workspace_id uuid)
returns table (kind text, value text, count bigint)
language sql security definer stable
set search_path = '' as $$
  select 'tier', tier, count(*)
    from public.companies
   where workspace_id = p_workspace_id and archived_at is null and tier is not null
     and public.is_member(p_workspace_id)
   group by tier
  union all
  select 'industry', industry, count(*)
    from public.companies
   where workspace_id = p_workspace_id and archived_at is null
     and coalesce(industry, '') <> '' and public.is_member(p_workspace_id)
   group by industry
  union all
  select 'deal_type', deal_type, count(*)
    from public.companies
   where workspace_id = p_workspace_id and archived_at is null
     and coalesce(deal_type, '') <> '' and public.is_member(p_workspace_id)
   group by deal_type;
$$;

revoke execute on function
  public.search_companies(uuid, text, text, text, text, text, int),
  public.customer_counts(uuid),
  public.company_facets(uuid)
from public;

grant execute on function
  public.search_companies(uuid, text, text, text, text, text, int),
  public.customer_counts(uuid),
  public.company_facets(uuid)
to authenticated;
