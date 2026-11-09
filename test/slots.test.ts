import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingExpiry, buildSlots, searchWindow, slotLabel, slotsText } from "../lib/slots";

// 2026-11-09（月）09:00 日本時間 = 2026-11-09T00:00Z
const MON_9AM = Date.parse("2026-11-09T00:00:00Z");

test("探すのは明日から。土日は外す", () => {
  const { from, to } = searchWindow(MON_9AM, 1);
  assert.equal(new Date(from).toISOString(), "2026-11-09T15:00:00.000Z"); // 11/10 0:00 JST
  assert.equal((to - from) / 86400_000, 7);

  const days = buildSlots({ now: MON_9AM, weeks: 1, durationMin: 60, busy: [] });
  assert.deepEqual(
    days.map((d) => d.label),
    ["11/10（火）", "11/11（水）", "11/12（木）", "11/13（金）", "11/16（月）"]
  );
});

test("10:00〜18:00、昼の12:00〜13:00は外す。30分きざみ", () => {
  const [tue] = buildSlots({ now: MON_9AM, weeks: 1, durationMin: 60, busy: [] });
  const times = tue.slots.map((s) => slotLabel(s, 60).slice(-11));
  assert.equal(times[0], "10:00〜11:00");
  assert.ok(times.includes("11:00〜12:00"));
  assert.ok(!times.some((t) => t.startsWith("11:30")), "昼にかかる枠は入れない");
  assert.ok(!times.some((t) => t.startsWith("12:")), "昼休みは入れない");
  assert.equal(times.at(-1), "17:00〜18:00");
  // 午前 10:00,10:30,11:00 ＋ 午後 13:00〜17:00 の 9 枠
  assert.equal(tue.slots.length, 3 + 9);
});

test("予定と少しでも重なる枠は外す", () => {
  // 11/10 14:00〜15:00 JST に予定
  const busy = [{ start: "2026-11-10T05:00:00Z", end: "2026-11-10T06:00:00Z" }];
  const [tue] = buildSlots({ now: MON_9AM, weeks: 1, durationMin: 60, busy });
  const starts = tue.slots.map((s) => slotLabel(s, 60).slice(-11, -6));
  assert.ok(!starts.includes("13:30"));
  assert.ok(!starts.includes("14:00"));
  assert.ok(!starts.includes("14:30"));
  assert.ok(starts.includes("13:00"));
  assert.ok(starts.includes("15:00"));
});

test("一日じゅう埋まっている日は出さない", () => {
  const busy = [{ start: "2026-11-10T00:00:00Z", end: "2026-11-10T10:00:00Z" }];
  const days = buildSlots({ now: MON_9AM, weeks: 1, durationMin: 30, busy });
  assert.equal(days[0].label, "11/11（水）");
});

test("90分は、昼をまたげない", () => {
  const [tue] = buildSlots({ now: MON_9AM, weeks: 1, durationMin: 90, busy: [] });
  const starts = tue.slots.map((s) => slotLabel(s, 90).slice(-11, -6));
  assert.deepEqual(starts.slice(0, 2), ["10:00", "10:30"]);
  assert.ok(!starts.includes("11:00"));
  assert.equal(starts.at(-1), "16:30");
});

test("メールに入れる書き方と、予約ページの期限", () => {
  const a = "2026-11-10T01:00:00.000Z";
  const b = "2026-11-12T05:00:00.000Z";
  assert.equal(slotsText([a, b], 60), "　候補1：11月10日（火）10:00〜11:00\n　候補2：11月12日（木）14:00〜15:00");
  assert.equal(bookingExpiry([a, b], MON_9AM), b);
});
