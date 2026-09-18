import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/AuthShell";
import { WorkspacePicker } from "./WorkspacePicker";
import type { DomainCandidate } from "@/types/db";

export default async function WorkspaceStep() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // 事前登録されていた行を引き取る（ここに直接来た場合のため）
  await supabase.rpc("claim_membership");

  const [{ data: mine }, { data: candidates }] = await Promise.all([
    supabase.from("workspaces").select("*").order("created_at", { ascending: true }),
    supabase.rpc("find_workspaces_by_domain"),
  ]);

  return (
    <AuthShell>
      <WorkspacePicker
        email={user.email ?? ""}
        mine={mine ?? []}
        candidates={(candidates ?? []) as DomainCandidate[]}
      />
    </AuthShell>
  );
}
