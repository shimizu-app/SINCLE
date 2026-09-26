"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";

export type RegisterResult = { error: string } | undefined;

/** 名刺を1枚登録する。会社・チャンネル・ティア・案件・初回タスクまで一度に出来る。 */
export async function registerContact(
  _prev: RegisterResult,
  formData: FormData
): Promise<RegisterResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const companyName = text("companyName");
  const companyId = text("companyId");
  if (!companyName && !companyId) return { error: "会社名を入力してください。" };

  const employees = Number(formData.get("employees"));

  const { data, error } = await supabase.rpc("register_contact", {
    p_workspace_id: current.workspace.id,
    p_company_name: companyName ?? "",
    p_company_id: companyId,
    p_contact_name: text("contactName"),
    p_dept: text("dept"),
    p_title: text("title"),
    p_email: text("email"),
    p_phone: text("phone"),
    p_industry: text("industry"),
    p_employees: Number.isFinite(employees) && employees > 0 ? employees : undefined,
    p_revenue: text("revenue"),
    p_address: text("address"),
    p_web: text("web"),
    p_tier_manual: text("tierManual"),
    p_deal_type: text("dealType"),
    p_deal_memo: text("dealMemo"),
    p_comment: text("comment"),
    p_make_primary: formData.get("makePrimary") !== "off",
  });

  if (error) return { error: error.message };

  const result = data as { company_id?: string } | null;
  revalidatePath("/customers");
  redirect(`/customers/${result?.company_id ?? ""}`);
}

export type UpdateResult = { error: string } | { ok: true } | undefined;

/** 会社詳細の編集フォーム */
export async function updateCompany(
  _prev: UpdateResult,
  formData: FormData
): Promise<UpdateResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "会社が指定されていません。" };

  const value = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const employees = Number(formData.get("employees"));
  const tierManual = value("tierManual");

  const { error } = await supabase
    .from("companies")
    .update({
      name: value("name") ?? undefined,
      industry: value("industry"),
      employees: Number.isFinite(employees) && employees >= 0 ? employees : 0,
      revenue: value("revenue"),
      address: value("address"),
      web: value("web"),
      deal_type: value("dealType"),
      comment: value("comment"),
      // 空文字を送ると check 制約に引っかかるので null に寄せる
      tier_manual: tierManual === "auto" ? null : tierManual,
      stage_id: value("stageId"),
    })
    .eq("id", id)
    .eq("workspace_id", current.workspace.id);

  if (error) return { error: error.message };

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { ok: true };
}

/** 窓口を変える */
export async function setPrimaryContact(companyId: string, contactId: string) {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({ primary_contact_id: contactId })
    .eq("id", companyId)
    .eq("workspace_id", current.workspace.id);

  if (error) return { error: error.message };
  revalidatePath(`/customers/${companyId}`);
}
