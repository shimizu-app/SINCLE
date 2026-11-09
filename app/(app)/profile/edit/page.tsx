import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCurrent } from "@/lib/workspace";
import type { Avatar } from "@/types/db";
import { ProfileForm } from "./ProfileForm";

/** プロフィールの編集（SCREENS 11「アカウント設定」） */
export default async function EditProfile() {
  const current = await requireCurrent();
  const m = current.member;
  return (
    <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 space-y-4">
      <Link href={`/profile/${m.id}`} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#9AA0A6" }}>
        <ChevronLeft size={16} strokeWidth={3} />
        プロフィール
      </Link>
      <h1 className="text-xl font-extrabold">プロフィールを編集</h1>
      <ProfileForm
        memberId={m.id}
        initial={{
          name: m.name,
          role: m.role,
          note: m.note ?? "",
          avatar: (m.avatar ?? { kind: "shape", shape: "flower", color: "purple" }) as unknown as Avatar,
          cover: (m.cover ?? null) as unknown as Avatar | null,
        }}
      />
    </div>
  );
}
