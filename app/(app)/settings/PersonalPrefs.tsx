"use client";

import { useState, useTransition } from "react";
import { C, SOFT } from "@/lib/design";
import { savePreferences } from "../profile/actions";

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;
const field = { borderRadius: "16px 8px 16px 8px", border: `2px solid ${C.line}` } as const;

/**
 * あなたの設定（SCREENS 11）：タスクの見せ方・差出人（AIメールの署名）・決まった会議URL。
 * どれも自分にだけ効く。
 */
export function PersonalPrefs({
  taskView,
  signature,
  meetingUrl,
  defaultSignature,
}: {
  taskView: "company" | "assignee";
  signature: string;
  meetingUrl: string;
  defaultSignature: string;
}) {
  const [view, setView] = useState(taskView);
  const [sig, setSig] = useState(signature);
  const [url, setUrl] = useState(meetingUrl);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "ng"; text: string } | null>(null);

  const save = (input: Parameters<typeof savePreferences>[0], done: string) =>
    start(async () => {
      setMessage(null);
      const r = await savePreferences(input);
      setMessage("error" in r ? { tone: "ng", text: r.error } : { tone: "ok", text: done });
    });

  return (
    <div className="bg-white p-4 space-y-5" style={card}>
      {/* ── タスクの見せ方 ── */}
      <div className="space-y-1.5">
        <Label>タスクの見せ方（タスク画面の「会社のタスク」）</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["company", "会社ごと"],
              ["assignee", "担当者ごと"],
            ] as const
          ).map(([key, label]) => {
            const on = view === key;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                aria-pressed={on}
                onClick={() => {
                  if (on) return;
                  setView(key);
                  save({ taskView: key }, `タスクを${label}に並べます。`);
                }}
                className="py-2.5 text-sm font-extrabold disabled:opacity-70"
                style={{
                  borderRadius: "14px 7px 14px 7px",
                  border: `2px solid ${on ? C.yellow : C.line}`,
                  background: on ? SOFT.yellow : "#fff",
                  color: on ? "#9A6B00" : "#6B6B6B",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 差出人（署名） ── */}
      <div className="space-y-1.5">
        <Label>差出人（AIメールの署名）</Label>
        <textarea
          value={sig}
          onChange={(e) => setSig(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={defaultSignature}
          className="w-full px-3.5 py-3 text-sm font-bold outline-none resize-none"
          style={field}
        />
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
            空のままなら、上の薄い字のものを使います。
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ signature: sig }, "署名を保存しました。")}
            className="text-xs font-extrabold px-3 py-2 shrink-0 disabled:opacity-60"
            style={{ color: "#fff", background: C.purple, borderRadius: "12px 6px 12px 6px" }}
          >
            保存
          </button>
        </div>
      </div>

      {/* ── 会議URL ── */}
      <div className="space-y-1.5">
        <Label>Zoom など、いつも使う会議のURL（日程調整で使います）</Label>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="https://zoom.us/j/…"
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-bold outline-none"
            style={field}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ meetingUrl: url }, "会議のURLを保存しました。")}
            className="text-xs font-extrabold px-3 py-2 shrink-0 disabled:opacity-60"
            style={{ color: "#fff", background: C.purple, borderRadius: "12px 6px 12px 6px" }}
          >
            保存
          </button>
        </div>
        <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          Zoom のリンクは Google からは作れないので、ここに決まったURLを入れておきます。Google Meet は自動で作ります。
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
          role="status"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
      {children}
    </span>
  );
}
