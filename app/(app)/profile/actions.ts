"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { SHAPES, SOFT } from "@/lib/design";
import type { Json } from "@/types/supabase";

export type ProfileResult = { error: string } | { ok: true } | undefined;

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** アイコン：シンボル（形と色）か、縮めた写真（data URL） */
function parseAvatar(raw: string): Json | null {
  try {
    const v = JSON.parse(raw) as { kind?: string; shape?: string; color?: string; src?: string };
    if (v.kind === "shape" && v.shape && v.shape in SHAPES && v.color && v.color in SOFT) {
      return { kind: "shape", shape: v.shape, color: v.color };
    }
    if (v.kind === "photo" && typeof v.src === "string" && v.src.length <= 150_000 && PHOTO.test(v.src)) {
      return { kind: "photo", src: v.src };
    }
  } catch {}
  return null;
}

/** カバー：空なら既定の柄。写真は縮めた data URL */
function parseCover(raw: string): Json | null | "invalid" {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { kind?: string; src?: string };
    if (v.kind === "photo" && typeof v.src === "string" && v.src.length <= 350_000 && PHOTO.test(v.src)) {
      return { kind: "photo", src: v.src };
    }
  } catch {}
  return "invalid";
}

/** プロフィールを書き換える（SCREENS 11「アカウント設定」）。自分の行だけ */
export async function updateProfile(_prev: ProfileResult, form: FormData): Promise<ProfileResult> {
  const current = await requireCurrent();

  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!name) return { error: "表示名を入力してください。" };
  if (name.length > 60) return { error: "表示名は60文字までです。" };
  if (role.length > 40) return { error: "役割は40文字までです。" };
  if (note.length > 200) return { error: "ひとことは200文字までです。" };

  const avatar = parseAvatar(String(form.get("avatar") ?? ""));
  if (!avatar) return { error: "アイコンを選び直してください。" };
  const cover = parseCover(String(form.get("cover") ?? ""));
  if (cover === "invalid") return { error: "カバーの写真を選び直してください。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ name, role: role || "メンバー", note: note || null, avatar, cover })
    .eq("id", current.member.id)
    .eq("workspace_id", current.workspace.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** 個人の設定：タスクの見せ方・署名・会議URL（SCREENS 11） */
export async function savePreferences(input: {
  taskView?: "company" | "assignee";
  signature?: string;
  meetingUrl?: string;
}): Promise<{ error: string } | { ok: true }> {
  const current = await requireCurrent();
  const patch: { task_view?: string; signature?: string | null; meeting_url?: string | null } = {};

  if (input.taskView !== undefined) {
    if (input.taskView !== "company" && input.taskView !== "assignee") return { error: "見せ方が正しくありません。" };
    patch.task_view = input.taskView;
  }
  if (input.signature !== undefined) {
    const s = input.signature.trim();
    if (s.length > 1000) return { error: "署名は1000文字までです。" };
    patch.signature = s || null;
  }
  if (input.meetingUrl !== undefined) {
    const u = input.meetingUrl.trim();
    if (u && !/^https:\/\/\S+$/.test(u)) return { error: "会議のURLは https:// から始まるものを入れてください。" };
    if (u.length > 500) return { error: "会議のURLが長すぎます。" };
    patch.meeting_url = u || null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update(patch)
    .eq("id", current.member.id)
    .eq("workspace_id", current.workspace.id);
  if (error) {
    if (/task_view|signature|meeting_url|column/i.test(error.message)) {
      return { error: "データベースの更新（022）がまだです。" };
    }
    return { error: error.message };
  }
  revalidatePath("/settings");
  revalidatePath("/tasks");
  return { ok: true };
}
