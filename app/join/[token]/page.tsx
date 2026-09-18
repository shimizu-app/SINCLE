import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/AuthShell";
import { JoinByLink } from "./JoinByLink";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログインなら、まずログインしてから戻ってくる
  if (!user) redirect(`/auth/email?next=${encodeURIComponent(`/join/${token}`)}`);

  return (
    <AuthShell>
      <JoinByLink token={token} email={user.email ?? ""} />
    </AuthShell>
  );
}
