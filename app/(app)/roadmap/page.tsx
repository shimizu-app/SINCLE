import Link from "next/link";
import { ChevronLeft, ChevronRight, Map as MapIcon, MessageSquare } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ShapeIcon } from "@/components/ui";
import type { Avatar } from "@/types/db";
import {
  DEPTS, DEPT_KEYS, deptOf, isDeptFilter, monthWindow, parseYm, sameYm, ymKey,
  type DeptFilter, type YearMonth,
} from "./depts";
import { AgendaBoard, type AgendaAction, type AgendaRow, type Person } from "./AgendaBoard";
import { RoadmapMap } from "./RoadmapMap";

type Params = { dept?: string; ym?: string; view?: string };

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<Params> }) {
  const current = await requireCurrent();
  const params = await searchParams;
  const supabase = await createClient();

  const today = new Date();
  const months = monthWindow(today);
  const thisMonth: YearMonth = { year: today.getFullYear(), month: today.getMonth() + 1 };

  const dept: DeptFilter = isDeptFilter(params.dept) ? params.dept : "all";
  const picked = parseYm(params.ym);
  const ym = picked && months.some((m) => sameYm(m, picked)) ? picked : thisMonth;
  const view = params.view === "map" ? "map" : "agenda";

  // 6か月ぶんを一度に取る。数は多くないので、絞り込みは手元でやる。
  const years = Array.from(new Set(months.map((m) => m.year)));
  const [{ data: rows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("id, dept, year, month, title, state, decision, decided_at, scheduled_text, participants, created_at")
      .eq("workspace_id", current.workspace.id)
      .in("year", years)
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_members")
      .select("id, name, avatar")
      .eq("workspace_id", current.workspace.id)
      .eq("status", "active")
      .order("created_at"),
  ]);

  const inWindow = ((rows ?? []) as unknown as AgendaRow[]).filter((r) =>
    months.some((m) => m.year === r.year && m.month === r.month)
  );
  const inDept = dept === "all" ? inWindow : inWindow.filter((r) => r.dept === dept);
  const listed = inDept.filter((r) => r.year === ym.year && r.month === ym.month);

  const ids = listed.map((r) => r.id);
  const { data: actionRows } = ids.length
    ? await supabase
        .from("agenda_actions")
        .select("id, agenda_item_id, text, assignee_id, done, position")
        .in("agenda_item_id", ids)
        .order("position")
    : { data: [] };

  const people: Person[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar as unknown as Avatar | null,
  }));

  const talking = listed.filter((r) => r.state !== "decided").length;
  const decided = listed.filter((r) => r.state === "decided").length;

  const d = deptOf(dept);
  const href = (patch: Partial<Params>) => {
    const next = { dept, ym: ymKey(ym), view, ...patch };
    const q = new URLSearchParams();
    if (next.dept && next.dept !== "all") q.set("dept", next.dept);
    if (next.ym && next.ym !== ymKey(thisMonth)) q.set("ym", next.ym);
    if (next.view && next.view !== "agenda") q.set("view", next.view);
    const s = q.toString();
    return s ? `/roadmap?${s}` : "/roadmap";
  };

  const at = months.findIndex((m) => sameYm(m, ym));
  const prev = months[at - 1];
  const next = months[at + 1];

  return (
    <>
      <ScreenHeader
        title="計画"
        subtitle={`${ym.month}月　話すこと ${talking}件　決定 ${decided}件`}
      />

      <div className="py-3 space-y-3">
        {/* ── 部署 ── */}
        <div className="flex gap-2 overflow-x-auto no-bar px-4">
          {DEPTS.map((x) => {
            const on = dept === x.id;
            return (
              <Link
                key={x.id}
                href={href({ dept: x.id })}
                className="shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5"
                style={{
                  minWidth: 76,
                  background: on ? SOFT[x.color as keyof typeof SOFT] : "#fff",
                  border: `2.5px solid ${on ? C[x.color] : C.line}`,
                  borderRadius: on ? "22px 11px 22px 11px" : 16,
                }}
              >
                <ShapeIcon shape={x.shape} color={x.color} size={30} />
                <span
                  className="text-[11px] font-bold leading-tight text-center"
                  style={{ color: on ? C[x.color] : "#8A8A8A" }}
                >
                  {x.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── 月（6か月）── */}
        <div className="px-4">
          <div
            className="flex items-center gap-1.5 p-1.5 bg-white"
            style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }}
          >
            <Link
              href={prev ? href({ ym: ymKey(prev) }) : href({})}
              aria-label="前の月"
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ opacity: prev ? 1 : 0.3 }}
            >
              <ChevronLeft size={18} strokeWidth={2.8} style={{ color: "#8A8A8A" }} />
            </Link>
            <div className="flex-1 flex gap-1 overflow-x-auto no-bar">
              {months.map((m, i) => {
                const on = sameYm(m, ym);
                const past = m.year * 12 + m.month < thisMonth.year * 12 + thisMonth.month;
                return (
                  <Link
                    key={ymKey(m)}
                    href={href({ ym: ymKey(m) })}
                    className="flex-1 text-center text-xs font-extrabold py-2 shrink-0"
                    style={{
                      minWidth: 44,
                      background: on ? C[d.color] : "transparent",
                      color: on ? "#fff" : past ? "#B0AA9E" : "#6B6B6B",
                      borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px",
                    }}
                  >
                    {m.month}月
                  </Link>
                );
              })}
            </div>
            <Link
              href={next ? href({ ym: ymKey(next) }) : href({})}
              aria-label="次の月"
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ opacity: next ? 1 : 0.3 }}
            >
              <ChevronRight size={18} strokeWidth={2.8} style={{ color: "#8A8A8A" }} />
            </Link>
          </div>
        </div>

        {/* ── 議題 / ロードマップ図 ── */}
        <div className="px-4 flex gap-1.5">
          {(
            [
              ["agenda", "議題", MessageSquare],
              ["map", "ロードマップ図", MapIcon],
            ] as const
          ).map(([v, label, Icon], i) => {
            const on = view === v;
            return (
              <Link
                key={v}
                href={href({ view: v })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold ${on ? "anim-chip" : ""}`}
                style={{
                  background: on ? C.ink : "#fff",
                  color: on ? "#fff" : "#8A8A8A",
                  border: `2.5px solid ${on ? C.ink : C.line}`,
                  borderRadius: i ? "12px 24px 12px 24px" : "24px 12px 24px 12px",
                }}
              >
                <Icon size={16} strokeWidth={2.6} />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="px-4 pb-8">
          {view === "map" ? (
            <RoadmapMap
              months={months}
              selected={ym}
              thisMonth={thisMonth}
              depts={dept === "all" ? DEPT_KEYS : [dept]}
              color={d.color}
              items={inDept}
              hrefFor={(m, deptKey) =>
                href({ ym: ymKey(m), ...(deptKey ? { dept: deptKey } : {}) })
              }
              agendaHref={href({ view: "agenda" })}
            />
          ) : (
            <AgendaBoard
              key={`${dept}-${ymKey(ym)}`}
              items={listed}
              actions={(actionRows ?? []) as unknown as AgendaAction[]}
              people={people}
              myMemberId={current.member.id}
              dept={dept}
              ym={ym}
            />
          )}
        </div>
      </div>
    </>
  );
}
