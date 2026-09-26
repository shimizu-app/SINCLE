"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { C, SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import { MemberDot, ShapeIcon } from "@/components/ui";
import { logActivity } from "../deal-actions";
import type { Avatar } from "@/types/db";

export type TimelineItem = {
  kind: "mail" | "meeting" | "task" | "talk" | "system";
  id: string;
  title: string | null;
  body: string | null;
  at: string;
  done: boolean | null;
  direction: string | null;
  author_name: string | null;
  author_avatar: Avatar | null;
};

const FILTERS = [
  ["all", "すべて"],
  ["mail", "メール"],
  ["meeting", "打合せ"],
  ["task", "タスク"],
  ["talk", "会話"],
] as const;

const LOOK: Record<TimelineItem["kind"], { shape: ShapeKey; color: ColorKey; label: string }> = {
  mail: { shape: "square", color: "blue", label: "メール" },
  meeting: { shape: "drop", color: "purple", label: "打合せ" },
  task: { shape: "sun", color: "yellow", label: "タスク" },
  talk: { shape: "cloud", color: "pink", label: "会話" },
  system: { shape: "clover", color: "green", label: "記録" },
};

/** SCREENS 4「記録の入力欄を上部に置く。これが入力を促す最大の仕掛け」 */
export function Timeline({
  companyId,
  items,
  filter,
  hasMore,
  myName,
  myAvatar,
}: {
  companyId: string;
  items: TimelineItem[];
  filter: string;
  hasMore: boolean;
  myName: string;
  myAvatar: Avatar | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [, start] = useTransition();

  const [shown, addShown] = useOptimistic(items, (state, item: TimelineItem) => [item, ...state]);

  function send() {
    const value = text.trim();
    if (!value) return;
    setText("");
    start(() => {
      addShown({
        kind: "talk",
        id: `temp-${Date.now()}`,
        title: null,
        body: value,
        at: new Date().toISOString(),
        done: null,
        direction: null,
        author_name: myName,
        author_avatar: myAvatar,
      });
      void logActivity(companyId, value);
    });
  }

  function setFilter(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "timeline");
    if (value === "all") next.delete("f");
    else next.set("f", value);
    next.delete("n");
    router.replace(`/customers/${companyId}?${next}`, { scroll: false });
  }

  function more() {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "timeline");
    next.set("n", String(items.length + 30));
    router.replace(`/customers/${companyId}?${next}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      {/* ── 記録の入力欄 ── */}
      <div
        className="bg-white p-3 space-y-2"
        style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.green}` }}
      >
        <div className="flex items-center gap-2">
          <ShapeIcon shape="clover" color="green" size={24} />
          <span className="text-xs font-extrabold">やったことを残す</span>
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="電話した / 訪問した / 資料を送った"
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm outline-none"
            style={{ borderRadius: "18px 9px 18px 9px", border: `2px solid ${C.line}` }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="残す"
            className="w-10 shrink-0 flex items-center justify-center disabled:opacity-30"
            style={{ background: C.green, borderRadius: "12px 6px 12px 6px" }}
          >
            <Send size={15} strokeWidth={2.5} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] font-bold px-1" style={{ color: "#9AA0A6" }}>
          チャンネルにも流れます。書くと案件の「最終更新」が今になります。
        </p>
      </div>

      {/* ── フィルタ ── */}
      <div className="flex gap-1.5 overflow-x-auto no-bar">
        {FILTERS.map(([key, label]) => {
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-bold px-3 py-1.5 shrink-0 ${on ? "anim-chip" : ""}`}
              style={{
                background: on ? SOFT.purple : "#fff",
                color: on ? C.purple : "#9AA0A6",
                border: `2px solid ${on ? C.purple : C.line}`,
                borderRadius: "14px 7px 14px 7px",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── 縦の時系列 ── */}
      {shown.length === 0 ? (
        <p className="text-xs font-bold px-1 py-6" style={{ color: "#C8C2B6" }}>
          まだ記録がありません。上の欄に1行書くところから始められます。
        </p>
      ) : (
        <div className="space-y-0">
          {shown.map((item, i) => {
            const look = LOOK[item.kind];
            const d = new Date(item.at);
            return (
              <div key={`${item.kind}-${item.id}`} className="flex gap-3 relative anim-item"
                   style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                {/* 縦線 */}
                <div className="flex flex-col items-center shrink-0">
                  <ShapeIcon shape={look.shape} color={look.color} size={26} />
                  {i < shown.length - 1 && (
                    <span className="flex-1 w-0.5 my-1" style={{ background: C.line }} />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold" style={{ color: C[look.color] }}>
                      {look.label}
                      {item.kind === "mail" && item.direction === "in" && "（受信）"}
                      {item.kind === "mail" && item.direction === "out" && "（送信）"}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "#C8C2B6" }}>
                      {d.getMonth() + 1}/{d.getDate()}{" "}
                      {String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}
                    </span>
                    {item.done && (
                      <span className="text-[10px] font-bold" style={{ color: C.green }}>
                        済み
                      </span>
                    )}
                  </div>

                  {item.title && (
                    <div className="text-sm font-bold mt-0.5 break-words">{item.title}</div>
                  )}
                  {item.body && (
                    <div
                      className="text-xs font-bold mt-0.5 break-words whitespace-pre-wrap"
                      style={{ color: item.title ? "#9AA0A6" : C.ink }}
                    >
                      {item.body}
                    </div>
                  )}
                  {item.author_name && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <MemberDot name={item.author_name} avatar={item.author_avatar} size={18} />
                      <span className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
                        {item.author_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={more}
          className="w-full text-xs font-bold py-3"
          style={{ background: "#fff", color: C.purple, border: `2px solid ${C.line}`, borderRadius: "22px 11px 22px 11px" }}
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
