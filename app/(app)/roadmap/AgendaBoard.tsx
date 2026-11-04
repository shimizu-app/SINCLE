"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AGENDA_STATE, C, SOFT } from "@/lib/design";
import { OrganicButton, ShapeIcon, Sheet } from "@/components/ui";
import type { Avatar } from "@/types/db";
import { addAgenda, type AgendaResult } from "./actions";
import { AgendaCard } from "./AgendaCard";
import { DEPT_KEYS, deptOf, type DeptFilter, type YearMonth } from "./depts";

export type AgendaRow = {
  id: string;
  dept: string;
  year: number;
  month: number;
  title: string;
  state: "todo" | "talking" | "decided";
  decision: string | null;
  decided_at: string | null;
  scheduled_text: string | null;
  participants: string[];
  created_at: string;
};

export type AgendaAction = {
  id: string;
  agenda_item_id: string;
  text: string;
  assignee_id: string | null;
  done: boolean;
  position: number;
};

export type Person = { id: string; name: string; avatar: Avatar | null };

const GROUPS: AgendaRow["state"][] = ["talking", "todo", "decided"];

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

/** 議題の一覧（SCREENS 8）。話し合い中 → これから話す → 決定済み の順に並べる */
export function AgendaBoard({
  items,
  actions,
  people,
  myMemberId,
  dept,
  ym,
}: {
  items: AgendaRow[];
  actions: AgendaAction[];
  people: Person[];
  myMemberId: string;
  dept: DeptFilter;
  ym: YearMonth;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3 anim-screen">
      {items.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <ShapeIcon shape="cloud" color="lime" size={56} face className="mx-auto" />
          <p className="text-sm font-bold" style={{ color: "#9AA0A6" }}>
            {ym.month}月の議題はまだありません。
          </p>
        </div>
      )}

      {GROUPS.map((st) => {
        const group = items.filter((t) => t.state === st);
        if (!group.length) return null;
        const sc = AGENDA_STATE[st];
        return (
          <section key={st} className="space-y-3">
            <div className="flex items-center gap-2 px-1 pt-1">
              <span
                className="text-sm font-extrabold px-3 py-1.5"
                style={{
                  background: SOFT[sc.color as keyof typeof SOFT],
                  color: C[sc.color],
                  borderRadius: "16px 8px 16px 8px",
                }}
              >
                {sc.label}
              </span>
              <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                {group.length}件
              </span>
              <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
            </div>

            {group.map((t, i) => (
              <AgendaCard
                key={t.id}
                item={t}
                index={i}
                actions={actions.filter((a) => a.agenda_item_id === t.id)}
                people={people}
                myMemberId={myMemberId}
                showDept={dept === "all"}
              />
            ))}
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-1.5"
        style={{ borderRadius: "24px 12px 24px 12px", border: "2.5px dashed #CFC7B8", color: "#8A8A8A" }}
      >
        <Plus size={17} strokeWidth={2.8} />
        話したいことを追加
      </button>

      <AddSheet open={open} onClose={() => setOpen(false)} dept={dept} ym={ym} />
    </div>
  );
}

/** 議題を足す。問いの形で書いてもらう（SCREENS 8「決めるべき問いの形で書く」） */
function AddSheet({
  open,
  onClose,
  dept,
  ym,
}: {
  open: boolean;
  onClose: () => void;
  dept: DeptFilter;
  ym: YearMonth;
}) {
  const [state, action, pending] = useActionState<AgendaResult, FormData>(addAgenda, undefined);
  const [chosen, setChosen] = useState<string>(dept === "all" ? "sales" : dept);

  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title="話したいことを追加" subtitle={`${ym.month}月の議題`}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="dept" value={chosen} />
        <input type="hidden" name="year" value={ym.year} />
        <input type="hidden" name="month" value={ym.month} />

        <textarea
          name="title"
          required
          autoFocus
          rows={2}
          placeholder="決めたいことを問いの形で（例：来期の重点業種をどこにするか）"
          className="w-full px-4 py-3 text-base bg-white outline-none resize-none"
          style={field}
        />

        <div className="space-y-1.5">
          <div className="text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
            部署
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEPT_KEYS.map((k) => {
              const d = deptOf(k);
              const on = chosen === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setChosen(k)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2"
                  style={{
                    background: on ? SOFT[d.color as keyof typeof SOFT] : "#fff",
                    color: on ? C[d.color] : "#8A8A8A",
                    border: `2px solid ${on ? C[d.color] : C.line}`,
                    borderRadius: "14px 7px 14px 7px",
                  }}
                >
                  <ShapeIcon shape={d.shape} color={d.color} size={18} />
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {state && "error" in state && (
          <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
            {state.error}
          </p>
        )}

        <OrganicButton type="submit" size="lg" color="orange" className="w-full" disabled={pending}>
          {pending ? "追加しています…" : "追加する"}
        </OrganicButton>
      </form>
    </Sheet>
  );
}
