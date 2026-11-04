"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { DEPT_KEYS, deptOf, type DeptKey } from "./depts";

/* 計画（SCREENS 8）の書き込み。
   agenda_items は所属メンバーなら誰でも書ける（008 / 014 の RLS）。
   ここでも workspace_id を必ず付けて、別のワークスペースに触れないようにする。 */

export type AgendaResult = { error: string } | { ok: true } | undefined;

type State = "todo" | "talking" | "decided";
const STATES: State[] = ["todo", "talking", "decided"];

function done() {
  revalidatePath("/roadmap");
}

/** 話したいことを追加する */
export async function addAgenda(_prev: AgendaResult, form: FormData): Promise<AgendaResult> {
  const current = await requireCurrent();

  const title = String(form.get("title") ?? "").trim();
  const dept = String(form.get("dept") ?? "") as DeptKey;
  const year = Number(form.get("year"));
  const month = Number(form.get("month"));

  if (!title) return { error: "話したいことを入力してください。" };
  if (!DEPT_KEYS.includes(dept)) return { error: "部署を選んでください。" };
  if (!Number.isInteger(year) || month < 1 || month > 12) return { error: "月を選んでください。" };

  const supabase = await createClient();
  const { error } = await supabase.from("agenda_items").insert({
    workspace_id: current.workspace.id,
    dept,
    year,
    month,
    title,
    state: "todo",
    // 書いた人は最初から参加者にしておく
    participants: [current.member.id],
  });
  if (error) return { error: error.message };

  done();
  return { ok: true };
}

/** 状態を変える。決定済みにするときは「決まったこと」も一緒に受け取る */
export async function setAgendaState(id: string, state: State, decision?: string) {
  const current = await requireCurrent();
  if (!STATES.includes(state)) return { error: "状態が正しくありません。" };

  const text = decision?.trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_items")
    .update(
      state === "decided"
        ? { state, decision: text, decided_at: new Date().toISOString().slice(0, 10) }
        : { state }
    )
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  done();
}

/** 決まったことだけを書き直す */
export async function setDecision(id: string, decision: string) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_items")
    .update({ decision: decision.trim() || null })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  done();
}

/** いつ話すか。「11/12（水）14:00」のような文で持つ（008 の scheduled_text） */
export async function setSchedule(id: string, text: string) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_items")
    .update({ scheduled_text: text.trim() || null })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  done();
}

/** 参加者を入れ替える */
export async function setParticipants(id: string, memberIds: string[]) {
  const current = await requireCurrent();
  const supabase = await createClient();

  // 同じワークスペースの人だけに絞る（よその id を混ぜられないように）
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", current.workspace.id)
    .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const allowed = (members ?? []).map((m) => m.id);

  const { error } = await supabase
    .from("agenda_items")
    .update({ participants: allowed })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  done();
}

/** 議題を消す。やることも一緒に消える（on delete cascade） */
export async function deleteAgenda(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_items")
    .delete()
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  done();
}

/* ── やること（担当者つきのチェックリスト） ── */

export async function addAction(agendaId: string, text: string, assigneeId: string | null) {
  await requireCurrent();
  const clean = text.trim();
  if (!clean) return { error: "やることを入力してください。" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("agenda_actions")
    .select("position")
    .eq("agenda_item_id", agendaId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 親の議題が見えなければ RLS で弾かれる
  const { error } = await supabase.from("agenda_actions").insert({
    agenda_item_id: agendaId,
    text: clean,
    assignee_id: assigneeId,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };
  done();
}

export async function toggleAction(id: string, value: boolean) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_actions").update({ done: value }).eq("id", id);
  if (error) return { error: error.message };
  done();
}

export async function deleteAction(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from("agenda_actions").delete().eq("id", id);
  if (error) return { error: error.message };
  done();
}

/**
 * 「チャンネルで話す」。
 * 議題ごとにグループチャンネルを1つ作り、参加者を入れる。
 * 2回目からは同じチャンネルを開く（020 の channel_id に覚えておく）。
 *
 * 020 をまだ当てていないデータベースでは channel_id が無い。
 * そのときは覚えずにチャンネルだけ作る（毎回新しくできてしまうが、話せなくなるよりよい）。
 */
export async function openAgendaChannel(id: string): Promise<{ channelId: string } | { error: string }> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("agenda_items")
    .select("id, title, dept, participants")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (error || !item) return { error: "議題が見つかりません。" };

  const remembered = await supabase
    .from("agenda_items")
    .select("channel_id")
    .eq("id", id)
    .maybeSingle();
  const known = (remembered.data as { channel_id?: string | null } | null)?.channel_id;
  if (!remembered.error && known) return { channelId: known };

  const dept = deptOf(item.dept);
  const members = Array.from(new Set([...(item.participants ?? []), current.member.id]));
  const { data: channelId, error: makeError } = await supabase.rpc("create_group_channel", {
    p_workspace_id: current.workspace.id,
    p_name: `議題：${item.title}`.slice(0, 60),
    p_shape: dept.shape,
    p_color: dept.color,
    p_members: members,
  });
  if (makeError || !channelId) return { error: makeError?.message ?? "チャンネルを作れませんでした。" };

  if (!remembered.error) {
    await supabase
      .from("agenda_items")
      .update({ channel_id: channelId as string })
      .eq("id", id)
      .eq("workspace_id", current.workspace.id);
  }

  done();
  revalidatePath("/channels");
  return { channelId: channelId as string };
}
