"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { syncGmail, type SyncResult } from "@/lib/gmail";

/* メール（SCREENS 9）の書き込み。 */

/** 新しいメールを取り込む。メール画面を開いたときと、ボタンを押したときに呼ぶ */
export async function syncGmailNow(): Promise<SyncResult> {
  const current = await requireCurrent();
  const result = await syncGmail({
    workspaceId: current.workspace.id,
    memberId: current.member.id,
    workspaceDomain: current.workspace.domain ?? null,
  });
  if ("ok" in result) {
    revalidatePath("/mail");
    revalidatePath("/customers", "layout");
  }
  return result;
}

/**
 * 未返信のメールを「返信する」タスクにする（SCREENS 4・9）。
 * 担当は押した人、期限は今日。2回押しても、作るのは1つだけ。
 * 会社が分からないメール（受信箱すべてで入ったもの）は、自分だけのTODO にする。
 */
export async function mailToTask(
  mailId: string
): Promise<{ ok: true; taskId: string | null } | { error: string }> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: mail } = await supabase
    .from("mails")
    .select("*")
    .eq("id", mailId)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (!mail) return { error: "メールが見つかりません。" };
  if (mail.task_id) return { ok: true, taskId: mail.task_id };

  const title = `返信：${mail.subject}`.slice(0, 80);
  // 今日（日本時間）の 0:00。時刻なしの期限として持つ（tasks/actions.ts の dueFrom と同じ）
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const due_at = new Date(`${today}T00:00:00+09:00`).toISOString();

  if (!mail.company_id) {
    const { error } = await supabase.from("personal_todos").insert({
      workspace_id: current.workspace.id,
      member_id: current.member.id,
      title,
      priority: "中",
      due_at,
      due_has_time: false,
    });
    if (error) return { error: error.message };
    revalidatePath("/tasks");
    return { ok: true, taskId: null };
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: current.workspace.id,
      title,
      company_id: mail.company_id,
      contact_id: mail.contact_id,
      assignee_id: current.member.id,
      priority: "中",
      share: "assignee",
      due_at,
      due_has_time: false,
    })
    .select("id")
    .single();
  if (error || !task) return { error: error?.message ?? "タスクを作れませんでした。" };

  // 021 の前は task_id が無い。覚えられないだけで、タスクはできている
  await supabase
    .from("mails")
    .update({ task_id: task.id })
    .eq("id", mailId)
    .eq("workspace_id", current.workspace.id);

  revalidatePath("/mail");
  revalidatePath("/tasks");
  revalidatePath(`/customers/${mail.company_id}`);
  return { ok: true, taskId: task.id };
}

/** 本文。一覧には載せず、開いたときに取りに来る（一覧を軽くするため） */
export async function getMailBody(mailId: string): Promise<{ body: string } | { error: string }> {
  const current = await requireCurrent();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mails")
    .select("body")
    .eq("id", mailId)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (error || !data) return { error: "本文を読めませんでした。" };
  return { body: data.body ?? "" };
}
