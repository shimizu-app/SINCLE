-- ═══════════════════════════════════════════════════════════
-- 015 名刺登録の連鎖とティア自動判定
--
-- SPEC 2章「入力を強制しない。記録が作業の副産物として発生する」
-- 名刺を1枚入れると、会社・チャンネル・ティア・初回タスク・案件が
-- まとめて出来る。途中で失敗して半端な状態が残らないよう、
-- ひとつの関数（＝ひとつのトランザクション）にまとめる。
-- ═══════════════════════════════════════════════════════════

-- ── ティア判定（SPEC 3章） ────────────────────────────────
-- lib/design.ts の titleScore / sizeScore / judgeTier と同じ規則。
-- 片方だけ直すとズレるので、変えるときは必ず両方直すこと。

create or replace function public.title_score(p_title text)
returns int language sql immutable
set search_path = '' as $$
  select case
    when coalesce(p_title, '') = '' then 0
    when p_title ~ '代表|社長|CEO|COO|CFO|CTO|役員|取締役|専務|常務' then 3
    when p_title ~ '本部長|事業部長|部長'                            then 2
    when p_title ~ '課長|マネージャー|マネジャー|リーダー|室長|主任'  then 1
    else 0
  end;
$$;

create or replace function public.size_score(p_employees int)
returns int language sql immutable
set search_path = '' as $$
  select case
    when coalesce(p_employees, 0) >= 300 then 2
    when coalesce(p_employees, 0) >= 50  then 1
    else 0
  end;
$$;

create or replace function public.tier_from_score(p_total int)
returns text language sql immutable
set search_path = '' as $$
  select case when p_total >= 4 then 'A' when p_total >= 2 then 'B' else 'C' end;
$$;

/**
 * 会社のティアを引き直す。
 * SPEC 3章「会社単位では、所属する名刺のうち最高スコアで判定する」
 */
create or replace function public.recompute_company_tier(p_company_id uuid)
returns void language sql
set search_path = '' as $$
  update public.companies c
     set tier = public.tier_from_score(
           coalesce((
             select max(public.title_score(ct.title))
             from public.contacts ct
             where ct.company_id = c.id and ct.archived_at is null
           ), 0)
           + public.size_score(c.employees)
         )
   where c.id = p_company_id;
$$;

