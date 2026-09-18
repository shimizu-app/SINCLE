import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await requireCurrent();
  const supabase = await createClient();

  // 計画タブのバッジ＝未決の議題数
  const { count: openAgenda } = await supabase
    .from("agenda_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", current.workspace.id)
    .neq("state", "decided");

  // チャンネルの未読数は last_read_at との突き合わせが要るのでフェーズ3で入れる
  return (
    <div className="min-h-dvh pb-28">
      <div className="anim-screen">{children}</div>
      <BottomNav badges={{ roadmap: openAgenda ?? 0 }} />
    </div>
  );
}
