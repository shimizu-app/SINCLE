"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { CalendarAddSheet, CalendarItemSheet } from "./CalendarSheets";
import { addDays, dayStart, hm, jst, keyOf, look, minToHm, ymd, type CalendarItem } from "./calendar-util";

export type { CalendarItem } from "./calendar-util";

const SCOPES = [
  ["all", "全員"],
  ["mine", "自分"],
  ["team", "チーム共有"],
] as const;

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 1時間の高さ（px）。Google カレンダーの1日表示くらい */
const HOUR = 56;

/** SCREENS 7-2 の点の色 */
function dotColor(item: CalendarItem) {
  if (item.kind === "gcal") return C.blue;
  if (item.kind === "event") return C.green;
  if (item.done) return "#C8C2B6";
  if (item.priority === "高") return C.red;
  if (item.priority === "中") return C.yellow;
  return "#C8C2B6";
}

type Placed = { item: CalendarItem; start: number; end: number; col: number; cols: number };

/** 重なる予定を横に並べる（Google カレンダーと同じ考え方：重なりの塊ごとに列を割り当てる） */
function place(items: CalendarItem[], dayStart: Date): Placed[] {
  const base = dayStart.getTime();
  const spans = items
    .map((item) => {
      const s = (new Date(item.at).getTime() - base) / 60_000;
      const rawEnd = item.end_at ? (new Date(item.end_at).getTime() - base) / 60_000 : s + 30;
      // タスクは「時刻」なので30分の枠で見せる。短すぎる予定も読める高さにする
      const e = Math.max(rawEnd, s + 30);
      return { item, start: Math.max(0, s), end: Math.min(24 * 60, e) };
    })
    .filter((x) => x.end > 0 && x.start < 24 * 60)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    out.push(...cluster);
    cluster = [];
  };
  for (const s of spans) {
    if (cluster.length && s.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.end > s.start).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...s, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  if (cluster.length) flush();
  return out;
}

