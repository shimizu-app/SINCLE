-- ═══════════════════════════════════════════════════════════
-- 023 名刺（会社）の見える範囲
--
-- これまで：ワークスペースの全員が、全員の名刺・会社を見て書き換えられた。
-- これから：
--   ① 名刺と会社は、登録した本人のもの。見えるのは本人と担当者だけ。
--   ② 会社ごとに「チームに共有」すると、全員が見て書ける。
--   ③ 管理者から「全員の名刺を見る」許可（can_view_all）をもらった人だけが、
--      全員の登録を見られる。管理者でも、許可が無ければ見えない。
--      許可は「見る」だけ。人の会社を書き換えることはできない。
--   ④ 全員が登録したものは、会社全体の一覧に自動で入る。
--      同じ会社を何人かが登録していたら、そこで1つにまとめて見せる（company_groups）。
--      行そのものは1人1件のまま。
--
-- 会社に付いているもの（名刺・案件・タスク・書類・打合せ・メール・予約ページ・
-- 会社チャンネルの投稿）は、会社が見える人にだけ見える。
--
-- 言葉の決まり
--   「自分の会社」 my_company_ids()        … 自分が登録した・担当している・共有された
--   「見える会社」 my_visible_company_ids() … 上に加えて、許可があればワークスペースの全社
--   読むのは「見える会社」、書くのは「自分の会社」。
-- ═══════════════════════════════════════════════════════════

-- ── ① 列 ──────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'can_view_all'
  ) then
    alter table public.workspace_members
      add column can_view_all boolean not null default false;
    -- 今までは全員が全部を見ていた。いまの管理者が急に何も見えなくならないよう、
    -- 最初の1回だけ許可を付けておく（設定のメンバー一覧から外せる）。
    -- これから管理者になる人には自動では付かない。
    update public.workspace_members set can_view_all = true where is_admin;
  end if;
end $$;

alter table public.companies
  -- 登録した人。あとから変わらない（担当者 owner_id は変えられる）
  add column if not exists registered_by uuid references public.workspace_members(id) on delete set null,
  -- チームに共有したか
  add column if not exists shared boolean not null default false;

-- これまでの会社は、担当者を登録した人とみなす。
-- 更新日時を動かさないよう、更新日時のトリガは止めておく
alter table public.companies disable trigger companies_touch;
update public.companies set registered_by = owner_id
 where registered_by is null and owner_id is not null;
alter table public.companies enable trigger companies_touch;

create index if not exists companies_registered_by_idx on public.companies (registered_by);
create index if not exists companies_shared_idx on public.companies (workspace_id) where shared;
create index if not exists companies_group_idx
  on public.companies (workspace_id, name_normalized) where archived_at is null;

-- ── ② 見える範囲のヘルパー ────────────────────────────────
-- 引数なしで集合を返す形にして、ポリシーでは (select …) で1回だけ評価させる（014 と同じ）

/** 自分の会社：自分が登録した・担当している・チームに共有された */
create or replace function public.my_company_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select c.id
    from public.companies c
    join public.workspace_members m
      on m.workspace_id = c.workspace_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
   where c.shared or c.registered_by = m.id or c.owner_id = m.id;
$$;

/** 見える会社：自分の会社に加えて、許可のあるワークスペースの会社すべて */
create or replace function public.my_visible_company_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select c.id
    from public.companies c
    join public.workspace_members m
      on m.workspace_id = c.workspace_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
   where m.can_view_all or c.shared or c.registered_by = m.id or c.owner_id = m.id;
$$;

/** 1社ぶんの判定（security definer の関数の中で使う） */
create or replace function public.can_see_company(p_company uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1
      from public.companies c
      join public.workspace_members m
        on m.workspace_id = c.workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
     where c.id = p_company
       and (m.can_view_all or c.shared or c.registered_by = m.id or c.owner_id = m.id)
  );
$$;

create or replace function public.is_my_company(p_company uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1
      from public.companies c
      join public.workspace_members m
        on m.workspace_id = c.workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
     where c.id = p_company
       and (c.shared or c.registered_by = m.id or c.owner_id = m.id)
  );
$$;

/** 「全員の名刺を見る」許可があるか */
create or replace function public.can_view_all(p_workspace_id uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace_id
       and user_id = (select auth.uid())
       and status = 'active'
       and can_view_all
  );
$$;

