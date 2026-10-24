"use client";

import { useActionState, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { addStage, moveStage, removeStage, renameStage, type StageResult } from "./actions";

export type StageRow = { id: string; name: string; position: number };

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

/**
 * 商談の進み具合（SCREENS 11）。
 *
 * 「いまの流れ」を矢印でつないで見せたうえで、その下で編集する。
 * 何を設定しているのかが分かるように、並びと編集を同じ場所に置く。
 */
export function StageAdmin({ stages, isAdmin }: { stages: StageRow[]; isAdmin: boolean }) {
  const [state, action, pending] = useActionState<StageResult, FormData>(addStage, undefined);
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // サーバーからの返事は { error } か undefined。拾って1か所に出す。
  const run = (fn: () => Promise<{ error: string } | void>) =>
    start(async () => {
      const result = await fn();
      setProblem(result && "error" in result ? result.error : null);
    });

  return (
    <div className="space-y-3">
      {/* ── いまの流れ ── */}
      <div className="bg-white p-4" style={{ ...field, borderRadius: "13px 26px 13px 26px" }}>
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1">
              <span
                className="text-xs font-bold px-2.5 py-1.5"
                style={{ background: SOFT.blue, color: C.blue, borderRadius: "10px 5px 10px 5px" }}
              >
                {s.name}
              </span>
              {i < stages.length - 1 && (
                <ChevronRight size={13} strokeWidth={3} style={{ color: "#C8C2B6" }} />
              )}
            </span>
          ))}
        </div>
      </div>

      {!isAdmin && (
        <p className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
          段階を変えられるのは管理者だけです。
        </p>
      )}

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-bold px-3 py-2"
            style={{
              color: open ? C.blue : "#9AA0A6",
              background: "#fff",
              border: `2px solid ${open ? C.blue : C.line}`,
              borderRadius: "14px 7px 14px 7px",
            }}
          >
            {open ? "編集をやめる" : "段階を編集する"}
          </button>

          {open && (
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div
                  key={s.id}
                  className="bg-white p-3 flex items-center gap-2"
                  style={{
                    border: `2px solid ${C.line}`,
                    borderRadius: i % 2 ? "22px 11px 22px 11px" : "11px 22px 11px 22px",
                  }}
                >
                  {editing === s.id ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                        maxLength={20}
                        className="flex-1 min-w-0 px-3 py-2 text-sm bg-white outline-none"
                        style={field}
                      />
                      <OrganicButton
                        type="button"
                        size="sm"
                        color="blue"
                        onClick={() => {
                          const name = draft;
                          setEditing(null);
                          run(() => renameStage(s.id, name));
                        }}
                      >
                        直す
                      </OrganicButton>
                      <button
                        type="button"
                        aria-label="やめる"
                        onClick={() => setEditing(null)}
                        className="w-8 h-8 flex items-center justify-center shrink-0"
                      >
                        <X size={15} strokeWidth={3} style={{ color: "#C8C2B6" }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="text-[11px] font-bold w-5 shrink-0 text-center"
                        style={{ color: "#C8C2B6" }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-extrabold truncate">
                        {s.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`${s.name}を上へ`}
                        disabled={i === 0}
                        onClick={() => run(() => moveStage(s.id, "up"))}
                        className="w-8 h-8 flex items-center justify-center shrink-0 disabled:opacity-25"
                      >
                        <ChevronUp size={16} strokeWidth={3} style={{ color: C.blue }} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${s.name}を下へ`}
                        disabled={i === stages.length - 1}
                        onClick={() => run(() => moveStage(s.id, "down"))}
                        className="w-8 h-8 flex items-center justify-center shrink-0 disabled:opacity-25"
                      >
                        <ChevronDown size={16} strokeWidth={3} style={{ color: C.blue }} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${s.name}の名前を変える`}
                        onClick={() => {
                          setEditing(s.id);
                          setDraft(s.name);
                        }}
                        className="w-8 h-8 flex items-center justify-center shrink-0"
                      >
                        <Pencil size={14} strokeWidth={2.5} style={{ color: "#9AA0A6" }} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${s.name}を消す`}
                        onClick={() => run(() => removeStage(s.id))}
                        className="w-8 h-8 flex items-center justify-center shrink-0"
                      >
                        <Trash2 size={14} strokeWidth={2.5} style={{ color: C.red }} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              <form action={action} className="flex gap-2">
                <input
                  name="name"
                  maxLength={20}
                  placeholder="段階を足す（例：社内稟議）"
                  className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-white outline-none"
                  style={field}
                />
                <OrganicButton type="submit" size="md" color="blue" disabled={pending}>
                  <Plus size={15} strokeWidth={3} />
                  足す
                </OrganicButton>
              </form>

              <p className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
                段階を消しても会社は残ります。その会社の段階だけが未設定に戻ります。
              </p>
            </div>
          )}
        </>
      )}

      {(problem || (state && "error" in state)) && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }}>
          {problem ?? (state && "error" in state ? state.error : null)}
        </p>
      )}
      {state && "ok" in state && (
        <p className="text-xs font-bold px-1" style={{ color: C.green }}>
          {state.ok}
        </p>
      )}
    </div>
  );
}
