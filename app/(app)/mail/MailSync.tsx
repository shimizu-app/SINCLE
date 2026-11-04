"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { syncGmailNow } from "./actions";

/** これより前に取り込んだきりなら、開いたときに取りに行く */
const STALE_MS = 10 * 60_000;

export type SyncSummary = {
  imported: number;
  updated: number;
  ads: number;
  skipped: number;
  capped: boolean;
};

/** 上部の常時表示（SCREENS 9「登録した相手のメールだけ表示中」） */
const HEADLINE: Record<string, string> = {
  登録した相手だけ: "登録した相手のメールだけ表示中",
  会社のドメインまで: "名刺の会社のドメインまで表示中",
  受信箱すべて: "受信箱のメールを表示中（広告・お知らせは除く）",
};

const when = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * メール画面の上の帯（SCREENS 9「上部に取り込み範囲を常時表示」）。
 * 範囲・対象の人数・前回の結果と、「新しいメールを取り込む」。
 */
export function MailSync({
  scopeLabel,
  watched,
  optedOut,
  email,
  lastSyncAt,
  last,
}: {
  scopeLabel: string;
  watched: number;
  optedOut: number;
  email: string | null;
  lastSyncAt: string | null;
  last: SyncSummary | null;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "ng"; text: string; reconnect?: boolean } | null>(null);
  const ran = useRef(false);

  const run = () =>
    start(async () => {
      setMessage(null);
      const r = await syncGmailNow();
      if ("error" in r) {
        setMessage({ tone: "ng", text: r.error, reconnect: r.reconnect });
        return;
      }
      const { imported, updated, capped } = r.stats;
      const parts = [
        imported ? `${imported}件を取り込みました` : "新しいメールはありませんでした",
        updated ? `${updated}件が返信済みになりました` : "",
        capped ? "まだ残りがあります。もう一度押すと続きを取り込みます" : "",
      ].filter(Boolean);
      setMessage({ tone: "ok", text: parts.join("。") + "。" });
    });

  // 開いたとき、しばらく取り込んでいなければ取りに行く
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // 前回が上限で打ち切りなら、続きをすぐ読む
    const stale = !lastSyncAt || last?.capped || Date.now() - new Date(lastSyncAt).getTime() > STALE_MS;
    if (stale) run();
    // 最初の1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="bg-white p-3.5 space-y-2.5"
      style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold">{HEADLINE[scopeLabel] ?? `${scopeLabel}のメールを表示中`}</div>
          <div className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
            対象 {watched}人
            {optedOut > 0 && `・取り込まない相手 ${optedOut}人`}
            {last && last.ads + last.skipped > 0 && `・前回 ${last.ads + last.skipped}件は対象外（広告・社内どうしなど）`}
          </div>
        </div>
        <Link
          href="/settings#gmail"
          className="text-[11px] font-bold px-2.5 py-1.5 shrink-0"
          style={{ color: "#9AA0A6", border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}
        >
          範囲を変える
        </Link>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="w-full flex items-center justify-center gap-1.5 text-sm font-extrabold py-2.5 disabled:opacity-70"
        style={{ color: C.blue, background: SOFT.blue, borderRadius: "14px 7px 14px 7px" }}
      >
        <RefreshCw size={14} strokeWidth={3} className={pending ? "animate-spin" : ""} />
        {pending ? "Gmail から取り込んでいます…" : "新しいメールを取り込む"}
      </button>

      <div className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
        {email && `${email} ・ `}
        {lastSyncAt ? `前回の取り込み ${when.format(new Date(lastSyncAt))}` : "まだ一度も取り込んでいません"}
      </div>

      {message && (
        <p
          className="text-xs font-bold px-3 py-2.5"
          style={{
            background: message.tone === "ok" ? SOFT.green : SOFT.red,
            color: message.tone === "ok" ? C.green : C.red,
            borderRadius: "14px 7px 14px 7px",
          }}
          role={message.tone === "ok" ? "status" : "alert"}
        >
          {message.text}
          {message.reconnect && (
            <a href="/api/google/connect?with=gmail" className="underline ml-1">
              つなぎ直す
            </a>
          )}
        </p>
      )}

      {watched === 0 && scopeLabel !== "受信箱すべて" && (
        <p className="text-[11px] font-bold leading-relaxed" style={{ color: C.orange }}>
          メールアドレスのある名刺がまだありません。名刺を登録すると、その人とのやりとりが入ります。
        </p>
      )}
    </div>
  );
}