/** 読めるチャンネル：参加しているグループと、見える会社の会社チャンネル */
create or replace function public.my_readable_channel_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select ch.id from public.channels ch
   where ch.kind = 'group'
     and ch.id in (select public.my_channel_ids())
  union
  select ch.id from public.channels ch
   where ch.kind = 'company'
     and ch.company_id in (select public.my_visible_company_ids());
$$;

/** 書けるチャンネル：参加しているグループと、自分の会社の会社チャンネル */
create or replace function public.my_writable_channel_ids()
returns setof uuid language sql security definer stable
set search_path = '' as $$
  select ch.id from public.channels ch
   where ch.kind = 'group'
     and ch.id in (select public.my_channel_ids())
  union
  select ch.id from public.channels ch
   where ch.kind = 'company'
     and ch.company_id in (select public.my_company_ids());
$$;

-- ── ③ 見張り ──────────────────────────────────────────────

/** 会社を作った人を、必ず登録者にする（他人の名前で作らせない） */
create or replace function public.set_company_registrant()
returns trigger language plpgsql
set search_path = '' as $$
begin
  -- ログインした人が直接作るときは本人。security definer の関数（register_contact）は自分で入れる
  if current_user in ('authenticated', 'anon') or new.registered_by is null then
    new.registered_by := coalesce(public.my_member_id(new.workspace_id), new.registered_by);
  end if;
  return new;
end;
$$;

drop trigger if exists companies_registrant on public.companies;
create trigger companies_registrant
  before insert on public.companies
  for each row execute function public.set_company_registrant();

/** 会社の書き換え：登録者は変えさせない。共有の付け外しは、登録者・担当者・管理者だけ */
create or replace function public.guard_company_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.workspace_id is distinct from old.workspace_id
     or new.registered_by is distinct from old.registered_by then
    raise exception 'この項目は変更できません' using errcode = '42501';
  end if;

  if new.shared is distinct from old.shared
     and not (
       old.registered_by in (select public.my_member_ids())
       or old.owner_id in (select public.my_member_ids())
       or public.is_ws_admin(old.workspace_id)
     ) then
    raise exception '共有を変えられるのは、登録した人・担当者・管理者だけです' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists companies_guard on public.companies;
create trigger companies_guard
  before update on public.companies
  for each row execute function public.guard_company_update();

/** メンバーの行の見張り（022）に「全員の名刺を見る」を足す。付け外しは管理者だけ */
create or replace function public.guard_member_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.workspace_id is distinct from old.workspace_id
     or new.user_id is distinct from old.user_id then
    raise exception 'この項目は変更できません' using errcode = '42501';
  end if;

  if lower(new.email) is distinct from lower(old.email)
     and not (old.user_id is null and public.is_ws_admin(old.workspace_id)) then
    raise exception 'メールアドレスは変更できません' using errcode = '42501';
  end if;

  if (new.is_admin is distinct from old.is_admin
      or new.status is distinct from old.status
      or new.can_view_all is distinct from old.can_view_all)
     and not public.is_ws_admin(old.workspace_id) then
    raise exception '管理者だけが変更できます' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ── ④ RLS ────────────────────────────────────────────────

-- companies
drop policy if exists "所属メンバーは参照できる" on public.companies;
drop policy if exists "所属メンバーは作成できる" on public.companies;
drop policy if exists "所属メンバーは更新できる" on public.companies;
drop policy if exists "所属メンバーは削除できる" on public.companies;
drop policy if exists "見える会社は参照できる" on public.companies;
drop policy if exists "自分の会社は更新できる" on public.companies;
drop policy if exists "登録者・担当者・管理者は削除できる" on public.companies;

create policy "見える会社は参照できる" on public.companies
  for select using (id in (select public.my_visible_company_ids()));
create policy "所属メンバーは作成できる" on public.companies
  for insert with check (workspace_id in (select public.my_workspace_ids()));
create policy "自分の会社は更新できる" on public.companies
  for update using (id in (select public.my_company_ids()))
             with check (workspace_id in (select public.my_workspace_ids()));
create policy "登録者・担当者・管理者は削除できる" on public.companies
  for delete using (
    id in (select public.my_company_ids())
    and (
      registered_by in (select public.my_member_ids())
      or owner_id in (select public.my_member_ids())
      or workspace_id in (select public.my_admin_workspace_ids())
    )
  );

