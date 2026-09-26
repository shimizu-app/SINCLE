import Link from "next/link";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TasksClient } from "./TasksClient";
import { TaskCalendar, type CalendarItem } from "./TaskCalendar";
import { Memos, type MemoRow } from "./Memos";
import type { Subtask, TaskRow, TodoRow } from "./TaskList";

const TABS = [
  { key: "list", label: "リスト" },
  { key: "calendar", label: "カレンダー" },
  { key: "memo", label: "メモ" },
] as const;

type Params = { tab?: string; y?: string; m?: string; scope?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const current = await requireCurrent();
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "list";
  const supabase = await createClient();
  const ws = current.workspace.id;

  const now = new Date();
  const year = Number(params.y) || now.getFullYear();
  const month = Number(params.m) || now.getMonth() + 1;
  const scope = params.scope ?? "all";

  // 月の範囲（前後を少し含めて、月またぎの予定も拾う）
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [tasksRes, todosRes, memosRes, companiesRes, membersRes, calendarRes] = await Promise.all([
    supabase.rpc("list_tasks", { p_workspace_id: ws, p_done: false }),
    supabase
      .from("personal_todos")
      .select("id, title, due_at, due_has_time, priority, done")
      .eq("member_id", current.member.id)
      .eq("done", false)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("memos")
      .select("id, text, color, pinned, updated_at")
      .eq("member_id", current.member.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name")
      .eq("workspace_id", ws)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("workspace_members")
      .select("id, name")
      .eq("workspace_id", ws)
      .eq("status", "active")
      .order("created_at"),
    tab === "calendar"
      ? supabase.rpc("calendar_items", {
          p_workspace_id: ws,
          p_from: iso(from),
          p_to: iso(to),
          p_scope: scope,
        })
      : Promise.resolve({ data: [] }),
  ]);

  const tasks = (tasksRes.data ?? []) as unknown as TaskRow[];

  // 開いたときだけ引くのは往復が増えるので、一覧ぶんまとめて取る
  const taskIds = tasks.map((t) => t.id);
  const { data: subtaskRows } = taskIds.length
    ? await supabase
        .from("subtasks")
        .select("id, text, done, task_id")
        .in("task_id", taskIds)
        .order("position")
    : { data: [] };

  const openCount = tasks.length + (todosRes.data?.length ?? 0);

  return (
    <>
      <ScreenHeader
        title="タスク"
        subtitle={openCount > 0 ? `未完了 ${openCount}件` : current.workspace.name}
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-1.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "list" ? "/tasks" : `/tasks?tab=${t.key}`}
                className={`flex-1 text-center text-sm font-bold py-2.5 ${on ? "anim-chip" : ""}`}
                style={{
                  background: on ? SOFT.yellow : "#fff",
                  color: on ? "#9A6B00" : "#9AA0A6",
                  border: `2px solid ${on ? C.yellow : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {tab === "list" && (
          <TasksClient
            tasks={tasks}
            todos={(todosRes.data ?? []) as unknown as TodoRow[]}
            subtasks={(subtaskRows ?? []) as unknown as Subtask[]}
            companies={companiesRes.data ?? []}
            members={membersRes.data ?? []}
            myMemberId={current.member.id}
          />
        )}

        {tab === "calendar" && (
          <TaskCalendar
            items={(calendarRes.data ?? []) as unknown as CalendarItem[]}
            year={year}
            month={month}
            scope={scope}
          />
        )}

        {tab === "memo" && <Memos memos={(memosRes.data ?? []) as unknown as MemoRow[]} />}
      </div>
    </>
  );
}
