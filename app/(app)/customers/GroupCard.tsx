import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { CompanyAvatar, TierChip } from "@/components/ui";
import type { CompanyGroupRow } from "@/lib/customers";

/**
 * 全社のまとめの1行（023）。
 * 何人かが同じ会社を登録していても、ここでは1つにまとめて見せる。
 * 1件だけならその会社の画面へ、2件以上ならまとめの画面へ。
 */
export function GroupCard({ group, index }: { group: CompanyGroupRow; index: number }) {
  const href =
    group.record_count === 1 && group.company_ids[0]
      ? `/customers/${group.company_ids[0]}`
      : `/customers/group/${encodeURIComponent(group.key)}`;
  const who = group.registrants.length ? group.registrants.map((n) => `${n}さん`).join("・") : "退会した人";

  return (
    <Link
      href={href}
      className="block bg-white p-3.5 anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${group.record_count > 1 ? C.purple : C.line}`,
        animationDelay: `${Math.min(index, 12) * 40}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <CompanyAvatar name={group.name} industry={group.industry} dealType={null} size={48} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-extrabold truncate">{group.name}</span>
            {group.tier && <TierChip tier={group.tier} small />}
            {group.shared && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5"
                style={{ background: SOFT.green, color: C.green, borderRadius: "6px 10px 6px 10px" }}
              >
                <Users size={10} strokeWidth={3} />
                共有
              </span>
            )}
          </div>

          <div className="text-xs font-bold mt-0.5 break-words" style={{ color: "#6B6B6B" }}>
            {group.record_count > 1 ? (
              <>
                <span style={{ color: C.purple }}>{group.record_count}人が登録</span>
                {` ・ ${who}`}
              </>
            ) : (
              `登録：${who}`
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            <span>名刺 {group.contact_count}</span>
            {group.active_deals > 0 && <span style={{ color: C.purple }}>進行中 {group.active_deals}</span>}
            {group.open_task_count > 0 && <span style={{ color: C.orange }}>未完了 {group.open_task_count}</span>}
          </div>
        </div>

        <ChevronRight size={18} strokeWidth={3} style={{ color: "#C8C2B6" }} className="shrink-0 mt-1" />
      </div>
    </Link>
  );
}