-- 会社に必ず付くもの：名刺・案件・書類・予約ページ
do $$
declare
  t text;
  tables text[] := array['contacts', 'deals', 'documents', 'booking_links'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "所属メンバーは参照できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは作成できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは更新できる" on public.%I', t);
    execute format('drop policy if exists "所属メンバーは削除できる" on public.%I', t);
    execute format('drop policy if exists "見える会社のものは参照できる" on public.%I', t);
    execute format('drop policy if exists "自分の会社には作成できる" on public.%I', t);
    execute format('drop policy if exists "自分の会社のものは更新できる" on public.%I', t);
    execute format('drop policy if exists "自分の会社のものは削除できる" on public.%I', t);

    execute format($f$
      create policy "見える会社のものは参照できる" on public.%I
        for select using (company_id in (select public.my_visible_company_ids()));
      $f$, t);
    execute format($f$
      create policy "自分の会社には作成できる" on public.%I
        for insert with check (
          workspace_id in (select public.my_workspace_ids())
          and company_id in (select public.my_company_ids())
        );
      $f$, t);
    execute format($f$
      create policy "自分の会社のものは更新できる" on public.%I
        for update using (company_id in (select public.my_company_ids()))
                   with check (
                     workspace_id in (select public.my_workspace_ids())
                     and company_id in (select public.my_company_ids())
                   );
      $f$, t);
    execute format($f$
      create policy "自分の会社のものは削除できる" on public.%I
        for delete using (company_id in (select public.my_company_ids()));
      $f$, t);
  end loop;
end $$;

-- 会社に付くことがあるもの：タスク・打合せ
-- 会社の無いもの（社内のタスクなど）は、今まで通りワークスペースの全員
-- タスクは、担当になっている人にも見せる（会社が見えなくても、自分の仕事は分かるように）
drop policy if exists "所属メンバーは参照できる" on public.tasks;
drop policy if exists "所属メンバーは作成できる" on public.tasks;
drop policy if exists "所属メンバーは更新できる" on public.tasks;
drop policy if exists "所属メンバーは削除できる" on public.tasks;
drop policy if exists "見えるタスクは参照できる" on public.tasks;
drop policy if exists "自分の会社のタスクは作成できる" on public.tasks;
drop policy if exists "自分の会社のタスク・自分が担当のタスクは更新できる" on public.tasks;
drop policy if exists "自分の会社のタスクは削除できる" on public.tasks;

create policy "見えるタスクは参照できる" on public.tasks
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      company_id is null
      or company_id in (select public.my_visible_company_ids())
      or assignee_id in (select public.my_member_ids())
    )
  );
create policy "自分の会社のタスクは作成できる" on public.tasks
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  );
create policy "自分の会社のタスク・自分が担当のタスクは更新できる" on public.tasks
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (
      company_id is null
      or company_id in (select public.my_company_ids())
      or assignee_id in (select public.my_member_ids())
    )
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (
      company_id is null
      or company_id in (select public.my_company_ids())
      or assignee_id in (select public.my_member_ids())
    )
  );
create policy "自分の会社のタスクは削除できる" on public.tasks
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  );

drop policy if exists "所属メンバーは参照できる" on public.events;
drop policy if exists "所属メンバーは作成できる" on public.events;
drop policy if exists "所属メンバーは更新できる" on public.events;
drop policy if exists "所属メンバーは削除できる" on public.events;
drop policy if exists "見える打合せは参照できる" on public.events;
drop policy if exists "自分の会社の打合せは作成できる" on public.events;
drop policy if exists "自分の会社の打合せは更新できる" on public.events;
drop policy if exists "自分の会社の打合せは削除できる" on public.events;

create policy "見える打合せは参照できる" on public.events
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_visible_company_ids()))
  );
create policy "自分の会社の打合せは作成できる" on public.events
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  );
create policy "自分の会社の打合せは更新できる" on public.events
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  );
create policy "自分の会社の打合せは削除できる" on public.events
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_company_ids()))
  );

-- メール：見える会社のもの＋自分が取り込んだ・送ったもの。
-- 会社に結びつかないメール（取り込み範囲「すべて」のとき）は、取り込んだ本人だけ
drop policy if exists "所属メンバーは参照できる" on public.mails;
drop policy if exists "所属メンバーは作成できる" on public.mails;
drop policy if exists "所属メンバーは更新できる" on public.mails;
drop policy if exists "所属メンバーは削除できる" on public.mails;
drop policy if exists "見えるメールは参照できる" on public.mails;
drop policy if exists "自分のメールは作成できる" on public.mails;
drop policy if exists "自分のメール・自分の会社のメールは更新できる" on public.mails;
drop policy if exists "自分のメール・自分の会社のメールは削除できる" on public.mails;

