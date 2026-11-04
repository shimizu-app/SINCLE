"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Link2, Unlink } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { chooseGoogleCalendars, disconnectGoogleCalendar } from "./actions";

export type CalendarOption = { id: string; name: string; color: string | null; primary: boolean };

export type GoogleCardProps =
  | { state: "unconfigured"; missing: string[] }
  | { state: "needs_migration" }
  | { state: "disconnected" }
  | { state: "expired"; email: string | null }
  | {
      state: "connected";
      email: string | null;
      selected: string[];
      calendars: CalendarOption[] | { error: string };
    };

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

/**
 * 設定の「Google カレンダー」（SCREENS 11）。
 * 連携 / 使うカレンダーの選択 / 共有の仕組みの説明。
 */
export function GoogleCalendarCard(props: GoogleCardProps & { notice?: { tone: "ok" | "ng"; text: string } }) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const connect = (
    <a href="/api/google/connect" className="block">
      <OrganicButton type="button" size="lg" color="green" className="w-full">
        <Link2 size={16} strokeWidth={2.8} />
        Google カレンダーをつなぐ
      </OrganicButton>
    </a>
  );

  return (
    <div className="bg-white p-4 space-y-3" style={card}>
      {props.notice && (
        <p
          className="text-xs font-bold px-3 py-2.5"
          style={{
            background: props.notice.tone === "ok" ? SOFT.green : SOFT.red,
            color: props.notice.tone === "ok" ? C.green : C.red,
            borderRadius: "14px 7px 14px 7px",
          }}
          role="status"
        >
          {props.notice.text}
        </p>
      )}

      {props.state === "unconfigured" && (
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          Google 連携の設定がまだです。管理者が Vercel に{" "}
          <span style={{ color: C.ink }}>{props.missing.join("、")}</span> を入れると使えるようになります。
        </p>
      )}

      {props.state === "needs_migration" && (
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          データベースの更新（020）がまだです。更新が済むとつなげるようになります。
        </p>
      )}

      {props.state === "disconnected" && (
        <>
          <p className="text-xs font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
            つなぐと、タスクのカレンダーにあなたの Google カレンダーの予定が並びます。
            読み取りだけで、Google 側の予定を書き換えることはありません。
          </p>
          {connect}
        </>
      )}

      {props.state === "expired" && (
        <>
          <p className="text-xs font-bold leading-relaxed" style={{ color: C.red }}>
            {props.email ? `${props.email} との` : ""}連携が切れています。もう一度つないでください。
          </p>
          {connect}
        </>
      )}

      {props.state === "connected" && (
        <Connected
          email={props.email}
          selected={props.selected}
          calendars={props.calendars}
          pending={pending}
          onChoose={async (ids) => {
            setProblem(null);
            const r = await chooseGoogleCalendars(ids);
            if (r && "error" in r) setProblem(r.error);
          }}
          onDisconnect={() => {
            if (!window.confirm("Google カレンダーとの連携を外しますか？")) return;
            start(async () => {
              setProblem(null);
              const r = await disconnectGoogleCalendar();
              if (r && "error" in r) setProblem(r.error);
            });
          }}
        />
      )}

      {problem && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {problem}
        </p>
      )}

      {/* 共有の仕組みの説明（SCREENS 11 / SPEC 6章） */}
      <div className="pt-1 space-y-1" style={{ borderTop: `2px dashed ${C.line}` }}>
        <div className="text-[11px] font-extrabold pt-2" style={{ color: "#8A8A8A" }}>
          予定の見え方
        </div>
        <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          つないだ予定は<span style={{ color: C.ink }}>あなたにだけ</span>見えます。ほかのメンバーには見えません。
          チームで見せたい予定は、Google カレンダーに共有カレンダーを1つ作り、全員がそれを購読する形にします
          （一人ずつに予定を入れると、変更のたびに全員分を直すことになるため）。
        </p>
      </div>
    </div>
  );
}

function Connected({
  email,
  selected,
  calendars,
  pending,
  onChoose,
  onDisconnect,
}: {
  email: string | null;
  selected: string[];
  calendars: CalendarOption[] | { error: string };
  pending: boolean;
  onChoose: (ids: string[]) => Promise<void>;
  onDisconnect: () => void;
}) {
  // 見た目の先取り（useOptimistic）は transition の中でしか効かない
  const [saving, startSaving] = useTransition();
  // 何も選んでいなければメインのカレンダーを使う（lib/google.ts の listEvents と同じ決め方）
  const list = Array.isArray(calendars) ? calendars : [];
  const primary = list.find((c) => c.primary)?.id;
  const initial = selected.length ? selected : primary ? [primary] : [];
  const [chosen, choose] = useOptimistic(initial, (_: string[], next: string[]) => next);

  return (
    <>
      <div className="flex items-center gap-3">
        <ShapeIcon shape="arch" color="green" size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold">つながっています</div>
          {email && (
            <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
              {email}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={pending}
          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 shrink-0 disabled:opacity-60"
          style={{ color: "#9AA0A6", border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}
        >
          <Unlink size={12} strokeWidth={2.8} />
          外す
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
          タスクのカレンダーに出すカレンダー
        </div>

        {!Array.isArray(calendars) ? (
          <p className="text-xs font-bold px-1" style={{ color: C.red }}>
            {calendars.error}
          </p>
        ) : (
          calendars.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={pending || saving}
                onClick={() => {
                  const next = on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id];
                  startSaving(async () => {
                    choose(next);
                    await onChoose(next);
                  });
                }}
                className="w-full flex items-center gap-2.5 p-2.5 text-left disabled:opacity-70"
                style={{
                  border: `2px solid ${on ? C.green : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                  background: on ? SOFT.green : "#fff",
                }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: c.color ?? C.green }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 text-sm font-bold truncate">
                  {c.name}
                  {c.primary && (
                    <span className="text-[10px] font-bold ml-1.5" style={{ color: "#9AA0A6" }}>
                      メイン
                    </span>
                  )}
                </span>
                <span
                  className="w-5 h-5 flex items-center justify-center shrink-0"
                  style={{
                    borderRadius: 7,
                    background: on ? C.green : "#fff",
                    border: `2.5px solid ${on ? C.green : "#D6D0C4"}`,
                  }}
                >
                  {on && <Check size={12} className="text-white" strokeWidth={3.4} />}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
