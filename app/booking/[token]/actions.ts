"use server";

import { createClient } from "@/lib/supabase/server";
import { accessTokenFor, bookingProof, createMeeting, deleteMeeting, freeBusy } from "@/lib/google";
import { slotLabel } from "@/lib/slots";

/**
 * 予約ページで時刻を選んで確定する（SCREENS 10「予約ページ」）。
 * お客さまはログインしていない。中で token と「証明」を確かめる（022）。
 *
 * 1. 発行したメンバーの Google カレンダーを、確定の直前にもう一度見る（ダブルブッキングを防ぐ）
 * 2. 予定を入れ、お客さまを招待する（Google が招待メールを送る）。Meet ならリンクも作る
 * 3. 打合せ・準備タスク・会社チャンネルへの知らせを書き込み、予約ページを閉じる
 */
export async function confirmBooking(
  token: string,
  slot: string
): Promise<{ ok: true; label: string; meetUrl: string | null; invited: boolean } | { error: string }> {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return { error: "予約ページが見つかりません。" };
  const start = Date.parse(slot);
  if (!Number.isFinite(start) || start <= Date.now()) return { error: "その時刻は選べません。" };
  const startIso = new Date(start).toISOString();

  const proof = bookingProof(token);
  if (!proof) {
    console.error("[booking] 証明を作れない（Google 連携の環境変数が無い）");
    return { error: "いま予約を受け付けられません。お手数ですが担当者にご連絡ください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_for_confirm", { p_token: token, p_proof: proof });
  const b = data?.[0];
  if (error || !b) {
    if (error) console.error(`[booking] 読めない ${error.message}`);
    return { error: "この予約ページは使えません（期限が切れたか、もう確定しています）。" };
  }

  const slots = (Array.isArray(b.slots) ? b.slots : []) as string[];
  if (!slots.some((s) => Date.parse(s) === start)) return { error: "その時刻は候補にありません。" };

  const google = await accessTokenFor(b);
  if (!google) {
    console.error("[booking] 発行したメンバーの Google 連携が使えない");
    return { error: "担当者のカレンダーにつながりませんでした。お手数ですが担当者にご連絡ください。" };
  }

  // 確定の直前に、もう一度カレンダーを見る
  const end = start + b.duration_min * 60_000;
  const calendars = Array.isArray(b.calendar_ids) ? (b.calendar_ids as string[]) : [];
  const fb = await freeBusy(google, calendars, new Date(start), new Date(end));
  if ("error" in fb) {
    console.error(`[booking] 空きを確かめられない ${fb.error}`);
    return { error: "担当者のカレンダーを確かめられませんでした。少し待ってからお試しください。" };
  }
  if (fb.busy.some((x) => Date.parse(x.start) < end && Date.parse(x.end) > start)) {
    return { error: "その時間はちょうど埋まってしまいました。ほかの時間を選んでください。" };
  }

  const title = `${b.company_name}${b.contact_name ? ` ${b.contact_name}様` : ""} 打合せ（${b.workspace_name}）`;
  const zoom = b.format === "Zoom" ? b.meeting_url : null;
  const location =
    b.format === "Zoom" ? zoom : b.format === "訪問" ? `${b.company_name}（訪問）` : b.format === "来社" ? `${b.workspace_name}（ご来社）` : null;

  const event = await createMeeting(google, {
    title,
    description: [
      `${b.workspace_name} の ${b.organizer_name} との打合せです。`,
      `形式：${b.format}`,
      zoom ? `会議のURL：${zoom}` : "",
      "",
      "SYNCLE の予約ページから確定しました。",
    ]
      .filter((l) => l !== "")
      .join("\n"),
    start: startIso,
    durationMin: b.duration_min,
    attendees: b.contact_email ? [{ email: b.contact_email, name: b.contact_name ?? undefined }] : [],
    meet: b.format === "Google Meet",
    location,
  });
  if ("error" in event) {
    console.error(`[booking] 予定を入れられない status=${event.status} ${event.error}`);
    return {
      error:
        event.status === 403
          ? "担当者のカレンダーに予定を入れる許可がありません。お手数ですが担当者にご連絡ください。"
          : "予定を入れられませんでした。少し待ってからお試しください。",
    };
  }

  const { error: saveError } = await supabase.rpc("confirm_booking", {
    p_token: token,
    p_proof: proof,
    p_start: startIso,
    p_title: title,
    p_meet_url: event.meetUrl ?? zoom ?? "",
    p_gcal_event_id: event.id,
  });
  if (saveError) {
    // 2つ同時に押された等。入れた予定は取り消す
    await deleteMeeting(google, event.id);
    console.error(`[booking] 確定を書き込めない ${saveError.message}`);
    return { error: /もう確定/.test(saveError.message) ? "この予約は、もう確定しています。" : "確定できませんでした。もう一度お試しください。" };
  }

  console.log("[booking] 確定した");
  return {
    ok: true,
    label: slotLabel(startIso, b.duration_min),
    meetUrl: event.meetUrl ?? zoom ?? null,
    invited: Boolean(b.contact_email),
  };
}
