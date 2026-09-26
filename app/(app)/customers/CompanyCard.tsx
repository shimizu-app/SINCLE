import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { C, SOFT, DEAL_STATUS } from "@/lib/design";
import { CompanyAvatar, TierChip, DealChip } from "@/components/ui";
import type { CompanyRow } from "@/lib/customers";
import type { Tier } from "@/types/db";

export function CompanyCard({ company, index }: { company: CompanyRow; index: number }) {
  const status = company.deal_status
    ? DEAL_STATUS[company.deal_status as keyof typeof DEAL_STATUS]
    : null;
  const progress =
    company.stage_position !== null && company.stage_total > 0
      ? Math.round(((company.stage_position + 1) / company.stage_total) * 100)
      : null;

  return (
    <Link
      href={`/customers/${company.id}`}
      className="block bg-white p-3.5 anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${C.line}`,
        animationDelay: `${Math.min(index, 12) * 40}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <CompanyAvatar
          name={company.name}
          industry={company.industry}
          dealType={company.deal_type}
          size={48}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-extrabold truncate">{company.name}</span>
            {company.tier && <TierChip tier={company.tier as Tier} small />}
          </div>

          <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "#9AA0A6" }}>
            {company.primary_contact_name
              ? `窓口 ${company.primary_contact_name}${
                  company.primary_contact_title ? ` / ${company.primary_contact_title}` : ""
                }`
              : "窓口はまだ決まっていません"}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {company.deal_type && <DealChip type={company.deal_type} />}
            {status && (
              <span
                className="inline-flex items-center text-[11px] font-bold px-2.5 py-1"
                style={{
                  background: SOFT[status.color as keyof typeof SOFT],
                  color: status.color === "yellow" ? "#9A6B00" : C[status.color],
                  borderRadius: "7px 14px 7px 14px",
                }}
              >
                {status.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            <span>名刺 {company.contact_count}</span>
            {company.open_task_count > 0 && (
              <span style={{ color: C.orange }}>未完了 {company.open_task_count}</span>
            )}
            {company.stage_name && <span>{company.stage_name}</span>}
          </div>

          {progress !== null && (
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: C.purple, transition: "width .6s" }}
              />
            </div>
          )}
        </div>

        <ChevronRight size={18} strokeWidth={3} style={{ color: "#C8C2B6" }} className="shrink-0 mt-1" />
      </div>
    </Link>
  );
}