create policy "見えるメールは参照できる" on public.mails
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (
      imported_by in (select public.my_member_ids())
      or company_id in (select public.my_visible_company_ids())
      or (company_id is null and imported_by is null)
    )
  );
create policy "自分のメールは作成できる" on public.mails
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (imported_by is null or imported_by in (select public.my_member_ids()))
    and (company_id is null or company_id in (select public.my_visible_company_ids()))
  );
create policy "自分のメール・自分の会社のメールは更新できる" on public.mails
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (
      imported_by in (select public.my_member_ids())
      or company_id in (select public.my_company_ids())
      or (company_id is null and imported_by is null)
    )
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (company_id is null or company_id in (select public.my_visible_company_ids()))
  );
create policy "自分のメール・自分の会社のメールは削除できる" on public.mails
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (
      imported_by in (select public.my_member_ids())
      or company_id in (select public.my_company_ids())
    )
  );

-- 同じメールを1件にまとめる単位（021）を「会社ごと」にする。
-- これまでは1つのワークスペースで1件だったので、先に取り込んだ人の会社にだけ入り、
-- 同じ相手を別に登録している人には届かなかった。
-- 会社に結びつかないメールは、取り込んだ人ごと。
alter table public.mails
  add column if not exists dedupe_key uuid generated always as (coalesce(company_id, imported_by)) stored;
drop index if exists public.mails_workspace_rfc_key;
create unique index if not exists mails_dedupe_rfc_key
  on public.mails (workspace_id, dedupe_key, rfc_message_id);
create index if not exists mails_rfc_idx on public.mails (workspace_id, rfc_message_id);

-- チャンネル：会社チャンネルは会社が見える人だけ。グループは今まで通り
drop policy if exists "所属メンバーは参照できる" on public.channels;
drop policy if exists "所属メンバーは作成できる" on public.channels;
drop policy if exists "所属メンバーは更新できる" on public.channels;
drop policy if exists "所属メンバーは削除できる" on public.channels;
drop policy if exists "見えるチャンネルは参照できる" on public.channels;
drop policy if exists "チャンネルを作成できる" on public.channels;
drop policy if exists "チャンネルを更新できる" on public.channels;
drop policy if exists "チャンネルを削除できる" on public.channels;

create policy "見えるチャンネルは参照できる" on public.channels
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and (kind = 'group' or company_id in (select public.my_visible_company_ids()))
  );
create policy "チャンネルを作成できる" on public.channels
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and (kind = 'group' or company_id in (select public.my_company_ids()))
  );
create policy "チャンネルを更新できる" on public.channels
  for update using (
    workspace_id in (select public.my_workspace_ids())
    and (kind = 'group' or company_id in (select public.my_company_ids()))
  ) with check (
    workspace_id in (select public.my_workspace_ids())
    and (kind = 'group' or company_id in (select public.my_company_ids()))
  );
create policy "チャンネルを削除できる" on public.channels
  for delete using (
    workspace_id in (select public.my_workspace_ids())
    and (kind = 'group' or company_id in (select public.my_company_ids()))
  );

-- 投稿
drop policy if exists "読めるチャンネルのメッセージは参照できる" on public.messages;
drop policy if exists "読めるチャンネルには投稿できる" on public.messages;

create policy "読めるチャンネルのメッセージは参照できる" on public.messages
  for select using (
    workspace_id in (select public.my_workspace_ids())
    and channel_id in (select public.my_readable_channel_ids())
  );
create policy "読めるチャンネルには投稿できる" on public.messages
  for insert with check (
    workspace_id in (select public.my_workspace_ids())
    and channel_id in (select public.my_writable_channel_ids())
  );

-- ── ⑤ ファイル（Storage） ─────────────────────────────────
-- 書類・名刺画像のパスは {workspace_id}/{company_id}/…（011）。
-- 2つ目のフォルダの会社が見えなければ、ファイルも開けない。

create or replace function public.company_from_path(p_name text)
returns uuid language sql immutable
set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

drop policy if exists "SYNCLE: 所属ワークスペースのファイルを読める" on storage.objects;
drop policy if exists "SYNCLE: 所属ワークスペースにアップロードできる" on storage.objects;
drop policy if exists "SYNCLE: 所属ワークスペースのファイルを更新できる" on storage.objects;
drop policy if exists "SYNCLE: 所属ワークスペースのファイルを削除できる" on storage.objects;
drop policy if exists "SYNCLE: 見えるファイルを読める" on storage.objects;
drop policy if exists "SYNCLE: 自分の会社にアップロードできる" on storage.objects;
drop policy if exists "SYNCLE: 自分の会社のファイルを更新できる" on storage.objects;
drop policy if exists "SYNCLE: 自分の会社のファイルを削除できる" on storage.objects;

