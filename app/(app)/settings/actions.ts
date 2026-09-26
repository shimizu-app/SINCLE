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
