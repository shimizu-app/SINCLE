import { C, SOFT } from "@/lib/design";

/** カレンダーに並べるもの（calendar_items と Google カレンダーの予定） */
export type CalendarItem = {
  /** gcal：Google カレンダーの予定（本人にだけ出す） */
  kind: "event" | "task" | "todo" | "gcal";
  id: string;
  title: string;
  at: string;
  has_time: boolean;
  done: boolean | null;
  priority: string | null;
  share: string | null;
  company_name: string | null;
  /** 予定の終わり（打合せ・Google の予定）。タスクには無い */
  end_at?: string | null;
  company_id?: string | null;
  gcal_event_id?: string | null;
  meet_url?: string | null;
};

/** 時間割の中の色 */
export function look(item: CalendarItem) {
  switch (item.kind) {
    case "gcal":
      return { bg: SOFT.blue, edge: C.blue, ink: "#1E4E8C", label: "Google" };
    case "event":
      return { bg: SOFT.green, edge: C.green, ink: "#2F6B3A", label: "予定" };
    case "todo":
      return { bg: SOFT.purple, edge: C.purple, ink: "#4B3A8C", label: "自分のTODO" };
    default:
      return {
        bg: SOFT.yellow,
        edge: item.priority === "高" ? C.red : C.yellow,
        ink: "#7A5A00",
        label: "タスク",
      };
  }
}

/*
 * 日付と時刻は、いつも日本時間で数える。
 * サーバー（Vercel は UTC）と端末で数え方が違うと、日の境目で予定が前の日に出たり、
 * サーバーが作った画面と端末の画面が食い違ったりする。
 */
const JST = 9 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間での年・月(1-12)・日・時・分・曜日 */
export function jst(d: Date) {
  const j = new Date(d.getTime() + JST);
  return {
    y: j.getUTCFullYear(),
    m: j.getUTCMonth() + 1,
    d: j.getUTCDate(),
    h: j.getUTCHours(),
    min: j.getUTCMinutes(),
    dow: j.getUTCDay(),
  };
}

/** 日本時間の日付 "YYYY-MM-DD" */
export const ymd = (d: Date) => {
  const p = jst(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};

/** 日本時間の時刻 "HH:MM" */
export const hm = (d: Date) => {
  const p = jst(d);
  return `${pad(p.h)}:${pad(p.min)}`;
};

/** "YYYY-MM-DD" を、その日の日本時間 0:00 に */
export function dayStart(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - JST);
}

/** "YYYY-MM-DD" を n 日ずらす */
export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 年・月(1-12)・日 から "YYYY-MM-DD" */
export const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 分（0〜1440）を "HH:MM" に */
export const minToHm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
