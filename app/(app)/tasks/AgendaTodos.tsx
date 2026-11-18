"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { openAgendaChannel, toggleAction } from "../roadmap/actions";
import { deptOf } from "../roadmap/depts";

export type AgendaTodo = {
  id: string;
  text: string;
  done: boolean;
  agenda: { id: string; title: string; dept: string; year: number; month: number };
};

/**
 * 計画のやること（自分が担当のもの）。
 * 計画は全員に共有の議題ボード。そこで自分に割り当てられたやることを、ここにも出す。
 * チェックは計画と同じものなので、どちらで付けても両方に反映される。
 * 「話す」で、その議題のチャンネル（トークの「議題」）を開く。
 */
export function AgendaTodos({ items }: { items: AgendaTodo[] }) {
  const router = useRouter();
  const [shown, toggle] = useOptimistic(items, (state, id: string) =>
    state.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
  );
  const [, start] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold">計画のやること</h2>
          <p className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
            計画（全員に共有）で、あなたが担当になっているもの
          </p>
        </div>
        <Link href="/roadmap" className="text-[11px] font-bold" style={{ color: C.purple }}>
          計画を開く
        </Link>
      </div>

      {shown.map((item) => {
        const dept = deptOf(item.agenda.dept);
        return (
          <div
            key={item.id}
            className="flex items-start gap-2.5 p-3 bg-white"
            style={{ border: `2px solid ${C.line}`, borderRadius: "20px 10px 20px 10px" }}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={`${item.text} を${item.done ? "未完了に戻す" : "完了にする"}`}
              onClick={() =>
                start(async () => {
                  toggle(item.id);
                  await toggleAction(item.id, !item.done);
                })
              }
              className="w-6 h-6 shrink-0 flex items-center justify-center mt-0.5"
              style={{
                background: item.done ? C.purple : "#fff",
                border: `2px solid ${item.done ? C.purple : C.line}`,
                borderRadius: "8px 4px 8px 4px",
              }}
            >
              {item.done && <Check size={14} strokeWidth={3.5} className="text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-bold break-words"
                style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.5 : 1 }}
              >
                {item.text}
              </div>
              <Link
                href={`/roadmap?ym=${item.agenda.year}-${String(item.agenda.month).padStart(2, "0")}&dept=${item.agenda.dept}`}
                className="inline-block text-[10px] font-extrabold mt-0.5 px-1.5 py-0.5"
                style={{ background: SOFT.purple, color: C.purple, borderRadius: "6px 3px 6px 3px" }}
              >
                計画 ・ {dept.name} {item.agenda.month}月 ・ {item.agenda.title}
              </Link>
            </div>
            <button
              type="button"
              disabled={opening === item.agenda.id}
              onClick={() =>
                start(async () => {
                  setError(null);
                  setOpening(item.agenda.id);
                  const r = await openAgendaChannel(item.agenda.id);
                  setOpening(null);
                  if ("error" in r) setError(r.error);
                  else router.push(`/channels/${r.channelId}`);
                })
              }
              className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 disabled:opacity-50"
              style={{ color: C.pink, background: SOFT.pink, borderRadius: "12px 6px 12px 6px" }}
            >
              <MessageSquare size={12} strokeWidth={2.8} />
              {opening === item.agenda.id ? "開いています…" : "話す"}
            </button>
          </div>
        );
      })}

      {error && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
