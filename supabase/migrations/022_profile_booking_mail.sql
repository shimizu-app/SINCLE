-- ═══════════════════════════════════════════════════════════
-- 022 プロフィール・日程調整と予約ページ・AIメールの送信
--
-- ① メンバーの行：本人が書き換えてよい列を絞る（権限の穴を塞ぐ）
--    014 の「自分の行は更新できる」は、どの列でも書き換えられた。
--    そのため、ふつうのメンバーが自分を管理者にしたり（is_admin）、
--    workspace_id を書き換えて別の会社のワークスペースに入り込んだりできた。
--    更新の前に見張り役（trigger）を置いて、守る列を変えさせない。
--
-- ② プロフィールと個人の設定（SCREENS 11・12）
-- ③ 日程調整と予約ページ（SCREENS 10）
-- ④ AIメールの送信（SCREENS 9）
-- ═══════════════════════════════════════════════════════════

-- ── ① メンバーの行の見張り ────────────────────────────────

create or replace function public.guard_member_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  -- security definer の関数（参加の確定 claim_membership など）は関数の持ち主として動く。
  -- そこからの更新は、関数の中で確かめてあるので通す。
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- ワークスペースの移動・ログインの付け替えは、だれにもさせない
  if new.workspace_id is distinct from old.workspace_id
     or new.user_id is distinct from old.user_id then
    raise exception 'この項目は変更できません' using errcode = '42501';
  end if;

  -- メールの書き換えは、まだログインしていない人（招待中）を管理者が直すときだけ
  if lower(new.email) is distinct from lower(old.email)
     and not (old.user_id is null and public.is_ws_admin(old.workspace_id)) then
    raise exception 'メールアドレスは変更できません' using errcode = '42501';
  end if;

  -- 管理者にする・外す、参加の状態を変えるのは、管理者だけ
  if (new.is_admin is distinct from old.is_admin or new.status is distinct from old.status)
     and not public.is_ws_admin(old.workspace_id) then
    raise exception '管理者だけが変更できます' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_guard on public.workspace_members;
create trigger workspace_members_guard
  before update on public.workspace_members
  for each row execute function public.guard_member_update();

-- ── ② プロフィールと個人の設定 ────────────────────────────

alter table public.workspace_members
  -- AIメールの署名（SCREENS 11「差出人」）
  add column if not exists signature text,
  -- タスクの見せ方（SCREENS 11）：company＝会社ごと / assignee＝担当者ごと
  add column if not exists task_view text not null default 'company',
  -- Zoom など、決まった会議URL（日程調整で「Zoom」を選んだときに差し込む。SPEC 6章）
  add column if not exists meeting_url text;

do $$
begin
  alter table public.workspace_members drop constraint if exists workspace_members_task_view_check;
  alter table public.workspace_members add constraint workspace_members_task_view_check
    check (task_view in ('company', 'assignee'));

  -- 写真は小さく縮めて行の中に入れる（data URL）。大きすぎるものは入れさせない
  alter table public.workspace_members drop constraint if exists workspace_members_avatar_size;
  alter table public.workspace_members add constraint workspace_members_avatar_size
    check (octet_length(avatar::text) <= 200000);
  alter table public.workspace_members drop constraint if exists workspace_members_cover_size;
  alter table public.workspace_members add constraint workspace_members_cover_size
    check (cover is null or octet_length(cover::text) <= 400000);

  alter table public.workspace_members drop constraint if exists workspace_members_text_len;
  alter table public.workspace_members add constraint workspace_members_text_len
    check (char_length(name) <= 60 and char_length(role) <= 40
           and char_length(coalesce(note, '')) <= 200
           and char_length(coalesce(signature, '')) <= 1000
           and char_length(coalesce(meeting_url, '')) <= 500);
end $$;
