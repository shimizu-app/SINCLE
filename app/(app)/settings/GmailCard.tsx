"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Link2, Search } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { GMAIL_SCOPES, type GmailScope } from "@/lib/mail-parse";
import { setGmailScope, setMailWatch } from "./actions";

export type MailContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  mail_watch: boolean;
};

export type GmailCardProps = {
  state: "unconfigured" | "needs_migration" | "disconnected" | "expired" | "no_permission" | "connected";
  email: string | null;
  scope: GmailScope;
  lastSyncAt: string | null;
  migration?: string;
  contacts: MailContact[];
};

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

const when = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 設定の「Gmail」（SCREENS 11）。
 * 連携 / 取り込み範囲（3段階）/ 取り込む相手の一覧（個別にオフ可）。
 */
export function GmailCard(props: GmailCardProps) {
  const connected = props.state === "connected";
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="bg-white p-4 space-y-4" style={card}>
      {/* ── 連携 ── */}
      {connected ? (
        <div className="flex items-center gap-3">
          <ShapeIcon shape="square" color="blue" size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold">つながっています</div>
            <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
              {props.email ?? "Google アカウント"}
              {props.lastSyncAt && ` ・ 前回の取り込み ${when.format(new Date(props.lastSyncAt))}`}
            </div>
          </div>
          <Link
            href="/mail"
            className="text-[11px] font-bold px-2.5 py-1.5 shrink-0"
            style={{ color: C.blue, border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}
          >
            メールを見る
          </Link>
        </div>
      ) : props.state === "unconfigured" ? (
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          Google 連携の設定がまだです（上の Google カレンダーと同じ設定を使います）。
        </p>
      ) : props.state === "needs_migration" ? (
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          データベースの更新（{props.migration ?? "021"}）がまだです。更新が済むとつなげるようになります。
        </p>
      ) : (
        <>
          <p
            className="text-xs font-bold leading-relaxed"
            style={{ color: props.state === "expired" ? C.red : "#6B6B6B" }}
          >
            {props.state === "expired"
              ? "Google との連携が切れています。もう一度つないでください。"
              : props.state === "no_permission"
                ? "Google カレンダーはつながっています。Gmail を読む許可を足すと、登録した相手とのメールが入ります。"
                : "つなぐと、登録した相手とのメールが会社ごとの履歴に入ります。読み取りだけで、送信や削除はしません。"}
          </p>
          <a href="/api/google/connect?with=gmail" className="block">
            <OrganicButton type="button" size="lg" color="blue" className="w-full">
              <Link2 size={16} strokeWidth={2.8} />
              {props.state === "no_permission" ? "Gmail の許可を足す" : "Gmail をつなぐ"}
            </OrganicButton>
          </a>
        </>
      )}

      {/* ── 取り込み範囲 ── */}
      {connected && <ScopePicker scope={props.scope} onProblem={setProblem} />}

      {/* ── 取り込む相手 ── */}
      <People contacts={props.contacts} onProblem={setProblem} />

      {problem && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {problem}
        </p>
      )}

      <div className="pt-1 space-y-1" style={{ borderTop: `2px dashed ${C.line}` }}>
        <div className="text-[11px] font-extrabold pt-2" style={{ color: "#8A8A8A" }}>
          メールの見え方
        </div>
        <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          取り込んだメールは<span style={{ color: C.ink }}>チームのメンバー全員に見えます</span>
          （会社ごとの履歴に残すため）。社内どうしのやりとりと、広告・お知らせは入れません。
          連携を外すときは、上の Google カレンダーの「外す」から（カレンダーとメールは同じ連携です）。
        </p>
      </div>
    </div>
  );
}

