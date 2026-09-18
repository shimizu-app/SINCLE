import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Avatar, MemberStatus, Workspace, WorkspaceMember } from "@/types/db";

/** いま開いているワークスペースを覚えておく Cookie */
export const ACTIVE_WS_COOKIE = "syncle_ws";

export type Current = {
  userId: string;
  email: string;
  workspace: Workspace;
  member: WorkspaceMember;
};

/**
 * ログイン中のユーザーと、いま開いているワークスペースを返す。
 * どちらか欠けていれば認証の入口に飛ばす。
 * 画面（Server Component）の先頭で呼ぶ。
 */
export async function requireCurrent(): Promise<Current> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const store = await cookies();
  const activeId = store.get(ACTIVE_WS_COOKIE)?.value;

  // RLS で自分の所属分しか返らないので、Cookie の値が他人のものでも取れない
  const { data: workspace } = activeId
    ? await supabase.from("workspaces").select("*").eq("id", activeId).maybeSingle()
    : { data: null };

  if (!workspace) redirect("/auth/workspace");

  const { data: member } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/auth/workspace");

  return {
    userId: user.id,
    email: user.email ?? "",
    workspace,
    member: {
      ...member,
      status: member.status as MemberStatus,
      avatar: member.avatar as unknown as Avatar,
      cover: (member.cover as unknown as Avatar) ?? null,
    },
  };
}
