"use client";

import { useOptimistic, useTransition } from "react";
import { C, SOFT } from "@/lib/design";
import { setStage } from "../actions";

export type Stage = { id: string; name: string; position: number };

/**
 * 進捗バーとステージの選択（SCREENS 4「タスク」「チャンネル」）。
 *
 * 概要タブの編集フォームからでも変えられるが、
 * タスクとチャンネルでは「いまどこか」をその場で押して変えたい。
 * revalidatePath を待つと数秒かかるので、押した瞬間に見た目を進める。
 */
export function CompanyProgress({
  companyId,
  stages,
  stageId,
  openTasks,
  editable = true,
}: {
  companyId: string;
  stages: Stage[];
  stageId: string | null;
  openTasks: number;
  editable?: boolean;
}) {
  const [pending, start] = useTransition();
  const [current, move] = useOptimistic(stageId, (_: string | null, next: string | null) => next);

  const stage = stages.find((s) => s.id === current);
  const progress = stage && stages.length
    ? Math.round(((stage.position + 1) / stages.length) * 100)
    : 0;

  return (
    <div
      className="bg-white p-3.5"
      style={{ border: `2px solid ${C.line}`, borderRadius: "26px 13px 26px 13px" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-extrabold">{stage ? stage.name : "ステージなし"}</span>
        <div className="flex items-center gap-2">
          {openTasks > 0 && (
            <span
              className="text-[11px] font-bold px-2 py-0.5"
              style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "7px 3px 7px 3px" }}
            >
              未完了 {openTasks}件
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: C.purple }}>
            {progress}%
          </span>
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${progress}%`, background: C.purple, transition: "width .7s" }}
        />
      </div>

      <div className="flex gap-1 mt-2.5 overflow-x-auto no-bar">
        {stages.map((s) => {
          const passed = stage ? s.position <= stage.position : false;
          const here = s.id === current;
          const style = {
            color: passed ? C.purple : "#C8C2B6",
            background: here ? SOFT.purple : "transparent",
            border: `2px solid ${here ? C.purple : "transparent"}`,
            borderRadius: "9px 4px 9px 4px",
          };

          if (!editable) {
            return (
              <span key={s.id} className="text-[11px] font-bold px-2 py-1 shrink-0" style={style}>
                {s.name}
              </span>
            );
          }

          return (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              aria-pressed={here}
              aria-label={`${s.name}にする`}
              className="text-[11px] font-bold px-2 py-1 shrink-0 disabled:opacity-60"
              style={style}
              onClick={() =>
                start(() => {
                  move(s.id);
                  void setStage(companyId, s.id);
                })
              }
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {editable && (
        <p className="text-[11px] font-bold mt-2" style={{ color: "#C8C2B6" }}>
          押すと、いまの段階を変えられます。
        </p>
      )}
    </div>
  );
}
