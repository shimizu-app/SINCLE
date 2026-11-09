"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Link2, Mail } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { DURATIONS, FORMATS, MAX_PICK, WEEKS, slotLabel, timeLabel, type DaySlots } from "@/lib/slots";
import { createBookingLink } from "./actions";

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

type Contact = { id: string; name: string; email: string | null; title: string | null };

export function ScheduleClient(props: {
  companyId: string;
  companyName: string;
  contacts: Contact[];
  contactId: string | null;
  durationMin: number;
  format: string;
  weeks: number;
  calendars: { id: string; name: string; primary: boolean }[];
  chosenCalendars: string[];
  days: DaySlots[];
  problem: string | null;
  canWrite: boolean;
  hasMeetingUrl: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [picked, setPicked] = useState<string[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [loading, startLoading] = useTransition();

  // 条件を変えたら、空き時間を出し直す（サーバーでカレンダーを見直す）
  const set = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    q.set(key, value);
    setPicked([]);
    setUrl(null);
    startLoading(() => router.replace(`/schedule?${q.toString()}`, { scroll: false }));
  };

  const toggleCalendar = (id: string) => {
    const next = props.chosenCalendars.includes(id)
      ? props.chosenCalendars.filter((x) => x !== id)
      : [...props.chosenCalendars, id];
    if (!next.length) return;
    set("cal", next.join(","));
  };

  const toggleSlot = (iso: string) => {
    setUrl(null);
    setError(null);
    setPicked((now) =>
      now.includes(iso) ? now.filter((x) => x !== iso) : now.length >= MAX_PICK ? now : [...now, iso].sort()
    );
  };

  const contact = props.contacts.find((c) => c.id === props.contactId) ?? null;
  const composeHref = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ company: props.companyId, d: String(props.durationMin), f: props.format, ...extra });
    if (props.contactId) q.set("contact", props.contactId);
    return `/mail/compose?${q.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* ── ① 条件 ── */}
      <div className="bg-white p-4 space-y-3.5" style={card}>
        <Row label="相手">
          {props.contacts.length ? (
            <select
              value={props.contactId ?? ""}
              onChange={(e) => set("contact", e.target.value)}
              className="w-full bg-white px-3 py-2 text-sm font-bold outline-none"
              style={{ border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}
            >
              {props.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? `（${c.title}）` : ""}
                  {c.email ? "" : " ・ メールなし"}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
              この会社の名刺がまだありません
            </span>
          )}
        </Row>
        <Row label="所要時間">
          <Chips
            items={DURATIONS.map((d) => [String(d), `${d}分`] as const)}
            value={String(props.durationMin)}
            onPick={(v) => set("d", v)}
          />
        </Row>
        <Row label="実施形式">
          <Chips items={FORMATS.map((f) => [f, f] as const)} value={props.format} onPick={(v) => set("f", v)} />
        </Row>
        {props.format === "Zoom" && !props.hasMeetingUrl && (
          <p className="text-[11px] font-bold leading-relaxed" style={{ color: C.orange }}>
            Zoom のURLがまだです。
            <Link href="/settings#prefs" className="underline">
              設定の「あなたの設定」
            </Link>
            で入れてください（Zoom のリンクは Google からは作れません）。
          </p>
        )}
        <Row label="対象期間">
          <Chips
            items={WEEKS.map((w) => [String(w), `${w}週間`] as const)}
            value={String(props.weeks)}
            onPick={(v) => set("w", v)}
          />
        </Row>
        {props.calendars.length > 1 && (
          <Row label="使うカレンダー">
            <div className="flex flex-wrap gap-1.5">
              {props.calendars.map((c) => {
                const on = props.chosenCalendars.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCalendar(c.id)}
                    aria-pressed={on}
                    className="text-[11px] font-bold px-2.5 py-1.5 max-w-full truncate"
                    style={{
                      border: `2px solid ${on ? C.green : C.line}`,
                      background: on ? SOFT.green : "#fff",
                      color: on ? C.green : "#9AA0A6",
                      borderRadius: "12px 6px 12px 6px",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Row>
        )}
      </div>

      {!props.canWrite && (
        <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: C.orange }}>
          予約ページで確定したときにカレンダーへ予定を入れるには、Google をつなぎ直して「予定の作成」を許可してください。
          <a href="/api/google/connect" className="underline ml-1">
            つなぎ直す
          </a>
        </p>
      )}

      {/* ── ② 空き時間 ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-extrabold">空いている時間</span>
          <span className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            平日 10:00〜18:00（昼を除く）・ {picked.length}/{MAX_PICK} 選択
          </span>
        </div>

        {props.problem ? (
          <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
            {props.problem}
          </p>
        ) : loading ? (
          <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            カレンダーを見ています…
          </p>
        ) : !props.days.length ? (
          <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            この期間に空いている時間がありません。期間を延ばすか、所要時間を短くしてください。
          </p>
        ) : (
          props.days.map((day) => (
            <div key={day.date} className="bg-white p-3 space-y-2" style={{ ...card, borderRadius: "22px 11px 22px 11px" }}>
              <div className="text-xs font-extrabold" style={{ color: "#6B6B6B" }}>
                {day.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {day.slots.map((iso) => {
                  const on = picked.includes(iso);
                  const full = !on && picked.length >= MAX_PICK;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => toggleSlot(iso)}
                      disabled={full}
                      aria-pressed={on}
                      className="text-xs font-extrabold px-2.5 py-1.5 disabled:opacity-40"
                      style={{
                        background: on ? C.purple : "#fff",
                        color: on ? "#fff" : C.purple,
                        border: `2px solid ${on ? C.purple : SOFT.purple}`,
                        borderRadius: "10px 5px 10px 5px",
                      }}
                    >
                      {timeLabel(iso)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── ③ アクション ── */}
      {picked.length > 0 && (
        <div
          className="bg-white p-3.5 space-y-2.5 sticky bottom-24 z-10"
          style={{ ...card, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }}
        >
          {/* 張り付いていても候補を隠しすぎないよう、選んだ候補は1行にまとめる */}
          <div className="text-[11px] font-bold leading-snug" style={{ color: "#6B6B6B" }}>
            <span className="font-extrabold" style={{ color: C.purple }}>
              候補 {picked.length}つ：
            </span>
            {picked.map((iso) => slotLabel(iso, props.durationMin).replace(/〜.*$/, "")).join(" ／ ")}
          </div>

          {!url ? (
            <div className="grid grid-cols-2 gap-2">
            <Link href={composeHref({ slots: picked.join(",") })} className="block">
              <OrganicButton type="button" size="sm" color="blue" className="w-full">
                <Mail size={13} strokeWidth={2.8} />
                メールを作る
              </OrganicButton>
            </Link>
            <OrganicButton
              type="button"
              size="sm"
              variant="outline"
              color="purple"
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await createBookingLink({
                    companyId: props.companyId,
                    contactId: props.contactId,
                    durationMin: props.durationMin,
                    format: props.format,
                    slots: picked,
                    calendarIds: props.chosenCalendars,
                  });
                  if ("error" in r) setError(r.error);
                  else setUrl(r.url);
                })
              }
            >
              <Link2 size={13} strokeWidth={2.8} />
              {pending ? "発行しています…" : "予約ページを発行"}
            </OrganicButton>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className="flex items-center gap-2 p-2.5"
                style={{ background: SOFT.purple, borderRadius: "14px 7px 14px 7px" }}
              >
                <span className="flex-1 min-w-0 text-[11px] font-bold break-all" style={{ color: C.purple }}>
                  {url}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(url).then(() => setCopied(true));
                  }}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold px-2 py-1.5 bg-white"
                  style={{ color: C.purple, borderRadius: "10px 5px 10px 5px" }}
                >
                  {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={3} />}
                  {copied ? "コピーした" : "コピー"}
                </button>
              </div>
              <Link href={composeHref({ booking: url })} className="block">
                <OrganicButton type="button" size="sm" color="purple" className="w-full">
                  <Mail size={13} strokeWidth={2.8} />
                  このURLを入れてメールを作る
                </OrganicButton>
              </Link>
              <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
                お客さまが時刻を選ぶと、あなたのカレンダーに予定が入り、
                {contact?.email ? `${contact.name}さんに招待メールが届きます` : "（相手のメールが無いので招待は届きません）"}
                。準備タスクとチャンネルへの知らせもできます。
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-extrabold" style={{ color: "#8A8A8A" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Chips({
  items,
  value,
  onPick,
}: {
  items: readonly (readonly [string, string])[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([key, label]) => {
        const on = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => !on && onPick(key)}
            aria-pressed={on}
            className="text-xs font-extrabold px-3 py-1.5"
            style={{
              background: on ? C.ink : "#fff",
              color: on ? "#fff" : "#6B6B6B",
              border: `2px solid ${on ? C.ink : C.line}`,
              borderRadius: "12px 6px 12px 6px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
