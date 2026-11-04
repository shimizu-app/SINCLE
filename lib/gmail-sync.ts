import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  FREE_MAIL_DOMAINS,
  buildQueries,
  domainOf,
  threadToRows,
  type GmailMessage,
  type GmailScope,
  type MailRow,
  type MatchContext,
  type WatchedContact,
} from "./mail-parse";

/**
 * Gmail から読んで、mails に保存するまで（lib/gmail.ts の syncGmail から呼ぶ）。
 *
 * Supabase の client とアクセストークンを外から受け取る。
 * 本物の Gmail・データベースに繋がずに通しで確かめられるように（test/gmail-sync.test.ts）。
 *
 * 流れ
 *   ① 取り込んだスレッドに来た新しい返信（範囲の外の人からでも入れる）
 *   ② 範囲に入るスレッド（名刺のアドレスで Gmail を検索）
 *   ③ スレッドを読んで、入れるメールを決める（lib/mail-parse.ts の threadToRows）
 *   ④ 保存。ほかのメンバーが取り込み済みなら入れ直さず、返信済みだけ追いつかせる
 *   ⑤ 上限で打ち切ったら、次の取り込みで同じ期間を見直して続きを読む
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** 1回で読むスレッドの上限。Vercel の関数は時間で切られるので、残りは次回に回す */
export const MAX_THREADS = 80;
/** 一度に Gmail へ投げる数。Gmail はユーザーごとに1秒あたりの上限がある */
const PARALLEL = 6;

export type GmailStats = {
  at: string;
  imported: number;
  updated: number;
  threads: number;
  ads: number;
  skipped: number;
  /** 上限で打ち切った。残りがある */
  capped: boolean;
  /** 打ち切ったときの続き。次の取り込みは、この期間をもう一度見て、まだ読んでいないスレッドを読む */
  backlog?: { since: string | null } | null;
};

export type SyncResult = { ok: true; stats: GmailStats } | { error: string; reconnect?: boolean };

export type ConnectedGmail = {
  email: string | null;
  token: string;
  scope: GmailScope;
  lastSyncAt: string | null;
  stats: GmailStats | null;
};

/* ── Gmail API ────────────────────────────────────────────── */

class GmailError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gmail<T>(token: string, path: string, params?: URLSearchParams): Promise<T> {
  const res = await fetch(`${API}${path}${params ? `?${params}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new GmailError(res.status, body.error?.message ?? `Gmail に繋がりませんでした（${res.status}）`);
  }
  return (await res.json()) as T;
}

async function listThreadIds(token: string, q: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) p.set("pageToken", pageToken);
    const body = await gmail<{ threads?: { id: string }[]; nextPageToken?: string }>(token, "/threads", p);
    ids.push(...(body.threads ?? []).map((t) => t.id));
    pageToken = body.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

