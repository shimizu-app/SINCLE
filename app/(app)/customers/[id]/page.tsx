import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  C, SOFT, companyArt, DEAL_STATUS, titleScore,
  type ColorKey, type ShapeKey,
} from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { ShapeIcon, TierChip, DealChip } from "@/components/ui";
import { CompanyOverview } from "./CompanyOverview";
import { ContactList } from "./ContactList";
import { Timeline, type TimelineItem } from "./Timeline";
import { Documents, type DocRow } from "./Documents";
import type { Tier } from "@/types/db";

const TABS = [
  { key: "overview", label: "概要", phase: null },
  { key: "contacts", label: "名刺", phase: null },
  { key: "timeline", label: "履歴", phase: null },
  { key: "documents", label: "書類", phase: null },
  { key: "tasks", label: "タスク", phase: "フェーズ3" },
  { key: "mail", label: "メール", phase: "フェーズ6" },
  { key: "channel", label: "チャンネル", phase: "フェーズ3" },
] as const;

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; f?: string; n?: string }>;
}) {
  const current = await requireCurrent();
  const { id } = await params;
  const { tab: rawTab, f, n } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];

  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!company) notFound();

  const [{ data: contacts }, { data: stages }, { data: deal }, { count: openTasks }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("stages")
        .select("id, name, position")
        .eq("workspace_id", current.workspace.id)
        .order("position", { ascending: true }),
      supabase.from("deals").select("*").eq("company_id", id).eq("active", true).maybeSingle(),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", id)
        .eq("done", false),
    ]);

  // SPEC 3章：会社のティアは、所属する名刺のうち最高スコアで決まる
  const best = (contacts ?? []).reduce(
    (top, c) => {
      const score = titleScore(c.title ?? undefined);
      return score > top.score ? { score, title: c.title ?? null } : top;
    },
    { score: 0, title: null as string | null }
  );

  const timelineLimit = Math.min(Number(n) || 30, 300);
  const [{ data: timeline }, { data: docs }] =
    tab.key === "timeline" || tab.key === "documents"
      ? await Promise.all([
          tab.key === "timeline"
            ? supabase.rpc("company_timeline", {
                p_company_id: id,
                p_filter: f ?? "all",
                p_limit: timelineLimit + 1,
              })
            : Promise.resolve({ data: [] }),
          tab.key === "documents"
            ? supabase
                .from("documents")
                .select("id, name, kind, note, pinned, size_bytes, created_at")
                .eq("company_id", id)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }];

  const timelineItems = (timeline ?? []) as unknown as TimelineItem[];
  const hasMore = timelineItems.length > timelineLimit;

  const art = companyArt(company.industry ?? undefined, company.deal_type ?? undefined);
  const tier = (company.tier_manual ?? company.tier) as Tier | null;
  const status = deal?.status ? DEAL_STATUS[deal.status as keyof typeof DEAL_STATUS] : null;

  return (
    <>
      {/* ── アートヘッダー（会社の色） ── */}
      <header
        className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 relative overflow-hidden"
        style={{
          background: SOFT[art.color as keyof typeof SOFT],
          borderRadius: "0 0 14px 28px",
          borderBottom: `2px solid ${C.line}`,
        }}
      >
        <span
          className="absolute -right-6 -top-6 opacity-40 pointer-events-none"
          aria-hidden="true"
        >
          <ShapeIcon shape={art.shape as ShapeKey} color={art.color as ColorKey} size={130} />
        </span>

        <Link
          href="/customers"
          className="relative inline-flex items-center gap-1 text-sm font-bold mb-3"
          style={{ color: C[art.color as ColorKey] }}
        >
          <ChevronLeft size={16} strokeWidth={3} />
          顧客
        </Link>

        <div className="relative flex items-start gap-3">
          <ShapeIcon shape={art.shape as ShapeKey} color={art.color as ColorKey} size={52} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight break-words">{company.name}</h1>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {tier && <TierChip tier={tier} small />}
              {company.deal_type && <DealChip type={company.deal_type} />}
              {status && (
                <span
                  className="inline-flex items-center text-[11px] font-bold px-2.5 py-1"
                  style={{
                    background: "#fff",
                    color: status.color === "yellow" ? "#9A6B00" : C[status.color],
                    borderRadius: "7px 14px 7px 14px",
                  }}
                >
                  {status.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── タブ ── */}
      <nav className="px-4 pt-3 pb-1 flex gap-1.5 overflow-x-auto no-bar">
        {TABS.map((t) => {
          const on = tab.key === t.key;
          return (
            <Link
              key={t.key}
              href={`/customers/${id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
              className={`text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
              style={{
                background: on ? C.ink : "#fff",
                color: on ? "#fff" : t.phase ? "#C8C2B6" : "#6B6B6B",
                border: `2px solid ${on ? C.ink : C.line}`,
                borderRadius: "14px 7px 14px 7px",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 space-y-4">
        {tab.key === "overview" && (
          <CompanyOverview
            company={company}
            stages={stages ?? []}
            contactCount={contacts?.length ?? 0}
            titleScore={best.score}
            titleSource={best.title}
            openTasks={openTasks ?? 0}
            dealMemo={deal?.memo ?? null}
          />
        )}

        {tab.key === "contacts" && (
          <ContactList
            companyId={id}
            contacts={contacts ?? []}
            primaryContactId={company.primary_contact_id}
          />
        )}

        {tab.key === "timeline" && (
          <Timeline
            companyId={id}
            items={timelineItems.slice(0, timelineLimit)}
            filter={f ?? "all"}
            hasMore={hasMore}
            myName={current.member.name}
            myAvatar={current.member.avatar}
          />
        )}

        {tab.key === "documents" && (
          <Documents companyId={id} docs={(docs ?? []) as unknown as DocRow[]} />
        )}

        {tab.phase && (
          <EmptyState
            shape="cloud"
            color="blue"
            title={`${tab.label}はまだです`}
            desc={`${tab.phase}で入ります。`}
          />
        )}
      </div>
    </>
  );
}
