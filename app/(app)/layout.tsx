import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { LockGate } from "@/components/LockGate";

const sum = (rows: unknown) =>
  ((rows ?? []) as { unread: number | string | null }[]).reduce((n, r) => n + Number(r.unread ?? 0), 0);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const ws = current.workspace.id;

  const [{ count: openAgenda }, channels, dms] = await Promise.all([
    // 計画タブのバッジ＝未決の議題数
    supabase
      .from("agenda_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .neq("state", "decided"),
    // チャンネルタブのバッジ＝未読の合計（会社・グループ・DM）
    supabase.rpc("list_channels", { p_workspace_id: ws }),
    supabase.rpc("list_dm_threads", { p_workspace_id: ws }),
  ]);

  return (
    <div className="min-h-dvh pb-28">
      <LockGate userId={current.member.user_id ?? current.member.id} email={current.email} name={current.member.name} />
      <div className="anim-screen">{children}</div>
      <BottomNav badges={{ roadmap: openAgenda ?? 0, channels: sum(channels.data) + sum(dms.data) }} />
    </div>
  );
}
