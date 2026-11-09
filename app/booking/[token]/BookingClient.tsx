"use client";

import { useState, useTransition } from "react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { dayLabel, slotLabel, timeLabel } from "@/lib/slots";
import { confirmBooking } from "./actions";

/** 候補の時刻ボタン → 確定（SCREENS 10「予約ページ」） */
export function BookingClient({
  token,
  slots,
  durationMin,
  format,
}: {
  token: string;
  slots: string[];
  durationMin: number;
  format: string;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; meetUrl: string | null; invited: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div
        className="bg-white p-5 space-y-3 text-center"
        style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.green}` }}
        role="status"
      >
        <div className="text-lg font-extrabold" style={{ color: C.green }}>
          確定しました
        </div>
        <div className="text-sm font-extrabold">{done.label}</div>
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
          {done.invited ? "カレンダーの招待メールをお送りしました。" : "当日はどうぞよろしくお願いいたします。"}
          {format === "Google Meet" && done.meetUrl ? " 会議のリンクは招待メールにも入っています。" : ""}
        </p>
        {done.meetUrl && (
          <a
            href={done.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-extrabold py-2.5 break-all"
            style={{ background: SOFT.blue, color: C.blue, borderRadius: "14px 7px 14px 7px" }}
          >
            {done.meetUrl}
          </a>
        )}
      </div>
    );
  }

  // 日ごとにまとめる
  const days = new Map<string, string[]>();
  for (const s of slots) {
    const key = dayLabel(Date.parse(s));
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  return (
    <div className="space-y-3">
      {[...days.entries()].map(([label, list]) => (
        <div
          key={label}
          className="bg-white p-4 space-y-2.5"
          style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
        >
          <div className="text-sm font-extrabold">{label}</div>
          <div className="grid grid-cols-2 gap-2">
            {list.map((s) => {
              const on = chosen === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setChosen(s);
                    setError(null);
                  }}
                  aria-pressed={on}
                  className="py-3 text-base font-extrabold"
                  style={{
                    background: on ? C.purple : "#fff",
                    color: on ? "#fff" : C.purple,
                    border: `2.5px solid ${on ? C.purple : SOFT.purple}`,
                    borderRadius: "14px 7px 14px 7px",
                  }}
                >
                  {timeLabel(s)}〜
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <p className="text-sm font-bold text-center" style={{ color: C.red }} role="alert">
          {error}
        </p>
      )}

      <OrganicButton
        type="button"
        size="lg"
        className="w-full"
        disabled={!chosen || pending}
        onClick={() =>
          chosen &&
          start(async () => {
            setError(null);
            const r = await confirmBooking(token, chosen);
            if ("error" in r) setError(r.error);
            else setDone(r);
          })
        }
      >
        {pending ? "確定しています…" : chosen ? `${slotLabel(chosen, durationMin)} で確定する` : "時刻を選んでください"}
      </OrganicButton>
    </div>
  );
}
