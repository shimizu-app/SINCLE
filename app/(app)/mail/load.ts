import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MailItem } from "./MailList";

export type MailFilter = "all" | "unreplied" | "in" | "out";

export const MAIL_FILTERS: [MailFilter, string][] = [
  ["all", "すべて"],
  ["unreplied", "未返信"],
  ["in", "受信"],
  ["out", "送信"],
];

export const isMailFilter = (v: unknown): v is MailFilter =>
  v === "all" || v === "unreplied" || v === "in" || v === "out";

type Row = {
  id: string;
  subject: string;
  excerpt: string | null;
  direction: string;
  replied: boolean;
  sent_at: string;
  from_email: string | null;
  to_email: string | null;
  company_id: string | null;
  task_id?: string | null;
  companies: { name: string } | null;
  contacts: { name: string } | null;
};

/**
 * メールの一覧。本文は載せない（開いたときに getMailBody で取る）。
 * 取り込んだメールはワークスペースの全員に見える（005 / 014 の RLS）。
 */
export async function loadMails(
  workspaceId: string,
  opts: { companyId?: string; filter?: MailFilter; limit?: number } = {}
): Promise<MailItem[]> {
  const supabase = await createClient();
  const columns =
    "id, subject, excerpt, direction, replied, sent_at, from_email, to_email, company_id, task_id, companies(name), contacts(name)";

  const run = (cols: string) => {
    let q = supabase
      .from("mails")
      .select(cols)
      .eq("workspace_id", workspaceId)
      .order("sent_at", { ascending: false })
      .limit(opts.limit ?? 60);
    if (opts.companyId) q = q.eq("company_id", opts.companyId);
    if (opts.filter === "unreplied") q = q.eq("direction", "in").eq("replied", false);
    if (opts.filter === "in") q = q.eq("direction", "in");
    if (opts.filter === "out") q = q.eq("direction", "out");
    return q;
  };

  let { data, error } = await run(columns);
  // 021 の前は task_id が無い
  if (error) ({ data, error } = await run(columns.replace(" task_id,", "")));
  if (error) return [];

  return ((data ?? []) as unknown as Row[]).map((m) => ({
    id: m.id,
    subject: m.subject,
    excerpt: m.excerpt,
    direction: m.direction === "out" ? "out" : "in",
    replied: m.replied,
    sent_at: m.sent_at,
    from_email: m.from_email,
    to_email: m.to_email,
    company_id: m.company_id,
    company_name: m.companies?.name ?? null,
    contact_name: m.contacts?.name ?? null,
    task_id: m.task_id ?? null,
  }));
}
