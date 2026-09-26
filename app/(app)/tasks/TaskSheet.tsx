"use client";

import { useActionState, useEffect, useState } from "react";
import { C, SOFT, TASK_SHARE, type ColorKey } from "@/lib/design";
import { OrganicButton, PriorityBadge, Sheet, ShapeIcon } from "@/components/ui";
import { saveTask, type ActionResult } from "./actions";
import type { Priority, TaskShare } from "@/types/db";

/** SCREENS 7-4：時刻はプリセット5種と「時間なし」 */
const TIMES = ["09:00", "10:00", "13:00", "15:00", "17:00"] as const;
const PRIORITIES: Priority[] = ["高", "中", "低"];
const SHARES: TaskShare[] = ["self", "assignee", "team"];

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

export type SheetCompany = { id: string; name: string };
export type SheetMember = { id: string; name: string };

export function TaskSheet({
  open,
  onClose,
  companies,
  members,
  myMemberId,
  defaultCompanyId,
}: {
  open: boolean;
  onClose: () => void;
  companies: SheetCompany[];
  members: SheetMember[];
  myMemberId: string;
  defaultCompanyId?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveTask, undefined);
  const [priority, setPriority] = useState<Priority>("中");
  const [share, setShare] = useState<TaskShare>("assignee");
  const [time, setTime] = useState<string>("");

  // 保存できたら閉じる
  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title="タスクを追加" subtitle="担当と期限を決めます">
      <form action={action} className="space-y-3">
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="share" value={share} />
        <input type="hidden" name="dueTime" value={time} />

        <input
          name="title"
          required
          autoFocus
          placeholder="何をしますか"
          className="w-full px-4 py-3 text-base bg-white outline-none"
          style={field}
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            name="companyId"
            defaultValue={defaultCompanyId ?? ""}
            className="w-full px-3 py-3 text-sm bg-white outline-none"
            style={field}
          >
            <option value="">会社なし</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="assigneeId"
            defaultValue={myMemberId}
            className="w-full px-3 py-3 text-sm bg-white outline-none"
            style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>期限</Label>
          <input
            name="dueDate"
            type="date"
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={field}
          />
          <div className="flex gap-1.5 flex-wrap">
            <Chip on={time === ""} tone="blue" onClick={() => setTime("")}>
              時間なし
            </Chip>
            {TIMES.map((t) => (
              <Chip key={t} on={time === t} tone="blue" onClick={() => setTime(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>優先度</Label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 ${
                  priority === p ? "anim-chip" : ""
                }`}
                style={{
                  background: priority === p ? "#fff" : "transparent",
                  border: `2px solid ${priority === p ? C.ink : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                <PriorityBadge pri={p} size={24} />
                <span className="text-xs font-bold">{p}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>カレンダーの共有先</Label>
          {SHARES.map((key) => {
            const s = TASK_SHARE[key];
            const on = share === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setShare(key)}
                className="w-full flex items-center gap-2.5 p-3 text-left"
                style={{
                  background: on ? SOFT[s.color as keyof typeof SOFT] : "#fff",
                  border: `2px solid ${on ? C[s.color] : C.line}`,
                  borderRadius: "22px 11px 22px 11px",
                }}
              >
                <ShapeIcon shape={s.shape} color={s.color} size={30} />
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{s.label}</span>
                  <span className="block text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
                    {s.calendar}に入ります
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {state && "error" in state && state.error && (
          <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
            {state.error}
          </p>
        )}

        <OrganicButton type="submit" size="lg" color="yellow" className="w-full" disabled={pending}>
          {pending ? "追加しています…" : "追加する"}
        </OrganicButton>
      </form>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
      {children}
    </div>
  );
}

function Chip({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  tone: ColorKey;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold px-3 py-1.5 ${on ? "anim-chip" : ""}`}
      style={{
        background: on ? SOFT[tone as keyof typeof SOFT] : "#fff",
        color: on ? C[tone] : "#9AA0A6",
        border: `2px solid ${on ? C[tone] : C.line}`,
        borderRadius: "14px 7px 14px 7px",
      }}
    >
      {children}
    </button>
  );
}
