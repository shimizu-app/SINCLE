"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import type { Priority, TaskShare } from "@/types/db";

export type ActionResult = { error: string } | { ok: true } | undefined;

type Due = { due_at: string | null; due_has_time: boolean };

/**
 * 期限を組み立てる。時刻なしはその日の 0:00 として持つ（due_has_time で区別）。
 * 戻りの型を書かないと分岐ごとに絞られて、insert の型と合わなくなる。
 */
function dueFrom(date: string | null, time: string | null): Due {
  if (!date) return { due_at: null, due_has_time: false };
  if (!time) return { due_at: new Date(`${date}T00:00:00+09:00`).toISOString(), due_has_time: false };
  return { due_at: new Date(`${date}T${time}:00+09:00`).toISOString(), due_has_time: true };
}

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/* ══════════════ タスク ══════════════ */

export async function saveTask(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const title = str(form, "title");
  if (!title) return { error: "題名を入力してください。" };

  const due = dueFrom(str(form, "dueDate"), str(form, "dueTime"));
  const id = str(form, "id");

  const row = {
    workspace_id: current.workspace.id,
    title,
    company_id: str(form, "companyId"),
    assignee_id: str(form, "assigneeId") ?? current.member.id,
    contact_id: str(form, "contactId"),
    priority: (str(form, "priority") ?? "中") as Priority,
    share: (str(form, "share") ?? "assignee") as TaskShare,
    ...due,
  };

  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id).eq("workspace_id", current.workspace.id)
    : await supabase.from("tasks").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function toggleTask(id: string, done: boolean) {
  const current = await requireCurrent();
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ done })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id).eq("workspace_id", current.workspace.id);
  revalidatePath("/tasks");
}

/* ══════════════ チェックリスト ══════════════ */

export async function addSubtask(taskId: string, text: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { count } = await supabase
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);
  await supabase.from("subtasks").insert({ task_id: taskId, text, position: count ?? 0 });
  revalidatePath("/tasks");
}

export async function toggleSubtask(id: string, done: boolean) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("subtasks").update({ done }).eq("id", id);
  revalidatePath("/tasks");
}

export async function deleteSubtask(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("subtasks").delete().eq("id", id);
  revalidatePath("/tasks");
}

/* ══════════════ 個人TODO ══════════════ */

export async function saveTodo(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const title = str(form, "title");
  if (!title) return { error: "内容を入力してください。" };

  const due = dueFrom(str(form, "dueDate"), str(form, "dueTime"));
  const { error } = await supabase.from("personal_todos").insert({
    workspace_id: current.workspace.id,
    member_id: current.member.id,
    title,
    priority: (str(form, "priority") ?? "中") as Priority,
    ...due,
  });

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function toggleTodo(id: string, done: boolean) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("personal_todos").update({ done }).eq("id", id);
  revalidatePath("/tasks");
}

export async function deleteTodo(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("personal_todos").delete().eq("id", id);
  revalidatePath("/tasks");
}

/* ══════════════ メモ ══════════════ */

export async function saveMemo(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const text = str(form, "text");
  if (!text) return { error: "メモを入力してください。" };

  const id = str(form, "id");
  const row = {
    workspace_id: current.workspace.id,
    member_id: current.member.id,
    text,
    color: str(form, "color") ?? "yellow",
  };

  const { error } = id
    ? await supabase.from("memos").update({ text: row.text, color: row.color }).eq("id", id)
    : await supabase.from("memos").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function pinMemo(id: string, pinned: boolean) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("memos").update({ pinned }).eq("id", id);
  revalidatePath("/tasks");
}

export async function deleteMemo(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from("memos").delete().eq("id", id);
  revalidatePath("/tasks");
}

/** メモをタスクに変える（SCREENS 7-3） */
export async function memoToTask(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: memo } = await supabase.from("memos").select("text").eq("id", id).maybeSingle();
  if (!memo) return { error: "メモが見つかりません。" };

  const { error } = await supabase.from("tasks").insert({
    workspace_id: current.workspace.id,
    title: memo.text.slice(0, 120),
    assignee_id: current.member.id,
    priority: "中",
    share: "self",
  });
  if (error) return { error: error.message };

  await supabase.from("memos").delete().eq("id", id);
  revalidatePath("/tasks");
}