function ScopePicker({ scope, onProblem }: { scope: GmailScope; onProblem: (p: string | null) => void }) {
  const [saving, start] = useTransition();
  const [shown, show] = useOptimistic(scope, (_: GmailScope, next: GmailScope) => next);

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
        取り込む範囲（あなたの Gmail だけに効きます）
      </div>
      {GMAIL_SCOPES.map((s) => {
        const on = shown === s.key;
        return (
          <button
            key={s.key}
            type="button"
            disabled={saving}
            onClick={() => {
              if (on) return;
              if (
                s.key === "all" &&
                !window.confirm("受信箱のメールが、広告・お知らせ以外すべてチームに見えるようになります。よろしいですか？")
              ) {
                return;
              }
              start(async () => {
                onProblem(null);
                show(s.key);
                const r = await setGmailScope(s.key);
                if (r && "error" in r) onProblem(r.error);
              });
            }}
            className="w-full flex items-start gap-2.5 p-2.5 text-left disabled:opacity-70"
            style={{
              border: `2px solid ${on ? C.blue : C.line}`,
              borderRadius: "14px 7px 14px 7px",
              background: on ? SOFT.blue : "#fff",
            }}
          >
            <span
              className="w-4 h-4 mt-0.5 rounded-full shrink-0"
              style={{ border: `2.5px solid ${on ? C.blue : "#D6D0C4"}`, background: on ? C.blue : "#fff" }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-extrabold">
                {s.label}
                {s.key === "registered" && (
                  <span className="text-[10px] font-bold ml-1.5" style={{ color: "#9AA0A6" }}>
                    おすすめ
                  </span>
                )}
              </span>
              <span
                className="block text-[11px] font-bold leading-relaxed"
                style={{ color: s.key === "all" ? C.orange : "#9AA0A6" }}
              >
                {s.desc}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: "#9AA0A6" }}>
        どの範囲でも、取り込んだスレッドへの返信は入ります（相手の同僚の方からの返信など）。
      </p>
    </div>
  );
}

function People({ contacts, onProblem }: { contacts: MailContact[]; onProblem: (p: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [, start] = useTransition();
  const [state, setOne] = useOptimistic(
    contacts,
    (list: MailContact[], change: { id: string; on: boolean }) =>
      list.map((c) => (c.id === change.id ? { ...c, mail_watch: change.on } : c))
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state;
    return state.filter((c) =>
      [c.name, c.email, c.company ?? ""].some((v) => v.toLowerCase().includes(q))
    );
  }, [state, query]);

  const on = state.filter((c) => c.mail_watch).length;

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
        取り込む相手（{on} / {state.length}人）
      </div>
      <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: "#9AA0A6" }}>
        名刺にメールアドレスがある人です。オフにした人のメールは、だれの Gmail からも取り込みません。
      </p>

      {state.length > 8 && (
        <label
          className="flex items-center gap-2 px-3 py-2"
          style={{ border: `2px solid ${C.line}`, borderRadius: "14px 7px 14px 7px" }}
        >
          <Search size={14} strokeWidth={2.8} style={{ color: "#9AA0A6" }} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・会社・アドレスで探す"
            className="flex-1 min-w-0 text-sm font-bold outline-none bg-transparent"
          />
        </label>
      )}

      {state.length === 0 ? (
        <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
          メールアドレスのある名刺がまだありません。
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                start(async () => {
                  onProblem(null);
                  setOne({ id: c.id, on: !c.mail_watch });
                  const r = await setMailWatch(c.id, !c.mail_watch);
                  if (r && "error" in r) onProblem(r.error);
                })
              }
              className="w-full flex items-center gap-2.5 p-2.5 text-left"
              style={{
                border: `2px solid ${c.mail_watch ? C.line : "#F1ECE3"}`,
                borderRadius: "14px 7px 14px 7px",
                background: c.mail_watch ? "#fff" : "#FAF7F1",
              }}
              aria-pressed={c.mail_watch}
            >
              <span className="flex-1 min-w-0">
                <span
                  className="block text-sm font-bold truncate"
                  style={{ color: c.mail_watch ? C.ink : "#B5AFA4" }}
                >
                  {c.name}
                  {c.company && (
                    <span className="text-[11px] font-bold ml-1.5" style={{ color: "#9AA0A6" }}>
                      {c.company}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
                  {c.email}
                </span>
              </span>
              <span
                className="w-5 h-5 flex items-center justify-center shrink-0"
                style={{
                  borderRadius: 7,
                  background: c.mail_watch ? C.blue : "#fff",
                  border: `2.5px solid ${c.mail_watch ? C.blue : "#D6D0C4"}`,
                }}
              >
                {c.mail_watch && <Check size={12} className="text-white" strokeWidth={3.4} />}
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
              当てはまる人がいません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
