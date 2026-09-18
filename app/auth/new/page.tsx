import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/AuthShell";
import { NewWorkspaceForm } from "./NewWorkspaceForm";

export default async function NewWorkspaceStep() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログインならまずメール認証へ。作成は認証後にしかできない。
  if (!user) redirect("/auth/email");

  const { data: corporate } = await supabase.rpc("is_corporate_domain", {
    p_domain: (user.email ?? "").split("@")[1] ?? "",
  });

  return (
    <AuthShell>
      <NewWorkspaceForm email={user.email ?? ""} corporateDomain={Boolean(corporate)} />
    </AuthShell>
  );
}
