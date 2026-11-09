"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import { draftMail, reviseMail } from "@/lib/ai-mail";
import { gmailSendState, sendViaGmail } from "@/lib/gmail-send";
import { PURPOSES, REPLY_PURPOSE, REVISIONS, TONES, fillMarks, withSignature } from "@/lib/mail-compose";
import { excerptOf } from "@/lib/mail-parse";
import { isAddress } from "@/lib/mime";
import { slotsText } from "@/lib/slots";
import { defaultSignature } from "@/lib/signature";
import { composeSource } from "./context";

type Draft = { subject: string; body: string };

async function signatureOf() {
  const current = await requireCurrent();
  return {
    current,
    signature:
      current.member.signature?.trim() ||
      defaultSignature(current.member.name, current.member.role, current.workspace.name, current.email),
  };
}

/** AIで下書きする（SCREENS 9「AIメール作成」1〜5） */
export async function generateDraft(input: {
  companyId: string | null;
  contactId: string | null;
  replyId: string | null;
  purpose: string;
  tone: string;
  notes: string;
  slots: string[];
  durationMin: number;
  bookingUrl: string | null;
}): Promise<Draft | { error: string }> {
  const { current, signature } = await signatureOf();
  if (![...PURPOSES, REPLY_PURPOSE].includes(input.purpose as never)) return { error: "用件を選んでください。" };
  if (!TONES.includes(input.tone as never)) return { error: "トーンを選んでください。" };

  const src = await composeSource(current, input);
  if (!src) return { error: "会社が見つかりません。" };

  const slots = input.slots.filter((s) => Number.isFinite(Date.parse(s))).slice(0, 4);
  const booking = input.bookingUrl && /^https:\/\/\S+\/booking\/[\w-]{32,}$/.test(input.bookingUrl) ? input.bookingUrl : null;

  const draft = await draftMail(
    { ...src.ctx, hasSlots: slots.length > 0, hasBooking: Boolean(booking) },
    { purpose: input.purpose, tone: input.tone, notes: input.notes }
  );
  if ("error" in draft) return draft;

  const body = fillMarks(draft.body, {
    slotsText: slots.length ? slotsText(slots, input.durationMin || 60) : undefined,
    bookingUrl: booking ?? undefined,
  });
  return { subject: draft.subject, body: withSignature(body, signature) };
}

/** 修正ボタン（もう少し短く / もっと丁寧に / もっと簡潔でカジュアルに） */
export async function reviseDraft(input: Draft & { instruction: string }): Promise<Draft | { error: string }> {
  const { signature } = await signatureOf();
  if (!REVISIONS.includes(input.instruction as never)) return { error: "直し方を選んでください。" };

  // 署名は AI に触らせない。外して直してから付け直す
  const sig = signature.trim();
  const bare = input.body.includes(sig) ? input.body.replace(sig, "").trimEnd() : input.body;
  const revised = await reviseMail({ subject: input.subject, body: bare }, input.instruction);
  if ("error" in revised) return revised;
  return { subject: revised.subject, body: input.body.includes(sig) ? withSignature(revised.body, sig) : revised.body };
}

type SendInput = Draft & {
  companyId: string;
  contactId: string | null;
  replyId: string | null;
  to: string;
};

function check(input: SendInput): string | null {
  if (!isAddress(input.to)) return "宛先のメールアドレスを確かめてください。";
  if (!input.subject.trim()) return "件名を入れてください。";
  if (!input.body.trim()) return "本文を入れてください。";
  if (input.subject.length > 300) return "件名が長すぎます。";
  if (input.body.length > 50_000) return "本文が長すぎます。";
  return null;
}

