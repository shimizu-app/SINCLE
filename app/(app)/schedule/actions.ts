"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { bookingProof } from "@/lib/google";
import { DURATIONS, FORMATS, MAX_PICK, bookingExpiry } from "@/lib/slots";

/**
 * 予約ページを発行する（SCREENS 10「予約ページを発行」）。
 * お客さまはこの URL から候補を選んで確定する。
 */
export async function createBookingLink(input: {
  companyId: string;
  contactId: string | null;
  durationMin: number;
  format: string;
  slots: string[];
  calendarIds: string[];
}): Promise<{ url: string } | { error: string }> {
  const current = await requireCurrent();
  const supabase = await createClient();

  if (!DURATIONS.includes(input.durationMin as (typeof DURATIONS)[number])) return { error: "所要時間を選んでください。" };
  if (!FORMATS.includes(input.format as (typeof FORMATS)[number])) return { error: "実施形式を選んでください。" };
  const now = Date.now();
  const slots = Array.from(new Set(input.slots))
    .filter((s) => Number.isFinite(Date.parse(s)) && Date.parse(s) > now)
    .map((s) => new Date(s).toISOString())
    .sort();
  if (!slots.length) return { error: "候補を1つ以上選んでください。" };
  if (slots.length > MAX_PICK) return { error: `候補は${MAX_PICK}つまでです。` };
  if (input.format === "Zoom" && !current.member.meeting_url) {
    return { error: "Zoom の URL が入っていません。設定の「あなたの設定」で入れてください。" };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", input.companyId)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();
  if (!company) return { error: "会社が見つかりません。" };

  if (input.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", input.contactId)
      .eq("company_id", input.companyId)
      .maybeSingle();
    if (!contact) return { error: "相手の名刺が見つかりません。" };
  }

  // 推測できない長さの合言葉（32文字）と、サーバーだけが作れる証明
  const token = randomBytes(24).toString("base64url");
  const proof = bookingProof(token);
  if (!proof) return { error: "Google 連携の設定（環境変数）が足りません。" };

  const { error } = await supabase.from("booking_links").insert({
    workspace_id: current.workspace.id,
    company_id: input.companyId,
    contact_id: input.contactId,
    member_id: current.member.id,
    token,
    proof_hash: createHash("sha256").update(proof, "utf8").digest("hex"),
    slots,
    duration_min: input.durationMin,
    format: input.format,
    calendar_ids: input.calendarIds.slice(0, 20),
    expires_at: bookingExpiry(slots, now),
  });
  if (error) {
    if (/member_id|proof_hash|calendar_ids|column/i.test(error.message)) {
      return { error: "データベースの更新（022）がまだです。" };
    }
    return { error: error.message };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  revalidatePath(`/customers/${input.companyId}`);
  return { url: `${proto}://${host}/booking/${token}` };
}
