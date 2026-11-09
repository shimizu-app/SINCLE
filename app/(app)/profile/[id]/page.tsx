import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Building2, Briefcase, Pencil } from "lucide-react";
import { C } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { MemberDot } from "@/components/ui";
import type { Avatar } from "@/types/db";
import { ProfileCover } from "../ProfileCover";
import { TalkButton } from "./TalkButton";

type MemberInfo = {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: Avatar | null;
  note: string | null;
  is_admin: boolean;
  status: string;
  is_me: boolean;
  company_count: number;
  open_task_count: number;
};

/** プロフィール（SCREENS 12）。自分にも他人にも使う */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: members }, { data: row }] = await Promise.all([
    supabase.rpc("list_members", { p_workspace_id: current.workspace.id }),
    supabase
      .from("workspace_members")
      .select("cover")
      .eq("id", id)
      .eq("workspace_id", current.workspace.id)
      .maybeSingle(),
  ]);
  const member = ((members ?? []) as unknown as MemberInfo[]).find((m) => m.id === id);
  if (!member) notFound();

  const cover = (row?.cover ?? null) as Avatar | null;
  const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

  return (
    <>
      <div className="relative">
        <ProfileCover cover={cover} seedText={member.id} height={160} />
        <Link
          href={member.is_me ? "/settings" : "/channels?tab=members"}
          className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1.5 bg-white/90"
          style={{ borderRadius: "12px 6px 12px 6px" }}
        >
          <ChevronLeft size={14} strokeWidth={3} />
          もどる
        </Link>
        <div className="absolute left-1/2 -bottom-12 -translate-x-1/2">
          <MemberDot name={member.name} avatar={member.avatar} size={104} />
        </div>
      </div>

      <div className="px-4 pt-14 pb-4 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold break-words">{member.name}</h1>
          <div className="text-sm font-bold" style={{ color: "#9AA0A6" }}>
            {member.role}
            {member.is_admin && " ・ 管理者"}
            {member.status === "invited" && " ・ まだログインしていません"}
          </div>
          {member.note && (
            <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap pt-1" style={{ color: "#4A4A4A" }}>
              {member.note}
            </p>
          )}
        </div>

        {member.is_me ? (
          <Link
            href="/profile/edit"
            className="flex items-center justify-center gap-1.5 text-sm font-extrabold py-3 bg-white"
            style={{ ...card, color: C.purple }}
          >
            <Pencil size={15} strokeWidth={2.8} />
            プロフィールを編集する
          </Link>
        ) : (
          member.status === "active" && <TalkButton memberId={member.id} name={member.name} />
        )}

        <div className="bg-white p-4 space-y-3" style={card}>
          <Info icon={<Mail size={16} strokeWidth={2.6} style={{ color: C.blue }} />} label="メール" value={member.email} />
          <Info
            icon={<Building2 size={16} strokeWidth={2.6} style={{ color: C.purple }} />}
            label="ワークスペース"
            value={current.workspace.name}
          />
          <Info
            icon={<Briefcase size={16} strokeWidth={2.6} style={{ color: C.green }} />}
            label="担当している顧客"
            value={`${member.company_count}社 ・ 未完了のタスク ${member.open_task_count}件`}
          />
        </div>
      </div>
    </>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <span className="text-[11px] font-extrabold w-24 shrink-0" style={{ color: "#9AA0A6" }}>
        {label}
      </span>
      <span className="text-sm font-bold min-w-0 break-all">{value}</span>
    </div>
  );
}
