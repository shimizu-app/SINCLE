import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Mail, Phone, Users } from "lucide-react";
import { C, SOFT, DEAL_STATUS } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { MemberDot, TierChip } from "@/components/ui";
import type { Avatar, Tier } from "@/types/db";

/**
 * 全社のまとめ：同じ会社を何人かが登録しているときの中身（023）。
 * 「全員の名刺を見る」許可がある人だけ。見るだけで、ここからは書き換えない。
 */
export default async function CompanyGroupPage({ params }: { params: Promise<{ key: string }> }) {
  const current = await requireCurrent();
  if (!current.member.can_view_all) notFound();

  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const supabase = await createClient();
  const ws = current.workspace.id;

  const [{ data: records }, { data: contactRows }] = await Promise.all([
    supabase.rpc("company_group", { p_workspace_id: ws, p_key: key }),
    supabase.rpc("company_group_contacts", { p_workspace_id: ws, p_key: key }),
  ]);

  const list = records ?? [];
  if (!list.length) notFound();

  // 同じ人の名刺は1人にまとめる（メールが同じ、メールが無ければ名前と役職が同じ）
  const people = new Map<
    string,
    {
      name: string;
      title: string | null;
      dept: string | null;
      email: string | null;
      phone: string | null;
      companyId: string;
      by: Set<string>;
    }
  >();
  for (const c of contactRows ?? []) {
    const k = c.email ? `e:${c.email.toLowerCase()}` : `n:${c.name.replace(/\s+/g, "")}|${c.title ?? ""}`;
    const hit = people.get(k);
    const who = c.registrant_name ?? "退会した人";
    if (hit) {
      hit.by.add(who);
      hit.title ??= c.title;
      hit.dept ??= c.dept;
      hit.phone ??= c.phone;
    } else {
      people.set(k, {
        name: c.name,
        title: c.title,
        dept: c.dept,
        email: c.email,
        phone: c.phone,
        companyId: c.company_id,
        by: new Set([who]),
      });
    }
  }

  const name = list[0].name;
  const tier = list.map((r) => r.tier).filter(Boolean).sort()[0] as Tier | undefined;

  return (
    <>
      <ScreenHeader title={name} subtitle={`${list.length}人が登録 ・ 全社のまとめ`} />

      <div className="px-4 py-4 space-y-5">
        <Link
          href="/customers?view=all"
          className="inline-flex items-center gap-1 text-sm font-bold"
          style={{ color: C.purple }}
        >
          <ChevronLeft size={16} strokeWidth={3} />
          全社の一覧
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {tier && <TierChip tier={tier} small />}
          <span className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            名刺 {people.size}人 ・ 見るだけです（書き換えは、登録した人の画面で）
          </span>
        </div>

        {/* ── 誰がどう登録しているか ── */}
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold px-1">登録した人ごと</h2>
          {list.map((r, i) => {
            const status = r.deal_status ? DEAL_STATUS[r.deal_status as keyof typeof DEAL_STATUS] : null;
            return (
              <Link
                key={r.id}
                href={`/customers/${r.id}`}
                className="flex items-center gap-3 bg-white p-3 anim-item"
                style={{
                  borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
                  border: `2px solid ${C.line}`,
                  animationDelay: `${Math.min(i, 12) * 40}ms`,
                }}
              >
                <MemberDot
                  name={r.registrant_name ?? "?"}
                  avatar={(r.registrant_avatar as unknown as Avatar | null) ?? null}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-extrabold">
                      {r.registrant_name ? `${r.registrant_name}さん` : "退会した人"}
                    </span>
                    {r.shared && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5"
                        style={{ background: SOFT.green, color: C.green, borderRadius: "6px 10px 6px 10px" }}
                      >
                        <Users size={10} strokeWidth={3} />
                        共有
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold mt-0.5 break-words" style={{ color: "#6B6B6B" }}>
                    {r.name}
                    {r.owner_name && r.owner_name !== r.registrant_name ? ` ・ 担当 ${r.owner_name}さん` : ""}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 text-[11px] font-bold flex-wrap" style={{ color: "#9AA0A6" }}>
                    <span>名刺 {r.contact_count}</span>
                    {r.stage_name && <span>{r.stage_name}</span>}
                    {status && (
                      <span style={{ color: status.color === "yellow" ? "#9A6B00" : C[status.color] }}>
                        {status.label}
                      </span>
                    )}
                    {r.open_task_count > 0 && <span style={{ color: C.orange }}>未完了 {r.open_task_count}</span>}
                  </div>
                </div>
                <ChevronRight size={18} strokeWidth={3} style={{ color: "#C8C2B6" }} className="shrink-0" />
              </Link>
            );
          })}
        </section>

        {/* ── 名刺（同じ人は1人に） ── */}
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold px-1">名刺（同じ人は1人にまとめています）</h2>
          {people.size === 0 ? (
            <EmptyState shape="cloud" color="blue" title="名刺はまだありません" desc="会社だけが登録されています。" />
          ) : (
            [...people.values()].map((p, i) => (
              <Link
                key={`${p.companyId}-${p.name}-${i}`}
                href={`/customers/${p.companyId}?tab=contacts`}
                className="block bg-white p-3"
                style={{ borderRadius: "18px 9px 18px 9px", border: `2px solid ${C.line}` }}
              >
                <div className="text-sm font-extrabold">{p.name}</div>
                {(p.title || p.dept) && (
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: "#6B6B6B" }}>
                    {[p.dept, p.title].filter(Boolean).join(" ・ ")}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold flex-wrap" style={{ color: "#9AA0A6" }}>
                  {p.email && (
                    <span className="inline-flex items-center gap-1 break-all">
                      <Mail size={11} strokeWidth={2.6} />
                      {p.email}
                    </span>
                  )}
                  {p.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} strokeWidth={2.6} />
                      {p.phone}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-bold mt-1.5" style={{ color: C.purple }}>
                  登録：{[...p.by].map((n) => (n === "退会した人" ? n : `${n}さん`)).join("・")}
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </>
  );
}
