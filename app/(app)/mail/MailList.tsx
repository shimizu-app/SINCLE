"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckSquare, ChevronDown } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { stripQuoted } from "@/lib/mail-parse";
import { getMailBody, mailToTask } from "./actions";

export type MailItem = {
  id: string;
  subject: string;
  excerpt: string | null;
  direction: "in" | "out";
  replied: boolean;
  sent_at: string;
  from_email: string | null;
  to_email: string | null;
  company_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  task_id: string | null;
};

const when = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** メールの一覧（SCREENS 4「メール」・9「連携後」）。押すと本文が開く */
export function MailList({ items, showCompany = true }: { items: MailItem[]; showCompany?: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((m, i) => (
        <MailCard key={m.id} mail={m} showCompany={showCompany} odd={i % 2 === 1} />
      ))}
    </div>
  );
}

function MailCard({ mail, showCompany, odd }: { mail: MailItem; showCompany: boolean; odd: boolean }) {
  const [open, setOpen] = useState(false);
  const [quoted, setQuoted] = useState(false);
  const [taskState, setTaskState] = useState<"none" | "made" | "todo">(mail.task_id ? "made" : "none");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [body, setBody] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && body === null) {
      startLoading(async () => {
        const r = await getMailBody(mail.id);
        setBody("error" in r ? "" : r.body);
        if ("error" in r) setProblem(r.error);
      });
    }
  };

  const inbound = mail.direction === "in";
  const unreplied = inbound && !mail.replied;
  const who =
    mail.contact_name ??
    (inbound ? mail.from_email : mail.to_email?.split(",")[0]?.trim()) ??
    "（相手不明）";

  const full = body ?? "";
  const main = stripQuoted(full);
  const hasQuote = main.length < full.trim().length;

  return (
    <article
      className="bg-white anim-item"
      style={{
        borderRadius: odd ? "22px 11px 22px 11px" : "11px 22px 11px 22px",
        border: `2px solid ${unreplied ? "#F6C9C4" : C.line}`,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left p-3.5 space-y-1.5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[10px] font-extrabold px-2 py-0.5 shrink-0"
            style={{
              background: inbound ? SOFT.blue : SOFT.green,
              color: inbound ? C.blue : C.green,
              borderRadius: "8px 4px 8px 4px",
            }}
          >
            {inbound ? "受信" : "送信"}
          </span>
          {unreplied && (
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 shrink-0"
              style={{ background: SOFT.red, color: C.red, borderRadius: "4px 8px 4px 8px" }}
            >
              未返信
            </span>
          )}
          <span className="text-xs font-bold truncate flex-1" style={{ color: "#6B6B6B" }}>
            {inbound ? "" : "→ "}
            {who}
          </span>
          <time className="text-[11px] font-bold shrink-0" style={{ color: "#9AA0A6" }} dateTime={mail.sent_at}>
            {when.format(new Date(mail.sent_at))}
          </time>
        </div>
        <div className="flex items-start gap-1">
          <h3 className="text-sm font-extrabold leading-snug flex-1 min-w-0 break-words">{mail.subject}</h3>
          <ChevronDown
            size={16}
            strokeWidth={2.8}
            className="shrink-0 mt-0.5 transition-transform"
            style={{ color: "#C8C2B6", transform: open ? "rotate(180deg)" : undefined }}
            aria-hidden="true"
          />
        </div>
        {!open && mail.excerpt && (
          <p className="text-xs font-bold leading-relaxed line-clamp-2" style={{ color: "#9AA0A6" }}>
            {mail.excerpt}
          </p>
        )}
      </button>

      {open && (
        <div className="px-3.5 pb-3 space-y-2">
          <div className="text-[11px] font-bold space-y-0.5" style={{ color: "#9AA0A6" }}>
            {mail.from_email && <div className="truncate">差出人：{mail.from_email}</div>}
            {mail.to_email && <div className="truncate">宛先：{mail.to_email}</div>}
          </div>
          <p
            className="text-[13px] leading-relaxed whitespace-pre-wrap break-words p-3"
            style={{ background: C.bg, borderRadius: "14px 7px 14px 7px" }}
          >
            {loading || body === null ? "読み込んでいます…" : (quoted ? full : main) || "（本文なし）"}
          </p>
          {hasQuote && (
            <button
              type="button"
              onClick={() => setQuoted((v) => !v)}
              className="text-[11px] font-bold"
              style={{ color: C.blue }}
            >
              {quoted ? "引用をたたむ" : "引用も表示する"}
            </button>
          )}
        </div>
      )}

      {(showCompany && mail.company_id) || unreplied ? (
        <div className="px-3.5 pb-3 flex items-center gap-2 flex-wrap">
          {showCompany && mail.company_id && (
            <Link
              href={`/customers/${mail.company_id}?tab=mail`}
              className="text-[11px] font-bold px-2.5 py-1.5 truncate max-w-[60%]"
              style={{ color: C.purple, border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}
            >
              {mail.company_name ?? "会社"}
            </Link>
          )}
          {unreplied &&
            (taskState === "none" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setProblem(null);
                    const r = await mailToTask(mail.id);
                    if ("error" in r) setProblem(r.error);
                    else setTaskState(r.taskId ? "made" : "todo");
                  })
                }
                className="flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 disabled:opacity-60"
                style={{ color: "#fff", background: C.orange, borderRadius: "6px 12px 6px 12px" }}
              >
                <CheckSquare size={12} strokeWidth={3} />
                {pending ? "作っています…" : "タスクにする"}
              </button>
            ) : (
              <Link
                href="/tasks"
                className="text-[11px] font-bold px-2.5 py-1.5"
                style={{ color: C.orange, background: SOFT.orange, borderRadius: "6px 12px 6px 12px" }}
              >
                {taskState === "todo" ? "自分のTODOに入れました" : "タスクにしました"}
              </Link>
            ))}
          {problem && (
            <span className="text-[11px] font-bold w-full" style={{ color: C.red }} role="alert">
              {problem}
            </span>
          )}
        </div>
      ) : null}
    </article>
  );
}
