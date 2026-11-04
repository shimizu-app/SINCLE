import { Link2 } from "lucide-react";
import { C } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import type { ColorKey, ShapeKey } from "@/lib/design";
import type { GmailState } from "@/lib/gmail";

type NotConnected = Exclude<GmailState, { state: "connected" }>;

const POINTS: { shape: ShapeKey; color: ColorKey; title: string; desc: string }[] = [
  { shape: "flower", color: "purple", title: "登録した相手のメールだけ", desc: "名刺に載っているアドレスとのやりとりだけを入れます" },
  { shape: "stamp", color: "red", title: "広告や請求書は入らない", desc: "受信箱の全部は見せません。範囲は設定で変えられます" },
  { shape: "sun", color: "yellow", title: "返信をタスクにできる", desc: "未返信のメールを、そのまま「返信する」タスクにできます" },
];

/** 未連携のとき（SCREENS 9）。「Gmail をつなぐと」の説明と、接続ボタン */
export function GmailConnect({ state }: { state: NotConnected }) {
  const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

  if (state.state === "unconfigured") {
    return (
      <div className="bg-white p-4 text-xs font-bold leading-relaxed" style={{ ...card, color: "#9AA0A6" }}>
        Google 連携の設定がまだです。管理者が Vercel に{" "}
        <span style={{ color: C.ink }}>{state.missing.join("、")}</span> を入れると使えるようになります。
      </div>
    );
  }
  if (state.state === "needs_migration") {
    return (
      <div className="bg-white p-4 text-xs font-bold leading-relaxed" style={{ ...card, color: "#9AA0A6" }}>
        データベースの更新（{state.migration}）がまだです。更新が済むと Gmail をつなげるようになります。
      </div>
    );
  }

  const lead =
    state.state === "expired"
      ? `${state.email ? `${state.email} との` : ""}連携が切れています。もう一度つないでください。`
      : state.state === "no_permission"
        ? "Google カレンダーはつながっています。Gmail を読む許可を足すと、メールが入るようになります。"
        : null;

  return (
    <div className="bg-white p-4 space-y-3.5" style={card}>
      <div className="text-base font-extrabold">Gmail をつなぐと</div>
      <ul className="space-y-2.5">
        {POINTS.map((p) => (
          <li key={p.title} className="flex items-start gap-2.5">
            <ShapeIcon shape={p.shape} color={p.color} size={28} />
            <div className="min-w-0">
              <div className="text-sm font-extrabold">{p.title}</div>
              <div className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
                {p.desc}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {lead && (
        <p className="text-xs font-bold leading-relaxed" style={{ color: state.state === "expired" ? C.red : "#6B6B6B" }}>
          {lead}
        </p>
      )}

      <a href="/api/google/connect?with=gmail" className="block">
        <OrganicButton type="button" size="lg" color="blue" className="w-full">
          <Link2 size={16} strokeWidth={2.8} />
          {state.state === "no_permission" ? "Gmail の許可を足す" : "Gmail をつなぐ"}
        </OrganicButton>
      </a>

      <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
        読み取りだけで、Google 側のメールを送ったり消したりはしません。
        取り込んだメールは<span style={{ color: C.ink }}>チームのメンバー全員に見えます</span>
        （会社ごとの履歴に残すため）。同じ連携で Google カレンダーもつながります。
      </p>
    </div>
  );
}
