import Link from "next/link";
import { Mail, Plus, Settings } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { OrganicButton } from "@/components/ui";

export default async function CustomersPage() {
  const current = await requireCurrent();
  const supabase = await createClient();
  const ws = current.workspace.id;

  const [companies, tierA, openTasks, unreplied] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws).is("archived_at", null),
    supabase.from("companies").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws).is("archived_at", null).eq("tier", "A"),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws).eq("done", false),
    supabase.from("mails").select("id", { count: "exact", head: true })
      .eq("workspace_id", ws).eq("direction", "in").eq("replied", false),
  ]);

  const stats = [
    { label: "社", value: companies.count ?? 0, color: "purple" as const },
    { label: "Tier A", value: tierA.count ?? 0, color: "pink" as const },
    { label: "未完了", value: openTasks.count ?? 0, color: "yellow" as const },
  ];

  return (
    <>
      <ScreenHeader
        title="顧客"
        subtitle={current.workspace.name}
        actions={
          <>
            {/* メールはナビに置かず、ここに未返信バッジ付きで置く（SCREENS） */}
            <Link
              href="/mail"
              aria-label="メール"
              className="relative w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "14px 7px 14px 7px", background: SOFT.blue }}
            >
              <Mail size={18} strokeWidth={2.5} style={{ color: C.blue }} />
              {(unreplied.count ?? 0) > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                  style={{ background: C.red }}
                >
                  {unreplied.count}
                </span>
              )}
            </Link>
            <Link
              href="/scan"
              aria-label="追加"
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "7px 14px 7px 14px", background: SOFT.green }}
            >
              <Plus size={18} strokeWidth={3} style={{ color: C.green }} />
            </Link>
            <Link
              href="/settings"
              aria-label="設定"
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "14px 7px 14px 7px", background: SOFT.purple }}
            >
              <Settings size={18} strokeWidth={2.5} style={{ color: C.purple }} />
            </Link>
          </>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="bg-white px-3 py-2.5 anim-item"
              style={{
                borderRadius: i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
                border: `2px solid ${C.line}`,
                animationDelay: `${i * 45}ms`,
              }}
            >
              <div className="text-2xl font-extrabold leading-none" style={{ color: C[s.color] }}>
                {s.value}
              </div>
              <div className="text-[11px] font-bold mt-1" style={{ color: "#9AA0A6" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <EmptyState
          shape="hex"
          color="purple"
          title="まだ顧客がいません"
          desc={"名刺を登録すると、会社・チャンネル・最初のタスクまで\n自動で用意されます。"}
        >
          <Link href="/scan" className="inline-block pt-1">
            <OrganicButton type="button" size="md" color="green">
              名刺を登録する
            </OrganicButton>
          </Link>
        </EmptyState>
      </div>
    </>
  );
}
