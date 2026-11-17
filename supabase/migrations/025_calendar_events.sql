-- ═══════════════════════════════════════════════════════════
-- 025 カレンダーから予定を入れる
--
-- ① 予定（events）に「入れた人」（created_by）を足す。
--    会社に結びつかない予定（歯医者・社内の用事など）は、入れた本人にだけ見せる。
--    これまで会社の無い予定はワークスペースの全員に見えていた（予約ページの確定は必ず会社つき）。
--    会社つきの予定は今まで通り、その会社が見える人に見える（023）。
--
-- ② calendar_items に、終わりの時刻・会社・Google の予定ID・会議URLを足す。
--    1日の時間割（Google カレンダーのような縦の時間軸）に、長さどおりに並べるため。
--    Google にも入れた予定は、Google 側の同じ予定と二重に出さないよう ID で突き合わせる。
-- ═══════════════════════════════════════════════════════════

alter table public.events
  add column if not exists created_by uuid references public.workspace_members(id) on delete cascade;

create index if not exists events_created_by_idx on public.events (created_by);

-- ── RLS ───────────────────────────────────────────────────

drop policy if exists "見える打合せは参照できる" on public.events;
drop policy if exists "自分の会社の打合せは作成できる" on public.events;
drop policy if exists "自分の会社の打合せは更新できる" on public.events;
drop policy if exists "自分の会社の打合せは削除できる" on public.events;
drop policy if exists "見える予定は参照できる" on public.events;
drop policy if exists "予定を入れられる" on public.events;
drop policy if exists "自分の予定・自分の会社の予定は更新できる" on public.events;
drop policy if exists "自分の予定・自分の会社の予定は削除できる" on public.events;

create policy "見える予定は参照できる" on public.events
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      (company_id is null and (created_by is null or created_by in (select public.my_member_ids())))
      or company_id in (select public.my_visible_company_ids())
    )
  );
create policy "予定を入れられる" on public.events
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      (company_id is null and created_by in (select public.my_member_ids()))
      or company_id in (select public.my_company_ids())
    )
  );
create policy "自分の予定・自分の会社の予定は更新できる" on public.events
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (
      (company_id is null and (created_by is null or created_by in (select public.my_member_ids())))
      or company_id in (select public.my_company_ids())
    )
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      (company_id is null and created_by in (select public.my_member_ids()))
      or company_id in (select public.my_company_ids())
    )
  );
create policy "自分の予定・自分の会社の予定は削除できる" on public.events
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (
      (company_id is null and (created_by is null or created_by in (select public.my_member_ids())))
      or company_id in (select public.my_company_ids())
    )
  );

-- ── calendar_items（返り値の形が変わるので作り直す） ────────

drop function if exists public.calendar_items(uuid, date, date, text);

create function public.calendar_items(
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
  assignee_id uuid,
  end_at timestamptz,
  company_id uuid,
  gcal_event_id text,
  meet_url text
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select 'event', e.id, e.title, e.starts_at, true, false, null, null, c.name, e.created_by,
         e.starts_at + make_interval(mins => e.duration_min), e.company_id, e.gcal_event_id, e.meet_url
    from public.events e
    cross join me
    left join public.companies c on c.id = e.company_id
   where e.workspace_id = p_workspace_id
     and e.starts_at >= p_from::timestamptz
     and e.starts_at <  (p_to + 1)::timestamptz
     and me.member_id is not null
     and (
       (e.company_id is null and (e.created_by is null or e.created_by = me.member_id))
       or e.company_id in (select public.my_visible_company_ids())
     )
     and p_scope <> 'team'

  union all

  select 'task', t.id, t.title, t.due_at, t.due_has_time, t.done, t.priority, t.share,
         c.name, t.assignee_id, null::timestamptz, t.company_id, null, null
    from public.tasks t
    cross join me
    left join public.companies c on c.id = t.company_id
   where t.workspace_id = p_workspace_id
     and t.due_at is not null
     and t.due_at >= p_from::timestamptz
     and t.due_at <  (p_to + 1)::timestamptz
     and me.member_id is not null
     and (
       t.company_id is null
       or t.assignee_id = me.member_id
       or t.company_id in (select public.my_visible_company_ids())
     )
     and (
       p_scope = 'all'
       or (p_scope = 'mine' and t.assignee_id = me.member_id)
       or (p_scope = 'team' and t.share = 'team')
     )

  union all

  select 'todo', p.id, p.title, p.due_at, p.due_has_time, p.done, p.priority, 'self',
         null, p.member_id, null::timestamptz, null::uuid, null, null
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

revoke execute on function public.calendar_items(uuid, date, date, text) from public, anon;
grant execute on function public.calendar_items(uuid, date, date, text) to authenticated;
