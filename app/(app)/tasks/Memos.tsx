"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { Pin, Plus, Trash2 } from "lucide-react";
import { C, SOFT, type ColorKey } from "@/lib/design";
import { OrganicButton, Sheet } from "@/components/ui";
import { deleteMemo, memoToTask, pinMemo, saveMemo, type ActionResult } from "./actions";

export type MemoRow = {
  id: string;
  text: string;
  color: string;
  pinned: boolean;
  updated_at: string;
};

/** SCREENS 7-3：6色から選べる */
const COLORS: ColorKey[] = ["yellow", "pink", "blue", "green", "orange", "purple"];

export function Memos({ memos }: { memos: MemoRow[] }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<ColorKey>("yellow");
  const [, start] = useTransition();

  // revalidatePath の引き直しを待つと数秒かかる。書いた瞬間に出す。
  const [shown, apply] = useOptimistic(
    memos,
    (state, change: { add?: MemoRow; remove?: string; pin?: string }) => {
      if (change.add) return [change.add, ...state];
      if (change.remove) return state.filter((m) => m.id !== change.remove);
      if (change.pin) {
        return state.map((m) => (m.id === change.pin ? { ...m, pinned: !m.pinned } : m));
      }
      return state;
    }
  );

  const [state, action, pending] = useActionState<ActionResult, FormData>(
    (_prev, form) => {
      apply({
        add: {
          id: `temp-${Date.now()}`,
          text: String(form.get("text") ?? ""),
          color: String(form.get("color") ?? "yellow"),
          pinned: false,
          updated_at: new Date().toISOString(),
        },
      });
      return saveMemo(_prev, form);
    },
    undefined
  );

  useEffect(() => {
    if (state && "ok" in state) setOpen(false);
  }, [state]);

  const sorted = [...shown].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-xs font-bold px-1 py-4" style={{ color: "#C8C2B6" }}>
          メモはまだありません。思いついたことを書いておくと、あとでタスクにできます。
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {sorted.map((memo, i) => (
          <div
            key={memo.id}
            className="p-3 flex flex-col gap-2 anim-item"
            style={{
              background: SOFT[memo.color as keyof typeof SOFT] ?? SOFT.yellow,
              borderRadius: i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
              border: `2px solid ${memo.pinned ? C.orange : C.line}`,
              animationDelay: `${Math.min(i, 10) * 40}ms`,
            }}
          >
            <p className="text-xs font-bold leading-relaxed break-words whitespace-pre-wrap flex-1">
              {memo.text}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={memo.pinned ? "固定を外す" : "固定する"}
                onClick={() =>
                  start(() => {
                    apply({ pin: memo.id });
                    void pinMemo(memo.id, !memo.pinned);
                  })
                }
              >
                <Pin
                  size={13}
                  strokeWidth={2.5}
                  style={{ color: memo.pinned ? C.orange : "#C8C2B6" }}
                  fill={memo.pinned ? C.orange : "none"}
                />
              </button>
              <button
                type="button"
                onClick={() =>
                  start(() => {
                    apply({ remove: memo.id });
                    void memoToTask(memo.id);
                  })
                }
                className="text-[10px] font-bold"
                style={{ color: C.purple }}
              >
                タスクにする
              </button>
              <span className="flex-1" />
              <button
                type="button"
                aria-label="削除"
                onClick={() =>
                  start(() => {
                    apply({ remove: memo.id });
                    void deleteMemo(memo.id);
                  })
                }
              >
                <Trash2 size={13} strokeWidth={2.5} style={{ color: "#C8C2B6" }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <OrganicButton
        type="button"
        size="lg"
        color="pink"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} strokeWidth={3} />
        メモを書く
      </OrganicButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="メモ" subtitle="あとでタスクにできます">
        <form action={action} className="space-y-3">
          <input type="hidden" name="color" value={color} />
          <textarea
            name="text"
            rows={4}
            required
            autoFocus
            placeholder="思いついたこと"
            className="w-full px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: SOFT[color as keyof typeof SOFT],
              borderRadius: "22px 11px 22px 11px",
              border: `2px solid ${C.line}`,
            }}
          />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="w-8 h-8"
                style={{
                  background: SOFT[c as keyof typeof SOFT],
                  border: `2.5px solid ${color === c ? C[c] : C.line}`,
                  borderRadius: "10px 5px 10px 5px",
                }}
              />
            ))}
          </div>
          {state && "error" in state && state.error && (
            <p className="text-xs font-bold" style={{ color: C.red }}>
              {state.error}
            </p>
          )}
          <OrganicButton type="submit" size="lg" color="pink" className="w-full" disabled={pending}>
            {pending ? "保存しています…" : "書きとめる"}
          </OrganicButton>
        </form>
      </Sheet>
    </div>
  );
}