export function TaskCalendar({
  items,
  year,
  month,
  scope,
  google = "none",
  initialDay,
  todayKey: serverToday,
  companies,
  canWriteGoogle,
}: {
  items: CalendarItem[];
  year: number;
  month: number; // 1-12
  scope: string;
  /** Google カレンダーをつないでいるか。切れていれば知らせる */
  google?: "connected" | "expired" | "none";
  /** はじめに開く日（YYYY-MM-DD） */
  initialDay: string;
  /** 今日（日本時間）。端末の時計を読むまでの間に使う */
  todayKey: string;
  /** 予定を入れられる会社（自分の会社） */
  companies: { id: string; name: string }[];
  /** Google カレンダーに予定を入れる許可があるか */
  canWriteGoogle: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string>(initialDay);
  const [adding, setAdding] = useState<{ date: string; time: string } | null>(null);
  const [opened, setOpened] = useState<CalendarItem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // 端末の時計は、画面が出てから読む（サーバーが作った画面と食い違わないように）
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setSelected(initialDay), [initialDay]);

  // 今の時刻の線を1分ごとに動かす
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = ymd(new Date(item.at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const blanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const todayKey = now ? ymd(now) : serverToday;

  function navigate(next: URLSearchParams) {
    next.set("tab", "calendar");
    router.replace(`/tasks?${next}`, { scroll: false });
  }

  function go(delta: number) {
    const t = new Date(Date.UTC(year, month - 1 + delta, 1));
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth() + 1;
    const next = new URLSearchParams(params.toString());
    next.set("y", String(y));
    next.set("m", String(m));
    // 今月に戻ったら今日を、それ以外は1日を開く
    next.set("d", todayKey.startsWith(keyOf(y, m, 1).slice(0, 8)) ? todayKey : keyOf(y, m, 1));
    navigate(next);
  }

  /** 前の日・次の日。月をまたぐときは、その月を読み直す */
  function shiftDay(delta: number) {
    const key = addDays(selected, delta);
    const [y, m] = key.split("-").map(Number);
    if (y === year && m === month) {
      setSelected(key);
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.set("y", String(y));
    next.set("m", String(m));
    next.set("d", key);
    navigate(next);
  }

  function setScope(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("scope");
    else next.set("scope", value);
    next.set("d", selected);
    navigate(next);
  }

  // ── その日 ──
  const dayItems = byDay.get(selected) ?? [];
  const allDay = dayItems.filter((i) => !i.has_time);
  const timed = dayItems.filter((i) => i.has_time);
  const placed = place(timed, dayStart(selected));
  const isToday = selected === todayKey;
  const nowParts = now ? jst(now) : null;
  const nowMin = nowParts ? nowParts.h * 60 + nowParts.min : -1;
  const showNow = isToday && nowMin >= 0;

  // 見せる時間の幅：ふだんは 7時〜21時。外に予定があれば広げる
  const firstHour = Math.max(0, Math.min(7, ...placed.map((p) => Math.floor(p.start / 60))));
  const lastHour = Math.min(24, Math.max(21, ...placed.map((p) => Math.ceil(p.end / 60))));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (min: number) => ((min - firstHour * 60) / 60) * HOUR;

  /** 何も無いところを押したら、その時刻（30分きざみ）で予定を入れる */
  function onTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = firstHour * 60 + Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30;
    const clamped = Math.max(0, Math.min(23 * 60 + 30, min));
    setAdding({ date: selected, time: minToHm(clamped) });
  }

  /** 「＋ 入れる」のときの時刻：今日なら次の正時、ほかの日は 10:00 */
  function defaultTime() {
    if (!isToday || !nowParts) return "10:00";
    return minToHm(Math.min(23, nowParts.h + 1) * 60);
  }

  const sel = jst(dayStart(selected));
  const dayTitle = `${sel.m}月${sel.d}日（${WEEK[sel.dow]}）`;

  return (
    <div className="space-y-3">
      {google === "expired" && (
        <Link
          href="/settings#google"
          className="block px-3.5 py-2.5 text-xs font-bold"
          style={{ background: SOFT.orange, color: "#8A4B00", borderRadius: "14px 7px 14px 7px" }}
        >
          Google カレンダーとの連携が切れています。設定からつなぎ直してください →
        </Link>
      )}
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

      {/* ── 月 ── */}
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
            const key = keyOf(year, month, day);
            const list = byDay.get(key) ?? [];
            const on = selected === key;
            const today = todayKey === key;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                aria-label={`${month}月${day}日${list.length ? `（${list.length}件）` : ""}`}
                aria-pressed={on}
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
                      key={`${item.kind}-${item.id}`}
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

      {/* ── その日（Google カレンダーのような時間割） ── */}
      <div
        className="bg-white overflow-hidden"
        style={{ borderRadius: "26px 13px 26px 13px", border: `2px solid ${C.line}` }}
      >
        <div className="flex items-center gap-1 px-2 pt-3 pb-2" style={{ borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => shiftDay(-1)} aria-label="前の日" className="p-1.5 shrink-0">
            <ChevronLeft size={20} strokeWidth={3} style={{ color: C.purple }} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-extrabold truncate">{dayTitle}</h2>
              {isToday && (
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 shrink-0"
                  style={{ background: C.purple, color: "#fff", borderRadius: "999px" }}
                >
                  今日
                </span>
              )}
            </div>
            <div className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
              {dayItems.length ? `${dayItems.length}件の予定` : "予定はありません"}
            </div>
          </div>
          <button onClick={() => shiftDay(1)} aria-label="次の日" className="p-1.5 shrink-0">
            <ChevronRight size={20} strokeWidth={3} style={{ color: C.purple }} />
          </button>
          <button
            onClick={() => setAdding({ date: selected, time: defaultTime() })}
            className="flex items-center gap-1 text-xs font-extrabold px-3 py-2 text-white shrink-0"
            style={{ background: C.green, borderRadius: "14px 7px 14px 7px" }}
          >
            <Plus size={14} strokeWidth={3} />
            入れる
          </button>
        </div>

        {note && (
          <p
            className="mx-3 mt-2 px-3 py-2 text-[11px] font-bold"
            style={{ background: SOFT.orange, color: "#8A4B00", borderRadius: "12px 6px 12px 6px" }}
            role="status"
          >
            {note}
          </p>
        )}

        {/* 終日 */}
        {allDay.length > 0 && (
          <div className="flex gap-2 px-3 pt-2.5">
            <span className="text-[10px] font-extrabold w-10 shrink-0 pt-1.5 text-right" style={{ color: "#9AA0A6" }}>
              終日
            </span>
            <div className="flex-1 min-w-0 space-y-1">
              {allDay.map((item) => {
                const l = look(item);
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() => setOpened(item)}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold truncate"
                    style={{
                      background: l.bg,
                      color: l.ink,
                      borderLeft: `4px solid ${l.edge}`,
                      borderRadius: "8px",
                      textDecoration: item.done ? "line-through" : "none",
                      opacity: item.done ? 0.55 : 1,
                    }}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 時間割 */}
        <div className="flex px-3 py-3">
          <div className="w-10 shrink-0 relative" style={{ height: hours.length * HOUR }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-1.5 text-[10px] font-bold -translate-y-1/2"
                style={{ top: (h - firstHour) * HOUR, color: "#9AA0A6" }}
              >
                {h === firstHour ? "" : `${h}:00`}
              </span>
            ))}
          </div>
          <div
            onClick={onTimelineClick}
            className="flex-1 min-w-0 relative cursor-pointer"
            style={{ height: hours.length * HOUR }}
            aria-label="時間を押すと、その時刻で予定を入れられます"
          >
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 pointer-events-none"
                style={{ top: (h - firstHour) * HOUR, borderTop: `1px solid ${C.line}` }}
              />
            ))}
            {hours.map((h) => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 pointer-events-none"
                style={{ top: (h - firstHour) * HOUR + HOUR / 2, borderTop: `1px dashed #EFEAE0` }}
              />
            ))}

            {placed.map(({ item, start, end, col, cols }) => {
              const l = look(item);
              const height = Math.max(22, ((end - start) / 60) * HOUR - 2);
              const startAt = new Date(item.at);
              const short = height < 40;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setOpened(item)}
                  className="absolute text-left px-2 py-1 overflow-hidden"
                  style={{
                    top: top(start) + 1,
                    height,
                    left: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 4px)`,
                    background: l.bg,
                    color: l.ink,
                    borderLeft: `4px solid ${l.edge}`,
                    borderRadius: "8px",
                    opacity: item.done ? 0.55 : 1,
                    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
                  }}
                >
                  <div
                    className={`text-xs font-extrabold leading-tight ${short ? "truncate" : "line-clamp-2"}`}
                    style={{ textDecoration: item.done ? "line-through" : "none" }}
                  >
                    {short ? `${hm(startAt)} ${item.title}` : item.title}
                  </div>
                  {!short && (
                    <div className="text-[10px] font-bold mt-0.5 truncate" style={{ opacity: 0.8 }}>
                      {hm(startAt)}
                      {item.end_at ? `〜${hm(new Date(item.end_at))}` : ""}
                      {item.company_name ? ` ・ ${item.company_name}` : ""}
                      {item.kind === "gcal" ? " ・ Google" : ""}
                    </div>
                  )}
                </button>
              );
            })}

            {showNow && nowMin >= firstHour * 60 && nowMin <= lastHour * 60 && (
              <div className="absolute left-0 right-0 pointer-events-none" style={{ top: top(nowMin) }}>
                <div className="relative" style={{ borderTop: `2px solid ${C.red}` }}>
                  <span
                    className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full"
                    style={{ background: C.red }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] font-bold px-3 pb-3" style={{ color: "#C8C2B6" }}>
          空いている時間を押すと、その時刻で予定やタスクを入れられます。
        </p>
      </div>

      <CalendarAddSheet
        open={adding !== null}
        date={adding?.date ?? selected}
        time={adding?.time ?? "10:00"}
        companies={companies}
        googleConnected={google === "connected"}
        canWriteGoogle={canWriteGoogle}
        onClose={() => setAdding(null)}
        onDone={(message) => {
          setAdding(null);
          setNote(message ?? null);
          router.refresh();
        }}
      />

      <CalendarItemSheet item={opened} onClose={() => setOpened(null)} onDeleted={() => router.refresh()} />
    </div>
  );
}