-- 名刺が増減したら引き直す
create or replace function public.contacts_touch_tier()
returns trigger language plpgsql
set search_path = '' as $$
begin
  perform public.recompute_company_tier(coalesce(new.company_id, old.company_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists contacts_tier on public.contacts;
create trigger contacts_tier
  after insert or update of title, archived_at or delete on public.contacts
  for each row execute function public.contacts_touch_tier();

-- 従業員数が変わったら引き直す。
-- when 句を付けないと、tier を書き戻す update でこの trigger が
-- もう一度走って無限に回る。
create or replace function public.companies_touch_tier()
returns trigger language plpgsql
set search_path = '' as $$
begin
  perform public.recompute_company_tier(new.id);
  return new;
end;
$$;

drop trigger if exists companies_tier on public.companies;
create trigger companies_tier
  after update of employees on public.companies
  for each row
  when (old.employees is distinct from new.employees)
  execute function public.companies_touch_tier();

-- ── 重複しそうな会社を探す（SPEC 7章） ────────────────────
-- 「株式会社アルテック」と「アルテック」を取り違えないよう、
-- 法人格と空白を落とした名前で前方一致・包含を見る。

create or replace function public.find_similar_companies(
  p_workspace_id uuid,
  p_name text
)
returns table (
  id uuid, name text, industry text, tier text,
  employees int, contact_count bigint, exact boolean
)
language sql security definer stable
set search_path = '' as $$
  with key as (select public.normalize_company_name(p_name) as k)
  select c.id, c.name, c.industry, c.tier, c.employees,
         (select count(*) from public.contacts ct
           where ct.company_id = c.id and ct.archived_at is null),
         c.name_normalized = key.k
  from public.companies c, key
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and public.is_member(p_workspace_id)
    and key.k <> ''
    and (
      c.name_normalized = key.k
      or c.name_normalized like key.k || '%'
      or key.k like c.name_normalized || '%'
    )
  order by (c.name_normalized = key.k) desc, c.name
  limit 5;
$$;

-- ── 名刺登録の連鎖（SCREENS 6） ───────────────────────────

create or replace function public.register_contact(
  p_workspace_id  uuid,
  p_company_name  text,
  p_company_id    uuid    default null,   -- 既存会社に足す場合
  p_contact_name  text    default null,
  p_dept          text    default null,
  p_title         text    default null,
  p_email         text    default null,
  p_phone         text    default null,
  p_industry      text    default null,
  p_employees     int     default null,
  p_revenue       text    default null,
  p_address       text    default null,
  p_web           text    default null,
  p_tier_manual   text    default null,
  p_deal_type     text    default null,
  p_deal_memo     text    default null,
  p_comment       text    default null,
  p_make_primary  boolean default true
)
returns jsonb language plpgsql security definer
set search_path = '' as $$
declare
  v_member   uuid;
  v_company  public.companies%rowtype;
  v_contact  uuid;
  v_channel  uuid;
  v_deal     uuid;
  v_task     uuid;
  v_new_company boolean := false;
  v_label    text;
begin
  v_member := public.my_member_id(p_workspace_id);
  if v_member is null then
    raise exception 'このワークスペースの所属メンバーではありません' using errcode = '42501';
  end if;

  if coalesce(trim(p_company_name), '') = '' and p_company_id is null then
    raise exception '会社名を入力してください' using errcode = '22023';
  end if;

  -- ① 会社（既存なら足すだけ。新規作成しない）
  if p_company_id is not null then
    select * into v_company from public.companies
     where id = p_company_id and workspace_id = p_workspace_id;
    if not found then
      raise exception '指定された会社が見つかりません' using errcode = 'P0002';
    end if;
  else
    insert into public.companies
      (workspace_id, name, industry, employees, revenue, address, web,
       deal_type, comment, tier_manual, owner_id,
       stage_id)
    values
      (p_workspace_id, trim(p_company_name), nullif(trim(p_industry), ''),
       coalesce(p_employees, 0), nullif(trim(p_revenue), ''),
       nullif(trim(p_address), ''), nullif(trim(p_web), ''),
       nullif(trim(p_deal_type), ''), nullif(trim(p_comment), ''),
       nullif(trim(p_tier_manual), ''), v_member,
       (select id from public.stages
         where workspace_id = p_workspace_id order by position limit 1))
    returning * into v_company;
    v_new_company := true;
  end if;

  -- ② 名刺
  if coalesce(trim(p_contact_name), '') <> '' then
    insert into public.contacts
      (workspace_id, company_id, name, dept, title, email, phone)
    values
      (p_workspace_id, v_company.id, trim(p_contact_name),
       nullif(trim(p_dept), ''), nullif(trim(p_title), ''),
       nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''))
    returning id into v_contact;

    -- 窓口。指定があるか、まだ誰も窓口でなければ立てる。
    if p_make_primary or v_company.primary_contact_id is null then
      update public.companies set primary_contact_id = v_contact where id = v_company.id;
    end if;
  end if;

  -- ③ ティア（トリガでも走るが、名刺が無い場合もあるのでここでも）
  perform public.recompute_company_tier(v_company.id);

  -- ④ 会社チャンネル
  select id into v_channel from public.channels
   where company_id = v_company.id and kind = 'company';
  if v_channel is null then
    insert into public.channels (workspace_id, kind, company_id, shape, color)
    values (p_workspace_id, 'company', v_company.id, 'hex', 'purple')
    returning id into v_channel;
  end if;
  insert into public.channel_members (channel_id, member_id)
  values (v_channel, v_member)
  on conflict do nothing;

  -- ⑤ 案件（1社1件。すでに進行中ならそのまま）
  select id into v_deal from public.deals
   where company_id = v_company.id and active;
  if v_deal is null then
    insert into public.deals (workspace_id, company_id, status, memo)
    values (p_workspace_id, v_company.id, 'talking', nullif(trim(p_deal_memo), ''))
    returning id into v_deal;
  elsif coalesce(trim(p_deal_memo), '') <> '' then
    update public.deals set memo = trim(p_deal_memo) where id = v_deal;
  end if;

  -- ⑥ 初回フォロータスク（新しい会社のときだけ）
  if v_new_company then
    insert into public.tasks
      (workspace_id, company_id, title, due_at, due_has_time,
       assignee_id, contact_id, priority, share)
    values
      (p_workspace_id, v_company.id,
       '初回フォロー：' || v_company.name,
       (now() + interval '3 days')::date::timestamptz, false,
       v_member, v_contact, '中', 'assignee')
    returning id into v_task;
  end if;

  -- ⑦ チャンネルに記録を残す
  v_label := case
    when v_new_company then v_company.name || ' を登録しました。'
    else v_company.name || ' に名刺を追加しました。'
  end;
  if v_contact is not null then
    v_label := v_label || '（' || trim(p_contact_name) ||
               coalesce(' / ' || nullif(trim(p_title), ''), '') || '）';
  end if;

  insert into public.messages (channel_id, workspace_id, text, is_system)
  values (v_channel, p_workspace_id, v_label, true);

  return jsonb_build_object(
    'company_id', v_company.id,
    'contact_id', v_contact,
    'channel_id', v_channel,
    'deal_id',    v_deal,
    'task_id',    v_task,
    'is_new',     v_new_company,
    'tier',       (select tier from public.companies where id = v_company.id)
  );
end;
$$;

revoke execute on function
  public.register_contact(uuid, text, uuid, text, text, text, text, text, text, int,
                          text, text, text, text, text, text, text, boolean),
  public.find_similar_companies(uuid, text),
  public.recompute_company_tier(uuid)
from public;

grant execute on function
  public.register_contact(uuid, text, uuid, text, text, text, text, text, text, int,
                          text, text, text, text, text, text, text, boolean),
  public.find_similar_companies(uuid, text),
  public.recompute_company_tier(uuid)
to authenticated;

-- ── 検索用の索引 ──────────────────────────────────────────
-- 会社名・担当者名・役職・部署・メールを横断検索するので、
-- 前方一致が効くよう小文字で索引を張る。

create index if not exists companies_search_idx
  on public.companies (workspace_id, lower(name));
create index if not exists contacts_search_idx
  on public.contacts (workspace_id, lower(name));
create index if not exists companies_tier_idx
  on public.companies (workspace_id, tier) where archived_at is null;
