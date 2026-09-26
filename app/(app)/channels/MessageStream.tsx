"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { MemberDot, ShapeIcon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { markChannelRead, markDmRead, postDm, postMessage } from "./actions";
import type { Avatar } from "@/types/db";

export type StreamMessage = {
  id: string;
  text: string;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar: Avatar | null;
  is_system: boolean;
};

type Props = {
  kind: "channel" | "dm";
  /** channel_id か thread_id */
  targetId: string;
  initial: StreamMessage[];
  myMemberId: string;
  /** author_id → 表示名・アバター（Realtime で届く行には名前が入らないため） */
  people: Record<string, { name: string; avatar: Avatar | null }>;
  placeholder?: string;
};

/**
 * 会話の本体。
 * Realtime で他の人の発言を拾い、自分の発言はその場で足す。
 * RLS はそのまま効くので、読めない行は届かない。
 */
export function MessageStream({
  kind, targetId, initial, myMemberId, people, placeholder,
}: Props) {
  const [messages, setMessages] = useState<StreamMessage[]>(initial);
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  // 開いたら既読にする
  useEffect(() => {
    start(() => void (kind === "dm" ? markDmRead(targetId) : markChannelRead(targetId)));
  }, [kind, targetId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const table = kind === "dm" ? "dm_messages" : "messages";
    const column = kind === "dm" ? "thread_id" : "channel_id";

    const channel = supabase
      .channel(`${table}:${targetId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${column}=eq.${targetId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            text: string;
            created_at: string;
            author_id: string | null;
            is_system?: boolean;
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const who = row.author_id ? people[row.author_id] : undefined;
            return [
              ...prev,
              {
                id: row.id,
                text: row.text,
                created_at: row.created_at,
                author_id: row.author_id,
                author_name: who?.name ?? null,
                author_avatar: who?.avatar ?? null,
                is_system: Boolean(row.is_system),
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kind, targetId, people]);

  function send() {
    const value = text.trim();
    if (!value) return;
    setText("");

    // 送った実感を先に出す。Realtime で本物が来たら id で重複を弾く。
    const temp: StreamMessage = {
      id: `temp-${Date.now()}`,
      text: value,
      created_at: new Date().toISOString(),
      author_id: myMemberId,
      author_name: people[myMemberId]?.name ?? null,
      author_avatar: people[myMemberId]?.avatar ?? null,
      is_system: false,
    };
    setMessages((prev) => [...prev, temp]);

    start(() => {
      void (kind === "dm" ? postDm(targetId, value) : postMessage(targetId, value));
    });
  }

  return (
    <>
      <div className="px-4 py-4 space-y-3 pb-40">
        {messages.length === 0 && (
          <p className="text-xs font-bold text-center py-8" style={{ color: "#C8C2B6" }}>
            まだ何もありません。最初のひとことをどうぞ。
          </p>
        )}

        {messages.map((m) => {
          if (m.is_system) {
            return (
              <div key={m.id} className="flex justify-center">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 max-w-[85%]"
                  style={{ background: SOFT.lime, color: "#4A7A3A", borderRadius: "999px" }}
                >
                  <ShapeIcon shape="clover" color="green" size={14} />
                  <span className="break-words">{m.text}</span>
                </span>
              </div>
            );
          }

          const mine = m.author_id === myMemberId;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && (
                <MemberDot name={m.author_name ?? "?"} avatar={m.author_avatar} size={30} />
              )}
              <div className={`max-w-[75%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {!mine && m.author_name && (
                  <span className="text-[10px] font-bold px-1" style={{ color: "#9AA0A6" }}>
                    {m.author_name}
                  </span>
                )}
                <div
                  className="px-3.5 py-2.5 text-sm font-bold break-words whitespace-pre-wrap"
                  style={{
                    background: mine ? C.purple : "#fff",
                    color: mine ? "#fff" : C.ink,
                    border: mine ? "none" : `2px solid ${C.line}`,
                    borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                  }}
                >
                  {m.text}
                </div>
                <span className="text-[10px] font-bold px-1" style={{ color: "#C8C2B6" }}>
                  {new Date(m.created_at).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* ── 入力欄 ── */}
      <div
        className="fixed left-0 right-0 z-10 px-4 py-3 bg-white"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)", borderTop: `2px solid ${C.line}` }}
      >
        <div className="flex gap-2 items-end max-w-screen-sm mx-auto">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={placeholder ?? "メッセージ"}
            className="flex-1 min-w-0 px-4 py-2.5 text-sm outline-none resize-none max-h-28"
            style={{ borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="送る"
            className="w-11 h-11 shrink-0 flex items-center justify-center disabled:opacity-30"
            style={{ background: C.purple, borderRadius: "14px 7px 14px 7px" }}
          >
            <Send size={17} strokeWidth={2.5} className="text-white" />
          </button>
        </div>
      </div>
    </>
  );
}
