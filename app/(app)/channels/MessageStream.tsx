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
  /** 読むだけ（「全員の名刺を見る」で人の会社のチャンネルを見ているとき）。入力欄を出さない */
  readOnly?: boolean;
};

/**
 * 会話の本体。
 * Realtime で他の人の発言を拾い、自分の発言はその場で足す。
 * RLS はそのまま効くので、読めない行は届かない。
 *
 * 自分の発言は、送った瞬間に仮の吹き出し（temp-…）を出し、本物が届いたら置き換える。
 * 本物は「送信の返事」と「Realtime」の2通りで届き、どちらが先かは決まっていない。
 * どちらで届いても1つにまとめる（前は仮のものが残って、自分の画面に2回出ていた）。
 */
export function MessageStream({
  kind, targetId, initial, myMemberId, people, placeholder, readOnly = false,
}: Props) {
  const [messages, setMessages] = useState<StreamMessage[]>(initial);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // Enter で送るのは、キーボードのある端末だけ。スマホの Enter は改行（変換の確定で誤って送らないように）
  const [enterSends, setEnterSends] = useState(false);
  const [, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  // 同じ文の二重送信を止める（連打・変換確定の Enter）
  const lastSent = useRef<{ text: string; at: number } | null>(null);
  // 名前の対応表は描画のたびに作り直されるので、購読し直さないよう ref で持つ
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    setEnterSends(window.matchMedia("(pointer: fine)").matches);
  }, []);

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
            const who = row.author_id ? peopleRef.current[row.author_id] : undefined;
            const real: StreamMessage = {
              id: row.id,
              text: row.text,
              created_at: row.created_at,
              author_id: row.author_id,
              author_name: who?.name ?? null,
              author_avatar: who?.avatar ?? null,
              is_system: Boolean(row.is_system),
            };
            // 自分の発言なら、同じ文の仮の吹き出しを本物に置き換える
            if (row.author_id === myMemberId && !row.is_system) {
              const at = prev.findIndex((m) => m.id.startsWith("temp-") && m.text === row.text);
              if (at >= 0) return prev.map((m, i) => (i === at ? real : m));
            }
            return [...prev, real];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kind, targetId, myMemberId]);

  function send() {
    const value = text.trim();
    if (!value) return;

    // 同じ文を2秒以内にもう一度は送らない（連打・変換確定の Enter）
    const now = Date.now();
    if (lastSent.current && lastSent.current.text === value && now - lastSent.current.at < 2000) {
      setText("");
      return;
    }
    lastSent.current = { text: value, at: now };

    setText("");
    setProblem(null);

    // 送った実感を先に出す。本物が届いたら置き換える
    const tempId = `temp-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const temp: StreamMessage = {
      id: tempId,
      text: value,
      created_at: new Date(now).toISOString(),
      author_id: myMemberId,
      author_name: peopleRef.current[myMemberId]?.name ?? null,
      author_avatar: peopleRef.current[myMemberId]?.avatar ?? null,
      is_system: false,
    };
    setMessages((prev) => [...prev, temp]);

    start(async () => {
      let r: Awaited<ReturnType<typeof postMessage>>;
      try {
        r = await (kind === "dm" ? postDm(targetId, value) : postMessage(targetId, value));
      } catch {
        // 圏外など、届かなかった
        r = { error: "送れませんでした。" };
      }
      if ("error" in r) {
        // 送れなかった。仮の吹き出しを消して、文は入力欄に戻す
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setText((now) => now || value);
        setProblem("送れませんでした。もう一度お試しください。");
        lastSent.current = null;
        return;
      }
      setMessages((prev) => {
        // Realtime が先に本物を届けていれば、仮のものはもう置き換わっている
        if (prev.some((m) => m.id === r.id)) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) => (m.id === tempId ? { ...m, id: r.id, created_at: r.created_at } : m));
      });
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
      {readOnly ? (
        <p
          className="fixed left-0 right-0 z-10 px-4 py-3 bg-white text-[11px] font-bold text-center"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)", borderTop: `2px solid ${C.line}`, color: "#9AA0A6" }}
        >
          見るだけのチャンネルです（人が登録した会社）
        </p>
      ) : (
      <div
        className="fixed left-0 right-0 z-10 px-4 py-3 bg-white"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)", borderTop: `2px solid ${C.line}` }}
      >
        {problem && (
          <p className="text-[11px] font-bold text-center pb-2" style={{ color: C.red }} role="alert">
            {problem}
          </p>
        )}
        <div className="flex gap-2 items-end max-w-screen-sm mx-auto">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 日本語の変換中の Enter は「確定」。送信にしない（前はここで2回送られていた）
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (enterSends && e.key === "Enter" && !e.shiftKey) {
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
      )}
    </>
  );
}
