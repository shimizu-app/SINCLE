"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";

export type MemberResult = { error: string } | { ok: string } | undefined;

/** ① 事前登録：管理者がメールを登録し、本人がログインした時点で参加になる */
export async function inviteMember(_prev: MemberResult, form: FormData): Promise<MemberResult> {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "メンバーを登録できるのは管理者だけです。" };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "").trim() || "メンバー";
  if (!email) return { error: "メールアドレスを入力してください。" };

  const supabase = await createClient();
  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: current.workspace.id,
    email,
    name: name || email.split("@")[0],
    role,
    is_admin: form.get("isAdmin") === "on",
    status: "invited",
  });

  if (error) {
    if (error.code === "23505") return { error: "このメールアドレスはもう登録されています。" };
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: `${email} を登録しました。本人がログインすると参加になります。` };
}

export async function removeMember(memberId: string) {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "管理者だけが外せます。" };
  if (memberId === current.member.id) return { error: "自分は外せません。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

/** ② 同ドメイン申請の承認・却下 */
export async function approveRequest(requestId: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_join_request", { p_request_id: requestId });
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

export async function rejectRequest(requestId: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_join_request", { p_request_id: requestId });
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

/** ③ 招待リンク */
export async function makeInviteLink(_prev: MemberResult, form: FormData): Promise<MemberResult> {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "招待リンクを作れるのは管理者だけです。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite_link", {
    p_workspace_id: current.workspace.id,
    p_days: Number(form.get("days")) || 7,
    p_max_uses: Number(form.get("maxUses")) || 10,
  });
  if (error) return { error: error.message };

  const row = (data as unknown as { token: string }[])?.[0];
  if (!row) return { error: "発行できませんでした。" };

  revalidatePath("/settings");
  return { ok: row.token };
}

/** 同ドメイン参加の設定 */
export async function setOpenJoin(open: boolean) {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "管理者だけが変えられます。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ open_join: open })
    .eq("id", current.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

/* ── 商談の進み具合（ステージ）──────────────────────────────
   ワークスペース全体の共有設定なので、書き換えは管理者だけ。
   画面で隠すだけでなく RLS でも閉めてある（019）。          */

export type StageResult = { error: string } | { ok: string } | undefined;

export async function addStage(_prev: StageResult, form: FormData): Promise<StageResult> {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "ステージを変えられるのは管理者だけです。" };

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "段階の名前を入力してください。" };
  if (name.length > 20) return { error: "名前が長すぎます（20文字まで）。" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("stages")
    .select("position")
    .eq("workspace_id", current.workspace.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("stages").insert({
    workspace_id: current.workspace.id,
    name,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: `${name} を足しました。` };
}

export async function renameStage(stageId: string, name: string) {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "管理者だけが変えられます。" };

  const clean = name.trim();
  if (!clean) return { error: "名前を入力してください。" };
  if (clean.length > 20) return { error: "名前が長すぎます（20文字まで）。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stages")
    .update({ name: clean })
    .eq("id", stageId)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

/**
 * 段階を1つ動かす。
 * position に一意制約は無いので、隣と入れ替えるだけでよい。
 */
export async function moveStage(stageId: string, direction: "up" | "down") {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "管理者だけが変えられます。" };

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("stages")
    .select("id, position")
    .eq("workspace_id", current.workspace.id)
    .order("position", { ascending: true });

  const list = stages ?? [];
  const at = list.findIndex((s) => s.id === stageId);
  if (at < 0) return { error: "その段階が見つかりません。" };

  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= list.length) return;

  // position に一意制約は無いので、途中で重なっても構わない。
  // 2本の UPDATE で入れ替える。
  const [me, neighbour] = [list[at], list[to]];
  const swap = async (id: string, position: number) =>
    supabase
      .from("stages")
      .update({ position })
      .eq("id", id)
      .eq("workspace_id", current.workspace.id);

  const first = await swap(me.id, neighbour.position);
  if (first.error) return { error: first.error.message };
  const second = await swap(neighbour.id, me.position);
  if (second.error) return { error: second.error.message };

  revalidatePath("/settings");
}

export async function removeStage(stageId: string) {
  const current = await requireCurrent();
  if (!current.member.is_admin) return { error: "管理者だけが変えられます。" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("stages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", current.workspace.id);
  if ((count ?? 0) <= 1) return { error: "段階を全部なくすことはできません。" };

  // 会社の stage_id は on delete set null なので、消しても会社は残る
  const { error } = await supabase
    .from("stages")
    .delete()
    .eq("id", stageId)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/customers");
}
