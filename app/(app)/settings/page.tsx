import { headers } from "next/headers";
import { C, type ColorKey, type ShapeKey } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHead, ShapeIcon } from "@/components/ui";
import { MemberAdmin, type JoinRequest, type MemberInfo } from "./MemberAdmin";
import { StageAdmin, type StageRow } from "./StageAdmin";
import { signOut } from "@/app/auth/actions";

/** まだ入っていない設定。入ったものはここから外す。 */
const LATER: { shape: ShapeKey; color: ColorKey; title: string; desc: string; phase: string }[] = [
  { shape: "arch", color: "green", title: "Google カレンダー", desc: "連携と、チーム共有の仕組み", phase: "フェーズ6" },
  { shape: "square", color: "blue", title: "Gmail", desc: "取り込み範囲と、取り込む相手の一覧", phase: "フェーズ6" },
  { shape: "stamp", color: "red", title: "セキュリティ", desc: "Face ID でのロック", phase: "フェーズ4" },
];

export default async function SettingsPage() {
  const current = await requireCurrent();
  const supabase = await createClient();

  const [{ data: members }, { data: requests }] = await Promise.all([
    supabase.rpc("list_members", { p_workspace_id: current.workspace.id }),
    supabase
      .from("join_requests")
      .select("id, email, name, via")
      .eq("workspace_id", current.workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  const { data: stages } = await supabase
    .from("stages")
    .select("id, name, position")
    .eq("workspace_id", current.workspace.id)
    .order("position", { ascending: true });

  // 招待リンクの見本に使う。ヘッダーから今のURLを組み立てる。
  const host = (await headers()).get("host") ?? "localhost:3000";
  const siteUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const card = {
    borderRadius: "26px 13px 26px 13px",
    border: `2.5px solid ${C.line}`,
  } as const;

  return (
    <>
      <ScreenHeader title="設定" subtitle="アプリ全体の設定です" />

      <div className="px-4 py-4 space-y-6">
        <section>
          <SectionHead shape="flower" color="purple" title="ワークスペース" desc="いま開いている場所と、参加しているメンバー" />
          <div className="bg-white p-4 space-y-4" style={card}>
            <div className="flex items-center gap-3">
              <ShapeIcon
                shape={current.workspace.shape as ShapeKey}
                color={current.workspace.color as ColorKey}
                size={48}
              />
              <div className="min-w-0">
                <div className="text-base font-extrabold truncate">{current.workspace.name}</div>
                <div className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
                  /{current.workspace.slug}
                  {current.workspace.domain && ` ・ @${current.workspace.domain}`}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── メンバーの管理（SPEC 4章の3経路） ── */}
        <MemberAdmin
          members={(members ?? []) as unknown as MemberInfo[]}
          requests={(requests ?? []) as unknown as JoinRequest[]}
          isAdmin={current.member.is_admin}
          domain={current.workspace.domain}
          openJoin={current.workspace.open_join}
          siteUrl={siteUrl}
        />

        <section>
          <SectionHead shape="wave" color="blue" title="商談の進み具合" desc="いまの流れ。段階の名前と並びを変えられます" />
          <StageAdmin stages={(stages ?? []) as StageRow[]} isAdmin={current.member.is_admin} />
        </section>

        <section>
          <SectionHead shape="blob" color="orange" title="これから入るもの" desc="フェーズごとに順番に足していきます" />
          <div className="space-y-2">
            {LATER.map((item, i) => (
              <div
                key={item.title}
                className="flex items-center gap-3 bg-white p-3.5 opacity-60"
                style={{
                  borderRadius: i % 2 ? "22px 11px 22px 11px" : "11px 22px 11px 22px",
                  border: `2px solid ${C.line}`,
                }}
              >
                <ShapeIcon shape={item.shape} color={item.color} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold truncate">{item.title}</div>
                  <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
                    {item.desc}
                  </div>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: "#C8C2B6" }}>
                  {item.phase}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead shape="drop" color="red" title="アカウント" desc={current.email} />
          <form action={signOut}>
            <button
              type="submit"
              className="w-full bg-white py-3.5 text-sm font-extrabold"
              style={{ ...card, color: C.red }}
            >
              サインアウト
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
