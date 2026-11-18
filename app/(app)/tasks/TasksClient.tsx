"use client";

import { useState } from "react";
import { TaskList, type Subtask, type TaskRow, type TodoRow } from "./TaskList";
import { TaskSheet, type SheetCompany, type SheetMember } from "./TaskSheet";
import { AgendaTodos, type AgendaTodo } from "./AgendaTodos";

/** 追加シートの開閉だけを持つ薄い入れ物 */
export function TasksClient({
  tasks,
  todos,
  subtasks,
  companies,
  members,
  myMemberId,
  groupBy,
  agendaTodos = [],
}: {
  tasks: TaskRow[];
  todos: TodoRow[];
  subtasks: Subtask[];
  companies: SheetCompany[];
  members: SheetMember[];
  myMemberId: string;
  groupBy?: "company" | "assignee";
  /** 計画のやること（自分が担当）。計画とつながっている */
  agendaTodos?: AgendaTodo[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AgendaTodos items={agendaTodos} />
      <TaskList
        tasks={tasks}
        todos={todos}
        subtasks={subtasks}
        myMemberId={myMemberId}
        onAdd={() => setOpen(true)}
        groupBy={groupBy}
      />
      <TaskSheet
        open={open}
        onClose={() => setOpen(false)}
        companies={companies}
        members={members}
        myMemberId={myMemberId}
      />
    </>
  );
}