create policy "SYNCLE: 見えるファイルを読める" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
    and (
      bucket_id = 'avatars'
      or public.company_from_path(name) in (select public.my_visible_company_ids())
    )
  );

create policy "SYNCLE: 自分の会社にアップロードできる" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
    and (
      bucket_id = 'avatars'
      or public.company_from_path(name) in (select public.my_company_ids())
    )
  );

create policy "SYNCLE: 自分の会社のファイルを更新できる" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
    and (
      bucket_id = 'avatars'
      or public.company_from_path(name) in (select public.my_company_ids())
    )
  );

create policy "SYNCLE: 自分の会社のファイルを削除できる" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
    and (
      bucket_id = 'avatars'
      or public.company_from_path(name) in (select public.my_company_ids())
    )
  );

-- ── ⑥ 関数：一覧・検索 ────────────────────────────────────

-- 会社一覧。p_scope = mine（自分の会社）| all（許可がある人だけ：全員の登録）
drop function if exists public.search_companies(uuid, text, text, text, text, text, int);

create or replace function public.search_companies(
  p_workspace_id uuid,
  p_q            text default null,
  p_tier         text default null,   -- 'A' | 'B' | 'C'
  p_industry     text default null,
  p_deal_type    text default null,
  p_sort         text default 'new',  -- new | old | tier | stage | name
  p_limit        int  default 200,
  p_scope        text default 'mine'  -- mine | all
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
  deal_updated_at timestamptz,
  shared boolean,
  registered_by uuid,
  registrant_name text,
  is_mine boolean
)
language sql security definer stable
set search_path = '' as $$
  with me as (
    select m.id, m.can_view_all from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
  ),
  q as (
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
    d.status, d.updated_at,
    c.shared, c.registered_by, rm.name,
    (c.registered_by = me.id or c.owner_id = me.id)
  from public.companies c
  cross join me
  cross join q
  cross join total
  left join public.stages   s  on s.id  = c.stage_id
  left join public.contacts pc on pc.id = c.primary_contact_id
  left join public.deals    d  on d.company_id = c.id and d.active
  left join public.workspace_members rm on rm.id = c.registered_by
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and (
      c.shared or c.registered_by = me.id or c.owner_id = me.id
      or (p_scope = 'all' and me.can_view_all)
    )
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

/** ヘッダーに出す件数（自分の会社の範囲） */
create or replace function public.customer_counts(p_workspace_id uuid)
returns table (companies bigint, tier_a bigint, open_tasks bigint, unreplied_mails bigint)
language sql security definer stable
set search_path = '' as $$
  with me as (
    select m.id from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
  ),
  mine as (
    select c.id, c.tier, c.tier_manual from public.companies c, me
     where c.workspace_id = p_workspace_id and c.archived_at is null
       and (c.shared or c.registered_by = me.id or c.owner_id = me.id)
  )
  select
    (select count(*) from mine),
    (select count(*) from mine where coalesce(tier_manual, tier) = 'A'),
    (select count(*) from public.tasks t, me
      where t.workspace_id = p_workspace_id and not t.done
        and (t.company_id is null or t.company_id in (select id from mine) or t.assignee_id = me.id)),
    (select count(*) from public.mails ml, me
      where ml.workspace_id = p_workspace_id and ml.direction = 'in' and not ml.replied
        and (ml.imported_by = me.id or ml.company_id in (select id from mine)))
  from me;
$$;

/** 絞り込みに出す選択肢（自分の会社の範囲） */
create or replace function public.company_facets(p_workspace_id uuid)
returns table (kind text, value text, count bigint)
language sql security definer stable
set search_path = '' as $$
  with me as (
    select m.id from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
  ),
  mine as (
    select c.* from public.companies c, me
     where c.workspace_id = p_workspace_id and c.archived_at is null
       and (c.shared or c.registered_by = me.id or c.owner_id = me.id)
  )
  select 'tier', tier, count(*) from mine where tier is not null group by tier
  union all
  select 'industry', industry, count(*) from mine where coalesce(industry, '') <> '' group by industry
  union all
  select 'deal_type', deal_type, count(*) from mine where coalesce(deal_type, '') <> '' group by deal_type;
$$;

/** 重複しそうな会社（名刺登録のとき）。自分の会社の中だけで探す */
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
  with key as (select public.normalize_company_name(p_name) as k),
  me as (
    select m.id from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
  )
  select c.id, c.name, c.industry, c.tier, c.employees,
         (select count(*) from public.contacts ct
           where ct.company_id = c.id and ct.archived_at is null),
         c.name_normalized = key.k
  from public.companies c, key, me
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and (c.shared or c.registered_by = me.id or c.owner_id = me.id)
    and key.k <> ''
    and (
      c.name_normalized = key.k
      or c.name_normalized like key.k || '%'
      or key.k like c.name_normalized || '%'
    )
  order by (c.name_normalized = key.k) desc, c.name
  limit 5;
$$;

-- ── ⑦ 関数：会社全体のまとめ（許可のある人だけ） ──────────────
-- 同じ会社（法人格と空白を落とした名前が同じ）を1つにまとめる。

create or replace function public.company_groups(
  p_workspace_id uuid,
  p_q     text default null,
  p_tier  text default null,
  p_limit int  default 300
)
returns table (
  key text,
  name text,
  record_count bigint,
  registrants text[],
  contact_count bigint,
  tier text,
  industry text,
  shared boolean,
  active_deals bigint,
  open_task_count bigint,
  latest_at timestamptz,
  company_ids uuid[]
)
language sql security definer stable
set search_path = '' as $$
  with q as (
    select nullif(lower(trim(coalesce(p_q, ''))), '') as needle
  ),
  base as (
    select
      coalesce(nullif(c.name_normalized, ''), c.id::text) as gkey,
      c.id, c.name, c.industry, c.tier, c.shared, c.created_at, c.updated_at, c.registered_by,
      (select count(*) from public.contacts ct
        where ct.company_id = c.id and ct.archived_at is null) as n_contacts,
      (select count(*) from public.tasks t
        where t.company_id = c.id and not t.done) as n_tasks,
      exists (select 1 from public.deals d where d.company_id = c.id and d.active) as deal_active
    from public.companies c
    cross join q
    where c.workspace_id = p_workspace_id
      and c.archived_at is null
      and public.can_view_all(p_workspace_id)
      and (
        q.needle is null
        or lower(c.name) like '%' || q.needle || '%'
        or lower(coalesce(c.industry, '')) like '%' || q.needle || '%'
        or exists (
          select 1 from public.contacts ct
           where ct.company_id = c.id and ct.archived_at is null
             and (
               lower(ct.name) like '%' || q.needle || '%'
               or lower(coalesce(ct.email, '')) like '%' || q.needle || '%'
             )
        )
      )
  )
  select
    b.gkey,
    (array_agg(b.name order by b.created_at))[1],
    count(*),
    array_remove(array_agg(distinct m.name), null),
    sum(b.n_contacts)::bigint,
    min(b.tier),
    (array_agg(b.industry order by b.created_at) filter (where coalesce(b.industry, '') <> ''))[1],
    bool_or(b.shared),
    count(*) filter (where b.deal_active),
    sum(b.n_tasks)::bigint,
    max(b.updated_at),
    array_agg(b.id order by b.created_at)
  from base b
  left join public.workspace_members m on m.id = b.registered_by
  group by b.gkey
  having p_tier is null or min(b.tier) = p_tier
  order by max(b.updated_at) desc
  limit greatest(coalesce(p_limit, 300), 1);
$$;

/** まとめた会社の中身：誰がどう登録しているか */
create or replace function public.company_group(p_workspace_id uuid, p_key text)
returns table (
  id uuid,
  name text,
  industry text,
  tier text,
  shared boolean,
  created_at timestamptz,
  updated_at timestamptz,
  registered_by uuid,
  registrant_name text,
  registrant_avatar jsonb,
  owner_name text,
  stage_name text,
  contact_count bigint,
  open_task_count bigint,
  deal_status text,
  deal_updated_at timestamptz
)
language sql security definer stable
set search_path = '' as $$
  select
    c.id, c.name, c.industry, c.tier, c.shared, c.created_at, c.updated_at,
    c.registered_by, rm.name, rm.avatar, om.name, s.name,
    (select count(*) from public.contacts ct
      where ct.company_id = c.id and ct.archived_at is null),
    (select count(*) from public.tasks t where t.company_id = c.id and not t.done),
    d.status, d.updated_at
  from public.companies c
  left join public.workspace_members rm on rm.id = c.registered_by
  left join public.workspace_members om on om.id = c.owner_id
  left join public.stages s on s.id = c.stage_id
  left join public.deals d on d.company_id = c.id and d.active
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and coalesce(nullif(c.name_normalized, ''), c.id::text) = p_key
    and public.can_view_all(p_workspace_id)
  order by c.created_at;
$$;

/** まとめた会社の名刺を全部（同じ人の重複は画面でまとめる） */
create or replace function public.company_group_contacts(p_workspace_id uuid, p_key text)
returns table (
  id uuid,
  company_id uuid,
  name text,
  dept text,
  title text,
  email text,
  phone text,
  created_at timestamptz,
  registrant_name text
)
language sql security definer stable
set search_path = '' as $$
  select ct.id, ct.company_id, ct.name, ct.dept, ct.title, ct.email, ct.phone, ct.created_at, rm.name
  from public.contacts ct
  join public.companies c on c.id = ct.company_id
  left join public.workspace_members rm on rm.id = c.registered_by
  where c.workspace_id = p_workspace_id
    and c.archived_at is null
    and ct.archived_at is null
    and coalesce(nullif(c.name_normalized, ''), c.id::text) = p_key
    and public.can_view_all(p_workspace_id)
  order by ct.created_at;
$$;

/** Gmail の取り込みに使う名刺：自分の会社のものだけ（人の顧客のメールを拾わない） */
create or replace function public.my_mail_contacts(p_workspace_id uuid)
returns table (id uuid, email text, company_id uuid, mail_watch boolean)
language sql security definer stable
set search_path = '' as $$
  select ct.id, ct.email, ct.company_id, ct.mail_watch
  from public.contacts ct
  where ct.workspace_id = p_workspace_id
    and ct.archived_at is null
    and ct.email is not null
    and ct.company_id in (select public.my_company_ids())
  limit 5000;
$$;

-- ── ⑧ 関数：登録・記録（自分の会社にだけ書ける） ────────────

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

/** 案件を完了にする（自分の会社だけ） */
create or replace function public.complete_deal(p_deal_id uuid, p_note text default null)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_deal public.deals%rowtype;
  v_company text;
  v_channel uuid;
begin
  select * into v_deal from public.deals where id = p_deal_id;
  if not found or not public.is_my_company(v_deal.company_id) then
    raise exception '案件が見つかりません' using errcode = 'P0002';
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

/** 記録を1行で残す（自分の会社だけ） */
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
  if v_ws is null or not public.is_my_company(p_company_id) then
    raise exception '会社が見つかりません' using errcode = 'P0002';
  end if;
  v_me := public.my_member_id(v_ws);

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

  update public.deals set updated_at = now()
   where company_id = p_company_id and active;

  return v_id;
end;
$$;

-- ── ⑨ 関数：会社に付くものの一覧（見える会社だけ） ──────────

create or replace function public.company_timeline(
  p_company_id uuid,
  p_filter text default 'all',
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  kind text,
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
    select workspace_id from public.companies
     where id = p_company_id and public.can_see_company(p_company_id)
  )
  select * from (
    select 'mail'::text, m.id, m.subject, coalesce(m.excerpt, m.body), m.sent_at,
           m.replied, m.direction, null::text, null::jsonb
      from public.mails m, ws
     where m.company_id = p_company_id
       and p_filter in ('all', 'mail')

    union all

    select 'meeting', e.id, e.title, e.format, e.starts_at,
           e.starts_at < now(), null, null, null
      from public.events e, ws
     where e.company_id = p_company_id
       and p_filter in ('all', 'meeting')

    union all

    select 'task', t.id, t.title, null, coalesce(t.due_at, t.created_at),
           t.done, null, wm.name, wm.avatar
      from public.tasks t
      cross join ws
      left join public.workspace_members wm on wm.id = t.assignee_id
     where t.company_id = p_company_id
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
       and p_filter in ('all', 'talk')
  ) rows(kind, id, title, body, at, done, direction, author_name, author_avatar)
  order by at desc
  limit greatest(coalesce(p_limit, 30), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.list_deals(
  p_workspace_id uuid,
  p_sort text default 'stale'
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
    and c.id in (select public.my_visible_company_ids())
  order by
    case when p_sort = 'stale' then d.updated_at end asc,
    case when p_sort = 'new'   then d.updated_at end desc,
    d.updated_at asc;
$$;

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
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select
    t.id, t.title, t.due_at, t.due_has_time,
    t.priority, t.share, t.done, t.created_at,
    t.company_id, c.name,
    t.assignee_id, m.name, m.avatar,
    ct.name,
    (select count(*) from public.subtasks s where s.task_id = t.id),
    (select count(*) from public.subtasks s where s.task_id = t.id and s.done)
  from public.tasks t
  cross join me
  left join public.companies c         on c.id  = t.company_id
  left join public.workspace_members m on m.id  = t.assignee_id
  left join public.contacts ct         on ct.id = t.contact_id
  where t.workspace_id = p_workspace_id
    and me.member_id is not null
    and (
      t.company_id is null
      or t.assignee_id = me.member_id
      or t.company_id in (select public.my_visible_company_ids())
    )
    and t.done = coalesce(p_done, false)
    and (p_assignee is null or t.assignee_id = p_assignee)
    and (p_company_id is null or t.company_id = p_company_id)
  order by
    t.due_at asc nulls last,
    case t.priority when '高' then 0 when '中' then 1 else 2 end,
    t.created_at desc
  limit 500;
$$;

create or replace function public.calendar_items(
  p_workspace_id uuid,
  p_from date,
  p_to   date,
  p_scope text default 'all'
)
returns table (
  kind text,
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
    cross join me
    left join public.companies c on c.id = e.company_id
   where e.workspace_id = p_workspace_id
     and e.starts_at >= p_from::timestamptz
     and e.starts_at <  (p_to + 1)::timestamptz
     and me.member_id is not null
     and (e.company_id is null or e.company_id in (select public.my_visible_company_ids()))
     and p_scope <> 'team'

  union all

  select 'task', t.id, t.title, t.due_at, t.due_has_time, t.done, t.priority, t.share,
         c.name, t.assignee_id
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

-- チャンネル一覧：会社チャンネルは「自分の会社」のものだけ並べる。
-- 許可のある人は人の会社のチャンネルも読めるが、一覧と未読には混ぜない（会社の画面から見る）
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
    and me.member_id is not null
    and (
      (ch.kind = 'company' and ch.company_id in (select public.my_company_ids()))
      or (ch.kind = 'group' and exists (
            select 1 from public.channel_members cm
             where cm.channel_id = ch.id and cm.member_id = me.member_id))
    )
  order by 12 desc nulls last;
$$;

create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql security definer stable
set search_path = '' as $$
  select p_channel in (select public.my_readable_channel_ids());
$$;

/** 既読にする。読めないチャンネルには何もしない */
create or replace function public.mark_channel_read(p_channel_id uuid)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_ws uuid;
  v_me uuid;
begin
  select workspace_id into v_ws from public.channels where id = p_channel_id;
  if v_ws is null or not public.can_read_channel(p_channel_id) then return; end if;
  v_me := public.my_member_id(v_ws);
  if v_me is null then return; end if;

  insert into public.channel_members (channel_id, member_id, last_read_at)
  values (p_channel_id, v_me, now())
  on conflict (channel_id, member_id) do update set last_read_at = now();
end;
$$;

-- メンバー一覧に「全員の名刺を見る」を足す。返り値の形が変わるので作り直す
drop function if exists public.list_members(uuid);
create function public.list_members(p_workspace_id uuid)
returns table (
  id uuid, name text, role text, email text, avatar jsonb, note text,
  is_admin boolean, status text, is_me boolean,
  company_count bigint, open_task_count bigint,
  can_view_all boolean
)
language sql security definer stable
set search_path = '' as $$
  with me as (select public.my_member_id(p_workspace_id) as member_id)
  select
    m.id, m.name, m.role, m.email, m.avatar, m.note,
    m.is_admin, m.status, m.id = me.member_id,
    (select count(*) from public.companies c
      where c.owner_id = m.id and c.archived_at is null),
    (select count(*) from public.tasks t where t.assignee_id = m.id and not t.done),
    m.can_view_all
  from public.workspace_members m
  cross join me
  where m.workspace_id = p_workspace_id
    and me.member_id is not null
  order by m.is_admin desc, m.created_at;
$$;

-- ── ⑩ 実行権限 ────────────────────────────────────────────

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'my_company_ids', 'my_visible_company_ids', 'can_see_company', 'is_my_company',
      'can_view_all', 'my_readable_channel_ids', 'my_writable_channel_ids',
      'search_companies', 'customer_counts', 'company_facets', 'find_similar_companies',
      'company_groups', 'company_group', 'company_group_contacts', 'my_mail_contacts',
      'register_contact', 'complete_deal', 'log_activity',
      'company_timeline', 'list_deals', 'list_tasks', 'calendar_items',
      'list_channels', 'can_read_channel', 'mark_channel_read', 'list_members'
    )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;

  -- 見張り役は直接呼ばせない
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'set_company_registrant', 'guard_company_update', 'guard_member_update'
    )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
