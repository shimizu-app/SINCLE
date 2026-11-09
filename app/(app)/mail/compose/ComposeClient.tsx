"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Copy, ExternalLink, Send, Sparkles, Check } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { PURPOSES, REPLY_PURPOSE, REVISIONS, TONES } from "@/lib/mail-compose";
import { generateDraft, recordManualSend, reviseDraft, sendMail } from "./actions";
import type { Recipient } from "./context";

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;
const field = { borderRadius: "16px 8px 16px 8px", border: `2px solid ${C.line}` } as const;

export function ComposeClient(props: {
  companyId: string;
  contactId: string | null;
  replyId: string | null;
  replySubject: string | null;
  recipients: Recipient[];
  slots: string[];
  slotLabels: string[];
  durationMin: number;
  bookingUrl: string | null;
  aiReady: boolean;
  canSend: boolean;
  fromAddress: string | null;
}) {
  const router = useRouter();
  const reply = Boolean(props.replyId);
  const firstTo =
    props.recipients.find((r) => r.contactId === props.contactId) ?? props.recipients[0] ?? null;

  const [to, setTo] = useState(firstTo?.address ?? "");
  const [purpose, setPurpose] = useState<string>(reply ? REPLY_PURPOSE : props.slots.length || props.bookingUrl ? "面談予約" : PURPOSES[0]);
  const [tone, setTone] = useState<string>(TONES[1]);
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState(reply && props.replySubject ? `Re: ${props.replySubject.replace(/^(re:\s*)+/i, "")}` : "");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "ng"; text: string; reconnect?: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const contactId = props.recipients.find((r) => r.address === to)?.contactId ?? null;
  const hasDraft = Boolean(subject.trim() || body.trim());

  const run = (label: string, fn: () => Promise<void>) =>
    start(async () => {
      setBusy(label);
      setMessage(null);
      await fn();
      setBusy(null);
    });

  const generate = () =>
    run("generate", async () => {
      const r = await generateDraft({
        companyId: props.companyId,
        contactId,
        replyId: props.replyId,
        purpose,
        tone,
        notes,
        slots: props.slots,
        durationMin: props.durationMin,
        bookingUrl: props.bookingUrl,
      });
      if ("error" in r) setMessage({ tone: "ng", text: r.error });
      else {
        setSubject(r.subject);
        setBody(r.body);
      }
    });

  const revise = (instruction: string) =>
    run(instruction, async () => {
      const r = await reviseDraft({ subject, body, instruction });
      if ("error" in r) setMessage({ tone: "ng", text: r.error });
      else {
        setSubject(r.subject);
        setBody(r.body);
      }
    });

  const payload = () => ({ subject, body, to, companyId: props.companyId, contactId, replyId: props.replyId });

  const send = () => {
    if (!window.confirm(`${to} に送ります。よろしいですか？`)) return;
    run("send", async () => {
      const r = await sendMail(payload());
      if ("error" in r) setMessage({ tone: "ng", text: r.error, reconnect: r.reconnect });
      else {
        setDone(true);
        setMessage({ tone: "ok", text: "送りました。メール履歴とチャンネルに残しました。" });
      }
    });
  };

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (done) {
    return (
      <div className="bg-white p-5 space-y-3 text-center" style={card} role="status">
        <div className="text-lg font-extrabold" style={{ color: C.green }}>
          送りました
        </div>
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
          メール履歴・会社のタイムライン・会社チャンネルに残しました。
        </p>
        <OrganicButton type="button" size="md" variant="outline" color="purple" onClick={() => router.push(`/customers/${props.companyId}?tab=mail`)}>
          会社のメールを見る
        </OrganicButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. 宛先 ── */}
      <Step n={1} title="宛先">
        {props.recipients.length ? (
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-white px-3 py-2.5 text-sm font-bold outline-none"
            style={field}
          >
            {props.recipients.map((r) => (
              <option key={r.address} value={r.address}>
                {r.name ? `${r.name} <${r.address}>` : r.address}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            inputMode="email"
            placeholder="メールアドレス（名刺にアドレスがありません）"
            className="w-full bg-white px-3 py-2.5 text-sm font-bold outline-none"
            style={field}
          />
        )}
      </Step>

      {/* ── 2. 用件 ── */}
      <Step n={2} title="用件">
        <Chips items={reply ? [REPLY_PURPOSE, ...PURPOSES] : [...PURPOSES]} value={purpose} onPick={setPurpose} />
      </Step>

      {/* ── 3. トーン ── */}
      <Step n={3} title="トーン">
        <Chips items={[...TONES]} value={tone} onPick={setTone} />
      </Step>

      {/* ── 4. 盛り込みたいこと ── */}
      <Step n={4} title="盛り込みたいこと">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="例：資料は来週お送りすること、先日のご質問への回答"
          className="w-full bg-white px-3.5 py-3 text-sm font-bold outline-none resize-none"
          style={field}
        />
        {props.slots.length > 0 && (
          <div className="text-[11px] font-bold leading-relaxed p-2.5" style={{ background: SOFT.green, color: C.green, borderRadius: "12px 6px 12px 6px" }}>
            日程の候補を本文に入れます：
            {props.slotLabels.map((l) => (
              <div key={l}>・{l}</div>
            ))}
          </div>
        )}
        {props.bookingUrl && (
          <div className="text-[11px] font-bold leading-relaxed p-2.5 break-all" style={{ background: SOFT.purple, color: C.purple, borderRadius: "12px 6px 12px 6px" }}>
            予約ページを本文に入れます：{props.bookingUrl}
          </div>
        )}
        <Link
          href={`/schedule?company=${props.companyId}${contactId ? `&contact=${contactId}` : ""}`}
          className="inline-flex items-center gap-1 text-xs font-extrabold"
          style={{ color: C.green }}
        >
          <CalendarDays size={13} strokeWidth={2.8} />
          カレンダーから空き日程を入れる
        </Link>
      </Step>

      {/* ── 5. 生成 ── */}
      {props.aiReady ? (
        <OrganicButton type="button" size="lg" color="purple" className="w-full" disabled={pending} onClick={generate}>
          <Sparkles size={16} strokeWidth={2.8} />
          {busy === "generate" ? "AIが書いています…" : hasDraft ? "AIで書き直す" : "AIで下書きする"}
        </OrganicButton>
      ) : (
        <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: C.orange }}>
          AIの設定（ANTHROPIC_API_KEY）がまだなので、AIの下書きは使えません。下で手で書いて送れます。
        </p>
      )}

      {/* ── 下書き ── */}
      <div className="bg-white p-4 space-y-2.5" style={card}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold" style={{ color: "#8A8A8A" }}>
            下書き（送る前に必ず読んでください）
          </span>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="件名"
          className="w-full px-3.5 py-2.5 text-sm font-extrabold outline-none"
          style={field}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="本文"
          className="w-full px-3.5 py-3 text-[13px] leading-relaxed font-bold outline-none"
          style={field}
        />
        {props.aiReady && hasDraft && (
          <div className="flex flex-wrap gap-1.5">
            {REVISIONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={pending}
                onClick={() => revise(r)}
                className="text-[11px] font-extrabold px-2.5 py-1.5 disabled:opacity-60"
                style={{ color: C.purple, background: SOFT.purple, borderRadius: "10px 5px 10px 5px" }}
              >
                {busy === r ? "直しています…" : r}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          AIには金額・納期・実績を書かせていません。必要なら手で書き足してください。
        </p>
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
              Gmail をつなぎ直す
            </a>
          )}
        </p>
      )}

      {/* ── 送る ── */}
      <div className="space-y-2">
        {props.canSend ? (
          <>
          <OrganicButton type="button" size="lg" color="blue" className="w-full" disabled={pending || !hasDraft} onClick={send}>
            <Send size={16} strokeWidth={2.8} />
            {busy === "send" ? "送っています…" : "Gmail で送る"}
          </OrganicButton>
          {props.fromAddress && (
            <p className="text-[11px] font-bold text-center" style={{ color: "#9AA0A6" }}>
              差出人：{props.fromAddress}
            </p>
          )}
          </>
        ) : (
          <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: "#9AA0A6" }}>
            Gmail をつなぐと、ここから送れます。
            <a href="/api/google/connect?with=gmail" className="underline ml-1" style={{ color: C.blue }}>
              Gmail をつなぐ
            </a>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={hasDraft ? mailto : undefined}
            aria-disabled={!hasDraft}
            className="flex items-center justify-center gap-1 text-xs font-extrabold py-2.5 bg-white"
            style={{ ...field, color: hasDraft ? "#6B6B6B" : "#C8C2B6" }}
          >
            <ExternalLink size={13} strokeWidth={2.8} />
            メールアプリで開く
          </a>
          <button
            type="button"
            disabled={!hasDraft}
            onClick={() => void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => setMessage({ tone: "ok", text: "件名と本文をコピーしました。" }))}
            className="flex items-center justify-center gap-1 text-xs font-extrabold py-2.5 bg-white disabled:opacity-50"
            style={{ ...field, color: "#6B6B6B" }}
          >
            <Copy size={13} strokeWidth={2.8} />
            コピー
          </button>
        </div>
        {hasDraft && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("record", async () => {
                const r = await recordManualSend(payload());
                if ("error" in r) setMessage({ tone: "ng", text: r.error });
                else {
                  setDone(true);
                }
              })
            }
            className="w-full flex items-center justify-center gap-1 text-[11px] font-bold py-2"
            style={{ color: "#9AA0A6" }}
          >
            <Check size={12} strokeWidth={3} />
            メールアプリで送ったので、履歴に残す
          </button>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <span
          className="w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center text-white"
          style={{ background: C.purple }}
        >
          {n}
        </span>
        <span className="text-xs font-extrabold" style={{ color: "#6B6B6B" }}>
          {title}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const on = item === value;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            aria-pressed={on}
            className="text-xs font-extrabold px-3 py-1.5"
            style={{
              background: on ? C.ink : "#fff",
              color: on ? "#fff" : "#6B6B6B",
              border: `2px solid ${on ? C.ink : C.line}`,
              borderRadius: "12px 6px 12px 6px",
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
