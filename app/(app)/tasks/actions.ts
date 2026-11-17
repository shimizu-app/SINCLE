"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { CALENDAR_WRITE_SCOPE, createMeeting, deleteMeeting, googleLink } from "@/lib/google";
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
  const companyId = str(form, "companyId");
  const assigneeId = str(form, "assigneeId") ?? current.member.id;

  // 会社を選ばず、自分が担当なら「自分だけのTODO」にする。
  // tasks はその会社が見える人と担当者から見える（023）が、personal_todos は本人にしか見えない。
  // 「歯医者」のような私用の予定まで、チームに見せないようにするため。
  if (!id && !companyId && assigneeId === current.member.id) {
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

  const row = {
    workspace_id: current.workspace.id,
    title,
    company_id: companyId,
    assignee_id: assigneeId,
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

/* ══════════════ カレンダーから予定を入れる ══════════════ */

export type EventResult = { error: string } | { ok: true; note?: string } | undefined;

/**
 * 予定（打合せ・用事）を入れる（025）。
 * 会社を選べばその会社の予定（会社が見える人に見える）、選ばなければ自分だけの予定。
 * 「Google カレンダーにも入れる」なら、本人の Google カレンダーにも同じ予定を入れる。
 * Google に入らなくても SYNCLE には残し、そのことを伝える。
 */
export async function addCalendarEvent(_prev: EventResult, form: FormData): Promise<EventResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const title = str(form, "title");
  const date = str(form, "date");
  const time = str(form, "time");
  if (!title) return { error: "題名を入力してください。" };
  if (title.length > 200) return { error: "題名は200文字までにしてください。" };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "日付を選んでください。" };
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return { error: "始まる時刻を選んでください。" };

  const duration = Math.round(Number(str(form, "duration") ?? 60));
  if (!Number.isFinite(duration) || duration < 5 || duration > 24 * 60) {
    return { error: "長さは5分〜24時間にしてください。" };
  }

  const start = new Date(`${date}T${time}:00+09:00`);
  if (Number.isNaN(start.getTime())) return { error: "日時が正しくありません。" };

  const companyId = str(form, "companyId");
  const toGoogle = form.get("google") === "on";
  const meet = form.get("meet") === "on";

  // 会社つきなら、自分の会社か確かめる（書けない会社なら、ここで止める）
  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("workspace_id", current.workspace.id)
      .maybeSingle();
    if (!company) return { error: "その会社には予定を入れられません。" };
  }

  // Google カレンダーにも入れる
  let gcalId: string | null = null;
  let meetUrl: string | null = null;
  let note: string | undefined;
  if (toGoogle) {
    const link = await googleLink(current.workspace.id);
    if (link.state !== "connected") {
      note = "Google カレンダーがつながっていないので、SYNCLE にだけ入れました。";
    } else if (!link.scopes.includes(CALENDAR_WRITE_SCOPE)) {
      note = "Google カレンダーに予定を入れる許可が無いので、SYNCLE にだけ入れました（設定からつなぎ直すと入るようになります）。";
    } else {
      const made = await createMeeting(link.token, {
        title,
        description: "SYNCLE から入れた予定",
        start: start.toISOString(),
        durationMin: duration,
        attendees: [],
        meet,
      });
      if ("error" in made) {
        note = `Google カレンダーには入りませんでした（${made.error}）。SYNCLE には入れました。`;
      } else {
        gcalId = made.id;
        meetUrl = made.meetUrl;
      }
    }
  }

  const { error } = await supabase.from("events").insert({
    workspace_id: current.workspace.id,
    company_id: companyId,
    title,
    starts_at: start.toISOString(),
    duration_min: duration,
    format: meet ? "Google Meet" : "対面",
    meet_url: meetUrl,
    gcal_event_id: gcalId,
    created_by: current.member.id,
  });
  if (error) {
    if (/created_by|column/i.test(error.message)) return { error: "データベースの更新（025）がまだです。" };
    return { error: error.message };
  }

  revalidatePath("/tasks");
  if (companyId) revalidatePath(`/customers/${companyId}`);
  return { ok: true, note };
}

/**
 * 入れた予定を消す（自分の予定・自分の会社の予定だけ。RLS でも止める）。
 * 自分が Google カレンダーにも入れた予定なら、Google 側も取り消す。
 */
export async function deleteCalendarEvent(id: string): Promise<{ error: string } | { ok: true }> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, gcal_event_id, created_by")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (!event) return { error: "予定が見つかりません。" };

  const { data: gone, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .select("id");
  if (error) return { error: error.message };
  if (!gone?.length) return { error: "この予定は消せません（人の会社の予定です）。" };

  if (event.gcal_event_id && event.created_by === current.member.id) {
    const link = await googleLink(current.workspace.id);
    if (link.state === "connected" && link.scopes.includes(CALENDAR_WRITE_SCOPE)) {
      await deleteMeeting(link.token, event.gcal_event_id).catch(() => {});
    }
  }

  revalidatePath("/tasks");
  return { ok: true };
}

/* ══════════════ 個人TODO ══════════════ */

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
