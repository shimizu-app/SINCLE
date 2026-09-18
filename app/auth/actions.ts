"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WS_COOKIE } from "@/lib/workspace";

async function setActive(workspaceId: string) {
  const store = await cookies();
  store.set(ACTIVE_WS_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** 所属しているワークスペースを選んで入る */
export async function selectWorkspace(workspaceId: string): Promise<ActionError> {
  const supabase = await createClient();
  // RLS があるので、所属していなければ見えない＝選べない
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!data) return { error: "このワークスペースには入れません。" };

  await setActive(data.id);
  redirect("/customers");
}

export type CreateResult = { error: string } | undefined;
export type ActionError = { error: string } | undefined;
export type JoinResult = { error: string } | { requested: true } | undefined;

/** 新しいワークスペースを作る */
export async function createWorkspace(_prev: CreateResult, formData: FormData): Promise<CreateResult> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const memberName = String(formData.get("memberName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || "メンバー";
  const color = String(formData.get("color") ?? "purple");
  const shape = String(formData.get("shape") ?? "flower");
  const useDomain = formData.get("useDomain") === "on";

  if (!name) return { error: "会社名を入力してください。" };
  if (!slug) return { error: "URL名を入力してください。" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: name,
    p_slug: slug,
    p_member_name: memberName || undefined,
    p_role: role,
    p_color: color,
    p_shape: shape,
    p_use_domain: useDomain,
  });

  if (error) {
    if (error.message.includes("workspaces_slug_key")) {
      return { error: "このURL名はすでに使われています。別の名前にしてください。" };
    }
    return { error: error.message };
  }

  await setActive(data as string);
  redirect("/customers");
}

/** 同ドメインのワークスペースに参加、または参加を申請する */
export async function joinByDomain(workspaceId: string, name?: string): Promise<JoinResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_by_domain", {
    p_workspace_id: workspaceId,
    p_name: name,
  });
  if (error) return { error: error.message };

  if (data) {
    // open_join=true だったので即参加できた
    await setActive(data as string);
    redirect("/customers");
  }
  // 承認待ち
  return { requested: true };
}

/** 招待リンクで参加する */
export async function joinViaInvite(token: string, name?: string): Promise<ActionError> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_via_invite", {
    p_token: token,
    p_name: name,
  });
  if (error) return { error: error.message };

  await setActive(data as string);
  redirect("/customers");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(ACTIVE_WS_COOKIE);
  redirect("/auth");
}
