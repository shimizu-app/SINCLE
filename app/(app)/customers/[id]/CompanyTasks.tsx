"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { C } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { TaskCard, type Subtask, type TaskRow } from "../../tasks/TaskList";
import { TaskSheet, type SheetMember } from "../../tasks/TaskSheet";
import { CompanyProgress, type Stage } from "./CompanyProgress";

/**
 * 会社詳細の「タスク」タブ（SCREENS 4）。
 * 進捗バーとステージ選択、この会社のタスク、追加ボタン。
 *
 * 付箋のカードはタスク画面と同じものを使う。
 * 同じ見た目を2つ持つと、片方だけ直して食い違う。
 */
export function CompanyTasks({
  companyId,
  companyName,
  stages,
  stageId,
  tasks,
  doneTasks,
  subtasks,
  members,
  myMemberId,
}: {
  companyId: string;
  companyName: string;
  stages: Stage[];
  stageId: string | null;
  tasks: TaskRow[];
  doneTasks: TaskRow[];
  subtasks: Subtask[];
  members: SheetMember[];
  myMemberId: string;
}) {
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="space-y-4">
      <CompanyProgress
        companyId={companyId}
        stages={stages}
        stageId={stageId}
        openTasks={tasks.length}
      />

      {tasks.length === 0 ? (
        <p className="text-xs font-bold py-6 text-center" style={{ color: "#C8C2B6" }}>
          未完了のタスクはありません。
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={i}
              subtasks={subtasks.filter((s) => s.task_id === task.id)}
            />
          ))}
        </div>
      )}

      <OrganicButton
        type="button"
        size="lg"
        color="yellow"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} strokeWidth={3} />
        タスクを追加
      </OrganicButton>

      {doneTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-bold px-3 py-2"
            style={{
              color: "#9AA0A6",
              background: "#fff",
              border: `2px solid ${C.line}`,
              borderRadius: "14px 7px 14px 7px",
            }}
          >
            終わったタスク {doneTasks.length}件{showDone ? " を隠す" : " を見る"}
          </button>
          {showDone &&
            doneTasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                subtasks={subtasks.filter((s) => s.task_id === task.id)}
              />
            ))}
        </div>
      )}

      <TaskSheet
        open={open}
        onClose={() => setOpen(false)}
        companies={[{ id: companyId, name: companyName }]}
        members={members}
        myMemberId={myMemberId}
        defaultCompanyId={companyId}
      />
    </div>
  );
}
