import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEAL_STATUS } from "@/lib/design";
import { stripQuoted } from "@/lib/mail-parse";
import type { MailContext } from "@/lib/mail-compose";
import type { Current } from "@/lib/workspace";

export type Recipient = { address: string; name: string | null; contactId: string | null };

export type ComposeSource = {
  ctx: MailContext;
  companyId: string;
  contactId: string | null;
  recipients: Recipient[];
  reply: { id: string; subject: string; rfcMessageId: string | null; threadId: string | null; mine: boolean } | null;
};

/**
 * 下書きに渡す材料を集める（SPEC 6章の一覧）。
 * 会社・名刺・案件・進み具合・社内メモ・未完了タスク・返信元メール。
 */
export async function composeSource(
  current: Current,
  input: { companyId?: string | null; contactId?: string | null; replyId?: string | null }
): Promise<ComposeSource | null> {
  const supabase = await createClient();
  const ws = current.workspace.id;

  let companyId = input.companyId ?? null;
  let contactId = input.contactId ?? null;
  let reply: ComposeSource["reply"] = null;
  let replyTo: MailContext["replyTo"] = null;
  let replyAddress: string | null = null;

  if (input.replyId) {
    const { data: mail } = await supabase
      .from("mails")
      .select("*")
      .eq("id", input.replyId)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (mail) {
      companyId = companyId ?? mail.company_id;
      contactId = contactId ?? mail.contact_id;
      replyAddress = mail.direction === "in" ? mail.from_email : mail.to_email?.split(",")[0]?.trim() ?? null;
      reply = {
        id: mail.id,
        subject: mail.subject,
        rfcMessageId: mail.rfc_message_id && !mail.rfc_message_id.startsWith("gmail:") ? mail.rfc_message_id : null,
        threadId: mail.gmail_thread_id,
        mine: mail.imported_by === current.member.id,
      };
      replyTo = { subject: mail.subject, body: stripQuoted(mail.body ?? ""), from: mail.from_email };
    }
  }
  if (!companyId) return null;

  const [{ data: company }, { data: contacts }, { data: deal }, { data: tasks }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).eq("workspace_id", ws).maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, title, dept, email")
      .eq("company_id", companyId)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("deals").select("status, memo").eq("company_id", companyId).eq("active", true).maybeSingle(),
    supabase
      .from("tasks")
      .select("title")
      .eq("company_id", companyId)
      .eq("done", false)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);
  if (!company) return null;

  const { data: stage } = company.stage_id
    ? await supabase.from("stages").select("name").eq("id", company.stage_id).maybeSingle()
    : { data: null };

  const list = contacts ?? [];
  const contact = list.find((c) => c.id === contactId) ?? (replyAddress ? list.find((c) => c.email?.toLowerCase() === replyAddress?.toLowerCase()) : undefined) ?? list.find((c) => c.email) ?? null;

  const recipients: Recipient[] = list
    .filter((c) => c.email)
    .map((c) => ({ address: c.email as string, name: c.name, contactId: c.id }));
  if (replyAddress && !recipients.some((r) => r.address.toLowerCase() === replyAddress?.toLowerCase())) {
    recipients.unshift({ address: replyAddress, name: null, contactId: null });
  }

  const status = deal?.status ? DEAL_STATUS[deal.status as keyof typeof DEAL_STATUS]?.label ?? null : null;

  return {
    companyId,
    contactId: contact?.id ?? null,
    recipients,
    reply,
    ctx: {
      myName: current.member.name,
      myRole: current.member.role,
      myCompany: current.workspace.name,
      companyName: company.name,
      industry: company.industry,
      employees: company.employees,
      dealType: company.deal_type,
      dealStatus: status,
      dealMemo: deal?.memo ?? null,
      stage: stage?.name ?? null,
      companyMemo: company.comment,
      openTasks: (tasks ?? []).map((t) => t.title),
      contactName: contact?.name ?? null,
      contactTitle: contact?.title ?? null,
      contactDept: contact?.dept ?? null,
      replyTo,
      hasSlots: false,
      hasBooking: false,
    },
  };
}