/** 送ったあとの記録：メール履歴・返信済み・会社チャンネルへの知らせ（タイムラインはメール履歴から出る） */
async function record(
  input: SendInput,
  sent: { gmailId: string | null; threadId: string | null; messageId: string | null; from: string | null }
) {
  const current = await requireCurrent();
  const supabase = await createClient();
  const ws = current.workspace.id;

  const { data: company } = await supabase.from("companies").select("id").eq("id", input.companyId).eq("workspace_id", ws).maybeSingle();
  const companyId = company?.id ?? null;

  await supabase.from("mails").insert({
    workspace_id: ws,
    company_id: companyId,
    contact_id: input.contactId,
    direction: "out",
    subject: input.subject.trim(),
    body: input.body,
    excerpt: excerptOf(input.body),
    from_email: sent.from,
    to_email: input.to.trim(),
    gmail_message_id: sent.gmailId,
    gmail_thread_id: sent.threadId,
    rfc_message_id: sent.messageId,
    imported_by: current.member.id,
    replied: false,
    sent_at: new Date().toISOString(),
  });

  if (input.replyId) {
    await supabase.from("mails").update({ replied: true }).eq("id", input.replyId).eq("workspace_id", ws);
  }

  if (companyId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("company_id", companyId)
      .eq("kind", "company")
      .maybeSingle();
    if (channel) {
      await supabase.from("messages").insert({
        channel_id: channel.id,
        workspace_id: ws,
        author_id: current.member.id,
        is_system: true,
        text: `${current.member.name}さんがメールを送りました：${input.subject.trim().slice(0, 80)}（宛先 ${input.to.trim()}）`,
      });
    }
    revalidatePath(`/customers/${companyId}`);
  }
  revalidatePath("/mail");
}

/** Gmail で送る（送信は人が押す。SPEC 6章） */
export async function sendMail(input: SendInput): Promise<{ ok: true } | { error: string; reconnect?: boolean }> {
  const current = await requireCurrent();
  const problem = check(input);
  if (problem) return { error: problem };

  const state = await gmailSendState(current.workspace.id);
  if (!state.ok) {
    return {
      error:
        state.reason === "no_permission" || state.reason === "disconnected"
          ? "Gmail から送る許可がありません。Gmail をつなぎ直してください（「メールアプリで開く」でも送れます）。"
          : state.reason === "expired"
            ? "Google との連携が切れています。つなぎ直してください。"
            : "Google 連携の設定がまだです。「メールアプリで開く」で送ってください。",
      reconnect: state.reason !== "unconfigured" && state.reason !== "needs_migration",
    };
  }

  const src = await composeSource(current, { companyId: input.companyId, contactId: input.contactId, replyId: input.replyId });
  const reply = src?.reply ?? null;
  const contactName = src?.recipients.find((r) => r.address.toLowerCase() === input.to.trim().toLowerCase())?.name ?? null;

  const sent = await sendViaGmail(
    state.token,
    {
      from: { address: state.email ?? current.email, name: current.member.name },
      to: [{ address: input.to.trim(), name: contactName }],
      subject: input.subject,
      body: input.body,
      inReplyTo: reply?.rfcMessageId ?? null,
    },
    // スレッドにつなげられるのは、自分の受信箱にあるメールへの返信だけ
    reply?.mine ? reply.threadId : null
  );
  if ("error" in sent) {
    console.error(`[mail] 送れない status=${sent.status} ${sent.error}`);
    return {
      error: sent.status === 403 ? "Gmail から送る許可がありません。つなぎ直してください。" : `送れませんでした（${sent.error}）`,
      reconnect: sent.status === 403 || sent.status === 401,
    };
  }

  await record(input, { gmailId: sent.id, threadId: sent.threadId, messageId: sent.messageId, from: state.email });
  return { ok: true };
}

/** メールアプリで送ったものを、履歴に残す */
export async function recordManualSend(input: SendInput): Promise<{ ok: true } | { error: string }> {
  const current = await requireCurrent();
  const problem = check(input);
  if (problem) return { error: problem };
  await record(input, { gmailId: null, threadId: null, messageId: null, from: current.email });
  return { ok: true };
}
