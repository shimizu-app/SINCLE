-- ═══════════════════════════════════════════════════════════
-- 024 既読（チャンネル・DM）
--
-- ① チャンネル：だれがどこまで読んだか（channel_members.last_read_at）を、
--    画面がその場で受け取れるようにする（Realtime の配信に足す）。
--    自分の発言の下に「既読 N」を出す。
--    DM は dm_messages.read_at が既にあり、配信にも入っている（017）。
--
-- ② 既読をつけられるのは、書けるチャンネル（参加しているグループ・自分の会社のチャンネル）だけ。
--    「全員の名刺を見る」許可で人の会社のチャンネルを見ただけでは、既読もつかず、
--    参加者にも入らない（023 の can_read_channel のままだと、見ただけで参加者に入っていた）。
-- ═══════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channel_members'
  ) then
    alter publication supabase_realtime add table public.channel_members;
  end if;
end $$;

create or replace function public.mark_channel_read(p_channel_id uuid)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  v_ws uuid;
  v_me uuid;
begin
  select workspace_id into v_ws from public.channels where id = p_channel_id;
  if v_ws is null or p_channel_id not in (select public.my_writable_channel_ids()) then
    return;
  end if;
  v_me := public.my_member_id(v_ws);
  if v_me is null then return; end if;

  insert into public.channel_members (channel_id, member_id, last_read_at)
  values (p_channel_id, v_me, now())
  on conflict (channel_id, member_id) do update set last_read_at = now();
end;
$$;

revoke execute on function public.mark_channel_read(uuid) from public, anon;
grant execute on function public.mark_channel_read(uuid) to authenticated;
