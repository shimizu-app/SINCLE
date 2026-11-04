-- ═══════════════════════════════════════════════════════════
-- 021 Gmail の取り込み（SPEC 6章 / SCREENS 9・11）
--
-- 取り込むのは、登録した相手（名刺）とのやりとりだけ。受信箱全体は見せない。
-- 取り込んだメールはワークスペースの全員に見える（会社詳細のメール・履歴に出す）。
--
-- ① 同じメールを1件にまとめる
--    Gmail のメッセージID は受信箱ごとに違う。
--    お客さまが2人に宛てて送ったメールは、2人がそれぞれ取り込むと2件になってしまう。
--    メール本体の Message-ID（RFC 5322）は全員で同じなので、こちらで重複を見る。
--
-- ② 取り込みの範囲と、前回の結果
--    integrations は誰にも select を許していない（009）ので、
--    020 と同じく本人の行だけを security definer の関数で書き換える。
-- ═══════════════════════════════════════════════════════════

-- ── ① mails ───────────────────────────────────────────────

alter table public.mails
  add column if not exists rfc_message_id text,
  -- 誰の Gmail から入ったか。返信の追いかけ（同じスレッドの取り直し）に使う
  add column if not exists imported_by uuid references public.workspace_members(id) on delete set null,
  -- 「タスクにする」で作ったタスク。2回押しても2つできないように
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

-- on conflict (workspace_id, rfc_message_id) の受け皿。
-- 部分インデックスにすると on conflict で使えないので、条件は付けない
-- （null どうしは重ならない扱いなので、手で入れたメールは何件でも入る）。
create unique index if not exists mails_workspace_rfc_key
  on public.mails (workspace_id, rfc_message_id);

-- メール画面は会社をまたいで新しい順に並べる
create index if not exists mails_workspace_sent_idx
  on public.mails (workspace_id, sent_at desc);

-- 自分が取り込んだスレッドを引く（返信の追いかけ）
create index if not exists mails_imported_by_idx
  on public.mails (imported_by, sent_at desc);

-- 外部キーの消し込み（on delete set null）を速くする
create index if not exists mails_task_id_idx
  on public.mails (task_id);

-- ── ② integrations ───────────────────────────────────────

-- 前回の取り込みの結果（件数など）。画面の「前回：◯件」に使う
alter table public.integrations add column if not exists gmail_stats jsonb;

/** 取り込みの範囲を変える（SCREENS 11「取り込み範囲（3段階）」） */
create or replace function public.set_gmail_scope(p_workspace_id uuid, p_scope text)
returns void language plpgsql security definer
set search_path = '' as $$
begin
  if p_scope is null or p_scope not in ('registered', 'domain', 'all') then
    raise exception '取り込みの範囲が正しくありません' using errcode = '22023';
  end if;

  update public.integrations
     set gmail_scope = p_scope
   where workspace_id = p_workspace_id
     and provider = 'google'
     and member_id = public.my_member_id(p_workspace_id);
end;
$$;

/** 取り込みが済んだことと、その結果を残す */
create or replace function public.mark_gmail_synced(p_workspace_id uuid, p_stats jsonb)
returns void language sql security definer
set search_path = '' as $$
  update public.integrations
     set last_sync_at = now(),
         gmail_stats  = p_stats
   where workspace_id = p_workspace_id
     and provider = 'google'
     and member_id = public.my_member_id(p_workspace_id);
$$;

-- 画面向けの連携状況に、前回の結果を足す。返り値の形が変わるので作り直す。
drop function if exists public.integration_status();
create function public.integration_status()
returns table (
  workspace_id uuid,
  provider text,
  scopes text[],
  gmail_scope text,
  calendar_ids jsonb,
  expires_at timestamptz,
  last_sync_at timestamptz,
  account_email text,
  gmail_stats jsonb
) language sql security definer stable
set search_path = '' as $$
  select i.workspace_id, i.provider, i.scopes, i.gmail_scope,
         i.calendar_ids, i.expires_at, i.last_sync_at, i.account_email, i.gmail_stats
  from public.integrations i
  join public.workspace_members m on m.id = i.member_id
  where m.user_id = (select auth.uid());
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'set_gmail_scope', 'mark_gmail_synced', 'integration_status'
    )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
