"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { ShapeIcon } from "@/components/ui";

export type CalendarItem = {
  kind: "event" | "task" | "todo";
  id: string;
  title: string;
  at: string;
  has_time: boolean;
  done: boolean | null;
  priority: string | null;
  share: string | null;
  company_name: string | null;
};

const SCOPES = [
  ["all", "全員"],
  ["mine", "自分"],
  ["team", "チーム共有"],
] as const;

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** SCREENS 7-2 の点の色 */
function dotColor(item: CalendarItem) {
  if (item.kind === "event") return C.green;
  if (item.done) return "#C8C2B6";
  if (item.priority === "高") return C.red;
  if (item.priority === "中") return C.blue;
  return "#C8C2B6";
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function TaskCalendar({
  items,
  year,
  month,
  scope,
}: {
  items: CalendarItem[];
  year: number;
  month: number; // 1-12
  scope: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string>(ymd(new Date()));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = ymd(new Date(item.at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const blanks = first.getDay();
  const todayKey = ymd(new Date());

  function go(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const next = new URLSearchParams(params.toString());
    next.set("tab", "calendar");
    next.set("y", String(d.getFullYear()));
    next.set("m", String(d.getMonth() + 1));
    router.replace(`/tasks?${next}`, { scroll: false });
  }

  function setScope(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "calendar");
    if (value === "all") next.delete("scope");
    else next.set("scope", value);
    router.replace(`/tasks?${next}`, { scroll: false });
  }

  const dayItems = (byDay.get(selected) ?? []).sort((a, b) => {
    if (a.has_time !== b.has_time) return a.has_time ? 1 : -1;
    return a.at.localeCompare(b.at);
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {SCOPES.map(([key, label]) => {
          const on = scope === key;
          return (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={`flex-1 text-xs font-bold py-2 ${on ? "anim-chip" : ""}`}
              style={{
                background: on ? SOFT.green : "#fff",
                color: on ? C.green : "#9AA0A6",
                border: `2px solid ${on ? C.green : C.line}`,
                borderRadius: "14px 7px 14px 7px",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className="bg-white p-3"
        style={{ borderRadius: "26px 13px 26px 13px", border: `2px solid ${C.line}` }}
      >
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => go(-1)} aria-label="前の月" className="p-1.5">
            <ChevronLeft size={18} strokeWidth={3} style={{ color: C.purple }} />
          </button>
          <span className="text-sm font-extrabold">
            {year}年{month}月
          </span>
          <button onClick={() => go(1)} aria-label="次の月" className="p-1.5">
            <ChevronRight size={18} strokeWidth={3} style={{ color: C.purple }} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEK.map((w, i) => (
            <div
              key={w}
              className="text-center text-[10px] font-bold py-1"
              style={{ color: i === 0 ? C.red : i === 6 ? C.blue : "#9AA0A6" }}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: blanks }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const key = ymd(new Date(year, month - 1, day));
            const list = byDay.get(key) ?? [];
            const on = selected === key;
            const today = todayKey === key;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className="aspect-square flex flex-col items-center justify-center gap-0.5"
                style={{
                  background: on ? C.purple : today ? SOFT.purple : "transparent",
                  borderRadius: "10px 5px 10px 5px",
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: on ? "#fff" : today ? C.purple : C.ink }}
                >
                  {day}
                </span>
                <span className="flex gap-0.5 h-1.5">
                  {list.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className="w-1 h-1 rounded-full"
                      style={{ background: on ? "#fff" : dotColor(item) }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── その日の時間割 ── */}
      <div className="space-y-2">
        <div className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
          {selected.replace(/^\d+-0?/, "").replace("-", "/")} の予定
        </div>

        {dayItems.length === 0 ? (
          <p className="text-xs font-bold px-1 py-4" style={{ color: "#C8C2B6" }}>
            この日は何もありません。
          </p>
        ) : (
          dayItems.map((item, i) => {
            const d = new Date(item.at);
            const time = item.has_time
              ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
              : "終日";
            return (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-start gap-2.5 p-3 bg-white anim-item"
                style={{
                  borderRadius: i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
                  border: `2px solid ${C.line}`,
                  animationDelay: `${Math.min(i, 8) * 40}ms`,
                }}
              >
                <span
                  className="text-[11px] font-extrabold w-11 shrink-0 pt-0.5"
                  style={{ color: item.has_time ? C.ink : "#9AA0A6" }}
                >
                  {time}
                </span>
                <ShapeIcon
                  shape={item.kind === "event" ? "drop" : item.kind === "todo" ? "blob" : "sun"}
                  color={item.kind === "event" ? "green" : item.kind === "todo" ? "blue" : "yellow"}
                  size={22}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-bold break-words"
                    style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.5 : 1 }}
                  >
                    {item.title}
                  </div>
                  {item.company_name && (
                    <div className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
                      {item.company_name}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