async function getThread(token: string, id: string): Promise<GmailMessage[]> {
  try {
    const body = await gmail<{ messages?: GmailMessage[] }>(
      token,
      `/threads/${encodeURIComponent(id)}`,
      new URLSearchParams({ format: "full" })
    );
    return body.messages ?? [];
  } catch (e) {
    // 取り込みの途中で消されたスレッド。ほかは続ける
    if (e instanceof GmailError && e.status === 404) return [];
    throw e;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* ── 取り込み ─────────────────────────────────────────────── */

export async function runGmailSync(
  supabase: SupabaseClient<Database>,
  state: ConnectedGmail,
  input: { workspaceId: string; memberId: string; workspaceDomain: string | null }
): Promise<SyncResult> {
  const { workspaceId, memberId } = input;
  const [{ data: contacts, error: contactError }, { data: members }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, email, company_id, mail_watch")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .not("email", "is", null)
      .limit(5000),
    supabase.from("workspace_members").select("email").eq("workspace_id", workspaceId),
  ]);
  if (contactError) return { error: contactError.message };

  // 社内のアドレス。メンバー本人たちと、連携した Google アカウント、ワークスペースのドメイン
  const internal = new Set(
    [...(members ?? []).map((m) => m.email), state.email]
      .filter((e): e is string => Boolean(e))
      .map((e) => e.trim().toLowerCase())
  );
  const wsDomain = input.workspaceDomain?.toLowerCase() ?? null;
  const internalDomain = wsDomain && !FREE_MAIL_DOMAINS.has(wsDomain) ? wsDomain : null;
  const isInternal = (email: string) =>
    internal.has(email) || (internalDomain !== null && domainOf(email) === internalDomain);

  const watched = new Map<string, WatchedContact>();
  const unwatched = new Set<string>();
  const domains = new Map<string, string>();
  for (const c of contacts ?? []) {
    const email = c.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || isInternal(email)) continue;
    if (!c.mail_watch) {
      unwatched.add(email);
      continue;
    }
    if (!watched.has(email)) watched.set(email, { contactId: c.id, companyId: c.company_id });
    const d = domainOf(email);
    if (c.company_id && !FREE_MAIL_DOMAINS.has(d) && !domains.has(d)) domains.set(d, c.company_id);
  }
  // 取り込まない相手と同じアドレスが、別の名刺で「取り込む」になっていたら、取り込むほうを優先
  for (const email of watched.keys()) unwatched.delete(email);

  const scope = state.scope;
  // 前回から（1時間ぶん重ねる）。初めてなら直近90日
  const incremental = state.lastSyncAt ? new Date(new Date(state.lastSyncAt).getTime() - 3600_000) : null;
  // 前回が上限で打ち切りなら、同じ期間をもう一度見て、まだ読んでいないスレッドを続きから読む
  const backlog = state.stats?.backlog;
  const scopeSince = backlog ? (backlog.since ? new Date(backlog.since) : null) : incremental;
  const queries = buildQueries(scope, [...watched.keys()], [...domains.keys()], scopeSince);

  const ctx: MatchContext = { scope, watched, unwatched, domains, isInternal };
  const windowOf = (d: Date | null) => (d ? `after:${Math.floor(d.getTime() / 1000)}` : "newer_than:90d");

  try {
    // これまでに自分が取り込んだスレッド
    const { data: known } = await supabase
      .from("mails")
      .select("gmail_thread_id")
      .eq("workspace_id", workspaceId)
      .eq("imported_by", memberId)
      .not("gmail_thread_id", "is", null)
      .gte("sent_at", new Date(Date.now() - 100 * 86400_000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(2000);
    const knownThreads = new Set((known ?? []).map((k) => k.gmail_thread_id as string));

    // ① 取り込んだスレッドに来た新しい返信。範囲の外の人（相手の同僚など）からでも入れる。いちばん先に読む
    const recentKnown = knownThreads.size
      ? (await listThreadIds(state.token, `${windowOf(incremental)} -category:promotions -category:social`, 200)).filter(
          (id) => knownThreads.has(id)
        )
      : [];
    const hasNews = new Set(recentKnown);

    // ② 範囲に入るスレッド。続きから読むときは、もう読んだスレッドを飛ばす
    const found: string[] = [];
    for (const q of queries) {
      if (found.length >= MAX_THREADS * 3) break;
      // 上限より少し多く数えて、打ち切りになるかを知る
      const ids = await listThreadIds(state.token, q, backlog ? 400 : MAX_THREADS + 20);
      found.push(...(backlog ? ids.filter((id) => !knownThreads.has(id) || hasNews.has(id)) : ids));
    }

    const ordered = Array.from(new Set([...recentKnown, ...found]));
    const ids = ordered.slice(0, MAX_THREADS);
    const capped = ordered.length > ids.length;
    const threads = await mapLimit(ids, PARALLEL, (id) => getThread(state.token, id));

    let ads = 0;
    let skipped = 0;
    const byRfc = new Map<string, MailRow>();
    for (const messages of threads) {
      const r = threadToRows(messages, ctx);
      ads += r.ads;
      skipped += r.skipped;
      for (const row of r.rows) if (!byRfc.has(row.rfc_message_id)) byRfc.set(row.rfc_message_id, row);
    }
    const rows = [...byRfc.values()];

    // ③ 保存。すでにある（ほかのメンバーが取り込んだ）ものは入れ直さず、返信済みだけ追いつかせる
    const existing = new Map<string, { id: string; replied: boolean }>();
    for (const part of chunks(rows.map((r) => r.rfc_message_id), 40)) {
      const { data, error } = await supabase
        .from("mails")
        .select("id, rfc_message_id, replied")
        .eq("workspace_id", workspaceId)
        .in("rfc_message_id", part);
      if (error) {
        if (/rfc_message_id|imported_by|column/i.test(error.message)) {
          return { error: "データベースの更新（021）がまだです。" };
        }
        return { error: error.message };
      }
      for (const m of data ?? []) existing.set(m.rfc_message_id as string, { id: m.id, replied: m.replied });
    }

    const fresh = rows.filter((r) => !existing.has(r.rfc_message_id));
    for (const part of chunks(fresh, 50)) {
      const { error } = await supabase.from("mails").upsert(
        part.map((r) => ({ ...r, workspace_id: workspaceId, imported_by: memberId })),
        { onConflict: "workspace_id,rfc_message_id", ignoreDuplicates: true }
      );
      if (error) return { error: error.message };
    }

    const nowReplied = rows
      .filter((r) => r.replied && existing.get(r.rfc_message_id)?.replied === false)
      .map((r) => existing.get(r.rfc_message_id)!.id);
    for (const part of chunks(nowReplied, 100)) {
      await supabase.from("mails").update({ replied: true }).in("id", part).eq("workspace_id", workspaceId);
    }

    const stats: GmailStats = {
      at: new Date().toISOString(),
      imported: fresh.length,
      updated: nowReplied.length,
      threads: ids.length,
      ads,
      skipped,
      capped,
      backlog: capped ? { since: scopeSince?.toISOString() ?? null } : null,
    };
    await supabase.rpc("mark_gmail_synced", { p_workspace_id: workspaceId, p_stats: stats });

    return { ok: true, stats };
  } catch (e) {
    if (e instanceof GmailError) {
      console.error(`[gmail] 取り込みに失敗 status=${e.status} ${e.message}`);
      if (e.status === 401) return { error: "Google との連携が切れています。もう一度つないでください。", reconnect: true };
      if (e.status === 403 && /scope|permission/i.test(e.message)) {
        return { error: "Gmail を読む許可がありません。もう一度つないでください。", reconnect: true };
      }
      if (e.status === 403 && /has not been used|disabled/i.test(e.message)) {
        return { error: "Google Cloud で Gmail API が有効になっていません。" };
      }
      if (e.status === 429) return { error: "Gmail への問い合わせが多すぎました。少し待ってからもう一度お試しください。" };
      return { error: `Gmail から読めませんでした（${e.message}）` };
    }
    throw e;
  }
}
