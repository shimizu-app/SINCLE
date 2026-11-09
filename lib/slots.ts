/**
 * 日程調整の空き時間（SCREENS 10）。
 *
 * 決まり
 *   ・平日の 10:00〜18:00（日本時間）。12:00〜13:00 は外す
 *   ・30分きざみで、所要時間ぶん続けて空いているところ
 *   ・カレンダーの予定（busy）と少しでも重なれば外す
 *
 * 日本には夏時間が無いので、日本時間は UTC+9 で固定して計算する。
 * サーバー（UTC）でもブラウザでも同じ答えになるように、Date のローカル時刻は使わない。
 */

export const DURATIONS = [30, 45, 60, 90] as const;
export const FORMATS = ["Google Meet", "Zoom", "訪問", "来社"] as const;
export const WEEKS = [1, 2, 3] as const;
export const MAX_PICK = 4;

export type Busy = { start: string; end: string };
export type DaySlots = { date: string; label: string; slots: string[] };

const JST = 9 * 3600_000;
const DAY = 86400_000;
const STEP = 30 * 60_000;
const OPEN_H = 10;
const CLOSE_H = 18;
const LUNCH = [12, 13] as const;
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間のその日の 0:00（UTC の時刻） */
function jstMidnight(ms: number): number {
  return Math.floor((ms + JST) / DAY) * DAY - JST;
}

/** "2026-11-10" */
export function jstDate(ms: number): string {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

function jstParts(ms: number) {
  const d = new Date(ms + JST);
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hh: String(d.getUTCHours()).padStart(2, "0"),
    mm: String(d.getUTCMinutes()).padStart(2, "0"),
  };
}

/** 「11/10（火）」 */
export function dayLabel(ms: number): string {
  const p = jstParts(ms);
  return `${p.month}/${p.day}（${WEEKDAY[p.weekday]}）`;
}

/** 「11月10日（火）10:00〜11:00」 */
export function slotLabel(iso: string, durationMin: number): string {
  const start = Date.parse(iso);
  const a = jstParts(start);
  const b = jstParts(start + durationMin * 60_000);
  return `${a.month}月${a.day}日（${WEEKDAY[a.weekday]}）${a.hh}:${a.mm}〜${b.hh}:${b.mm}`;
}

/** 「10:00」 */
export function timeLabel(iso: string): string {
  const p = jstParts(Date.parse(iso));
  return `${p.hh}:${p.mm}`;
}

/** メール本文に入れる候補の書き方 */
export function slotsText(isos: string[], durationMin: number): string {
  return isos.map((iso, i) => `　候補${i + 1}：${slotLabel(iso, durationMin)}`).join("\n");
}

/** 探す期間。明日の 0:00（日本時間）から、weeks 週間 */
export function searchWindow(now: number, weeks: number): { from: number; to: number } {
  const from = jstMidnight(now) + DAY;
  return { from, to: from + weeks * 7 * DAY };
}

/**
 * 空き時間の候補を日ごとに。
 * busy は Google の freeBusy が返す形（ISO 文字列の start / end）。
 */
export function buildSlots(opts: {
  now: number;
  weeks: number;
  durationMin: number;
  busy: Busy[];
}): DaySlots[] {
  const { from, to } = searchWindow(opts.now, opts.weeks);
  const length = opts.durationMin * 60_000;
  const busy = opts.busy
    .map((b) => [Date.parse(b.start), Date.parse(b.end)] as const)
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s);

  const out: DaySlots[] = [];
  for (let day = from; day < to; day += DAY) {
    const weekday = jstParts(day).weekday;
    if (weekday === 0 || weekday === 6) continue;

    const blocks: [number, number][] = [
      [day + OPEN_H * 3600_000, day + LUNCH[0] * 3600_000],
      [day + LUNCH[1] * 3600_000, day + CLOSE_H * 3600_000],
    ];

    const slots: string[] = [];
    for (const [open, close] of blocks) {
      for (let start = open; start + length <= close; start += STEP) {
        const end = start + length;
        if (start <= opts.now) continue;
        if (busy.some(([s, e]) => s < end && e > start)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
    if (slots.length) out.push({ date: jstDate(day), label: dayLabel(day), slots });
  }
  return out;
}

/** 予約ページの期限：最後の候補が始まるまで（ただし30日まで） */
export function bookingExpiry(slots: string[], now: number): string {
  const last = Math.max(...slots.map((s) => Date.parse(s)));
  return new Date(Math.min(last, now + 30 * DAY)).toISOString();
}
