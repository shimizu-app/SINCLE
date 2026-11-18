-- ═══════════════════════════════════════════════════════════
-- 026 名刺を登録しても、初回フォローのタスクを自動で作らない
--
-- これまでは新しい会社を登録するたびに「初回フォロー：◯◯」のタスクが3日後で入っていた。
-- 初回に連絡するかどうかは人によって違い、毎回出るのは邪魔なので、自動では作らない。
-- 入れたい人は、登録の画面の「フォローのタスクも入れる」にチェックする（画面側で入れる）。
--
-- 引数と返り値は変えない（task_id は null で返る）。中身だけ差し替える。
-- ═══════════════════════════════════════════════════════════

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

  -- ① 会社（既存なら足すだけ。足せるのは自分の会社＝自分が登録・担当・共有されたものだけ）
  if p_company_id is not null then
    select * into v_company from public.companies
     where id = p_company_id and workspace_id = p_workspace_id;
    if not found or not public.is_my_company(p_company_id) then
      raise exception '指定された会社が見つかりません' using errcode = 'P0002';
    end if;
  else
    insert into public.companies
      (workspace_id, name, industry, employees, revenue, address, web,
       deal_type, comment, tier_manual, owner_id, registered_by,
       stage_id)
    values
      (p_workspace_id, trim(p_company_name), nullif(trim(p_industry), ''),
       coalesce(p_employees, 0), nullif(trim(p_revenue), ''),
       nullif(trim(p_address), ''), nullif(trim(p_web), ''),
       nullif(trim(p_deal_type), ''), nullif(trim(p_comment), ''),
       nullif(trim(p_tier_manual), ''), v_member, v_member,
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

    if p_make_primary or v_company.primary_contact_id is null then
      update public.companies set primary_contact_id = v_contact where id = v_company.id;
    end if;
  end if;

  -- ③ ティア
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

  -- ⑥ 初回フォローのタスクは、もう自動では作らない（026）。
  --    連絡するかどうかは人によって違うので、入れたい人だけ登録の画面で選ぶ。

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
