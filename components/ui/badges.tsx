import { C, SOFT, TIER_STYLE, PRIORITY_STYLE, DEAL_TYPE_COLOR } from "@/lib/design";
import type { Priority, Tier } from "@/types/db";
import { ShapeIcon } from "./ShapeIcon";

/** ティア（A=紫スタンプ / B=青波 / C=緑blob） */
export function TierChip({ tier, small }: { tier: Tier; small?: boolean }) {
  const t = TIER_STYLE[tier] ?? TIER_STYLE.C;
  const radius =
    t.shape === "stamp" ? "12px 5px 12px 5px" : t.shape === "wave" ? "14px 8px 14px 8px" : "999px";
  return (
    <span
      className={`inline-flex items-center font-bold shrink-0 ${
        small ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{ background: SOFT[t.color as keyof typeof SOFT], color: C[t.color], borderRadius: radius }}
    >
      {small ? tier : `Tier ${tier}`}
    </span>
  );
}

/** 案件種別 */
export function DealChip({ type }: { type: string }) {
  const c = DEAL_TYPE_COLOR[type] ?? "green";
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 shrink-0"
      style={{
        background: SOFT[c as keyof typeof SOFT],
        // 黄色は白抜きだと読めないので文字だけ濃くする
        color: c === "yellow" ? "#9A6B00" : C[c],
        borderRadius: "14px 7px 14px 7px",
      }}
    >
      {type}
    </span>
  );
}

/** 優先度（高=赤バースト / 中=オレンジ四角 / 低=青blob） */
export function PriorityBadge({ pri, size = 34 }: { pri: Priority; size?: number }) {
  const d = PRIORITY_STYLE[pri] ?? PRIORITY_STYLE["中"];
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <ShapeIcon shape={d.shape} color={d.color} size={size} />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {pri}
      </span>
    </span>
  );
}
