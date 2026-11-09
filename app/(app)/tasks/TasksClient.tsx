"use client";

import { useState } from "react";
import { TaskList, type Subtask, type TaskRow, type TodoRow } from "./TaskList";
import { TaskSheet, type SheetCompany, type SheetMember } from "./TaskSheet";

/** 追加シートの開閉だけを持つ薄い入れ物 */
export function TasksClient({
  tasks,
  todos,
  subtasks,
  companies,
  members,
  myMemberId,
  groupBy,
}: {
  tasks: TaskRow[];
  todos: TodoRow[];
  subtasks: Subtask[];
  companies: SheetCompany[];
  members: SheetMember[];
  myMemberId: string;
  groupBy?: "company" | "assignee";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
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
