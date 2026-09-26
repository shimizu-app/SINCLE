"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import type { DealStatus } from "@/types/db";

export type DealResult = { error: string } | { ok: true } | undefined;

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/**
 * 案件を直す。
 * メモを更新すると updated_at が動き、放置判定から外れる（SPEC 2章）。
 * updated_at はトリガで自動更新される。
 */
export async function updateDeal(_prev: DealResult, form: FormData): Promise<DealResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const id = str(form, "id");
  if (!id) return { error: "案件が指定されていません。" };

  const { error } = await supabase
    .from("deals")
    .update({
      status: (str(form, "status") ?? "talking") as DealStatus,
      memo: str(form, "memo"),
      amount: str(form, "amount"),
    })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);

  if (error) return { error: error.message };

  const companyId = str(form, "companyId");
  const ownerId = str(form, "ownerId");
  const dealType = str(form, "dealType");
  if (companyId && (ownerId || dealType)) {
    await supabase
      .from("companies")
      .update({
        ...(ownerId ? { owner_id: ownerId } : {}),
        ...(dealType ? { deal_type: dealType } : {}),
      })
      .eq("id", companyId)
      .eq("workspace_id", current.workspace.id);
  }

  revalidatePath("/customers");
  return { ok: true };
}

/** 完了にする。会社チャンネルにも残る。 */
export async function completeDeal(dealId: string, note?: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_deal", {
    p_deal_id: dealId,
    p_note: note ?? undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/customers");
}

/** 記録を1行で残す（SCREENS 4）。チャンネルにも流れ、放置判定もリセットされる。 */
export async function logActivity(companyId: string, text: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_activity", {
    p_company_id: companyId,
    p_text: text,
  });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${companyId}`);
}
