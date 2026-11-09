import { redirect } from "next/navigation";
import { requireCurrent } from "@/lib/workspace";

/** 自分のプロフィール */
export default async function MyProfile() {
  const current = await requireCurrent();
  redirect(`/profile/${current.member.id}`);
}
