"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import type { DocKind } from "@/types/db";

export type DocResult = { error: string } | { ok: true } | undefined;

/** アップロード。パスは {workspace_id}/{company_id}/{uuid}_{filename}（DATABASE.md） */
export async function uploadDocument(_prev: DocResult, form: FormData): Promise<DocResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const file = form.get("file");
  const companyId = String(form.get("companyId") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "ファイルを選んでください。" };
  if (!companyId) return { error: "会社が指定されていません。" };
  if (file.size > 25 * 1024 * 1024) return { error: "25MB までにしてください。" };

  // 日本語のファイル名はそのままだと Storage のキーに使えない
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${current.workspace.id}/${companyId}/${crypto.randomUUID()}_${safe}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: `アップロードできませんでした：${upErr.message}` };

  const { error } = await supabase.from("documents").insert({
    workspace_id: current.workspace.id,
    company_id: companyId,
    name: file.name,
    kind: (String(form.get("kind") ?? "other") || "other") as DocKind,
    storage_path: path,
    size_bytes: file.size,
    mime_type: file.type || null,
    note: String(form.get("note") ?? "").trim() || null,
    uploaded_by: current.member.id,
  });
  if (error) {
    // 表に入らなかったファイルを残さない
    await supabase.storage.from("documents").remove([path]);
    return { error: error.message };
  }

  revalidatePath(`/customers/${companyId}`);
  return { ok: true };
}

export async function updateDocument(id: string, patch: { kind?: DocKind; note?: string | null; pinned?: boolean }) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .select("company_id")
    .maybeSingle();
  if (data) revalidatePath(`/customers/${data.company_id}`);
}

export async function removeDocument(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, company_id")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (!doc) return;

  await supabase.storage.from("documents").remove([doc.storage_path]);
  await supabase.from("documents").delete().eq("id", id);
  revalidatePath(`/customers/${doc.company_id}`);
}

/** 非公開バケットなので、開くたびに短命の署名URLを作る */
export async function documentUrl(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (!doc) return { error: "書類が見つかりません。" };

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
