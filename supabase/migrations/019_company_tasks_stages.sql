-- ═══════════════════════════════════════════════════════════
-- 019 会社詳細のタスクタブと、ステージの編集
--
-- ① list_tasks に会社の絞り込みを足す。
--    会社詳細では「この会社のタスク」だけ見たい。
--    ワークスペース全件（上限500件）を引いて画面側で捨てると、
--    件数が増えたときに会社のタスクが落ちる。
--
-- ② ステージの書き換えを管理者だけに絞る。
--    ステージはワークスペース全体の共有設定なので、
--    画面で隠すだけでなく RLS でも閉める（SPEC 0章）。
-- ═══════════════════════════════════════════════════════════

-- ── ① 会社で絞れるタスク一覧 ──────────────────────────────
-- 引数が増えると別の関数になり、PostgREST から呼ぶときに
-- どちらを指しているか決まらなくなる。先に古い方を落とす。

drop function if exists public.list_tasks(uuid, boolean, uuid);

create or replace function public.list_tasks(
  p_workspace_id uuid,
  p_done boolean default false,
  p_assignee uuid default null,
  p_company_id uuid default null
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
  left join public.companies c         on c.id  = t.company_id
  left join public.workspace_members m on m.id  = t.assignee_id
  left join public.contacts ct         on ct.id = t.contact_id
  where t.workspace_id = p_workspace_id
    and public.is_member(p_workspace_id)
    and t.done = coalesce(p_done, false)
    and (p_assignee is null or t.assignee_id = p_assignee)
    and (p_company_id is null or t.company_id = p_company_id)
  order by
    t.due_at asc nulls last,
    case t.priority when '高' then 0 when '中' then 1 else 2 end,
    t.created_at desc
  limit 500;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_tasks'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ── ② ステージの書き換えは管理者だけ ──────────────────────
-- 参照は所属メンバー全員。並び順と名前を変えるのは管理者。

drop policy if exists "所属メンバーは作成できる" on public.stages;
drop policy if exists "所属メンバーは更新できる" on public.stages;
drop policy if exists "所属メンバーは削除できる" on public.stages;
drop policy if exists "管理者は作成できる"     on public.stages;
drop policy if exists "管理者は更新できる"     on public.stages;
drop policy if exists "管理者は削除できる"     on public.stages;

create policy "管理者は作成できる" on public.stages
  for insert with check (workspace_id in (select public.my_admin_workspace_ids()));

create policy "管理者は更新できる" on public.stages
  for update using (workspace_id in (select public.my_admin_workspace_ids()))
             with check (workspace_id in (select public.my_admin_workspace_ids()));

create policy "管理者は削除できる" on public.stages
  for delete using (workspace_id in (select public.my_admin_workspace_ids()));
