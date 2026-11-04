import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_THREADS, runGmailSync, type ConnectedGmail } from "../lib/gmail-sync";

/*
 * Gmail から読んで保存するまでを、偽物の Gmail と偽物のデータベースで通しで動かす。
 * 本物の Google にも Supabase にも繋がない。
 */

const WS = "ws1";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

/* ── 偽物のデータベース（runGmailSync が使う分だけ） ── */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { contacts: [], workspace_members: [], mails: [] };
const rpcCalls: [string, unknown][] = [];

class Query {
  table: string;
  filters: ((r: Row) => boolean)[] = [];
  op: "select" | "upsert" | "update" = "select";
  rows: Row[] = [];
  patch: Row = {};
  max = Infinity;
  sort: [string, boolean] | null = null;
  constructor(table: string) {
    this.table = table;
  }
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c: string, _op: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) !== v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  order(c: string, o: { ascending: boolean }) { this.sort = [c, o.ascending]; return this; }
  limit(n: number) { this.max = n; return this; }
  upsert(rows: Row[]) { this.op = "upsert"; this.rows = rows; return this; }
  update(patch: Row) { this.op = "update"; this.patch = patch; return this; }
  then<T>(ok: (v: { data: Row[] | null; error: null }) => T) {
    return Promise.resolve(this.run()).then(ok);
  }
  run(): { data: Row[] | null; error: null } {
    const t = db[this.table];
    if (this.op === "upsert") {
      // on conflict (workspace_id, rfc_message_id) do nothing
      for (const r of this.rows) {
        if (t.some((x) => x.workspace_id === r.workspace_id && x.rfc_message_id === r.rfc_message_id)) continue;
        t.push({ id: `m${t.length + 1}`, ...r });
      }
      return { data: null, error: null };
    }
    let rows = t.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      rows.forEach((r) => Object.assign(r, this.patch));
      return { data: null, error: null };
    }
    if (this.sort) {
      const [c, asc] = this.sort;
      rows = [...rows].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1));
    }
    return { data: rows.slice(0, this.max).map((r) => ({ ...r })), error: null };
  }
}

const supabase = {
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: { p_stats?: unknown }) => {
    rpcCalls.push([name, args]);
    return { data: null, error: null };
  },
} as never;

/* ── 偽物の Gmail ── */

type Msg = { id: string; threadId: string; labelIds: string[]; internalDate: string; payload: unknown };
const threads = new Map<string, Msg[]>();
const queries: string[] = [];
let seq = 0;

function addMsg(threadId: string, from: string, to: string, labels: string[], at: number, mid?: string) {
  seq++;
  const m: Msg = {
    id: `g${seq}`,
    threadId,
    labelIds: labels,
    internalDate: String(at),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: from },
        { name: "To", value: to },
        { name: "Subject", value: `件名 ${threadId}` },
        { name: "Message-ID", value: `<${mid ?? `rfc-${seq}`}@x>` },
      ],
      body: { data: b64(`本文 ${seq}`) },
    },
  };
  threads.set(threadId, [...(threads.get(threadId) ?? []), m]);
}

const latest = (ms: Msg[]) => Math.max(...ms.map((m) => Number(m.internalDate)));

globalThis.fetch = (async (input: string | URL) => {
  const url = new URL(String(input));
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  if (url.pathname.endsWith("/threads")) {
    const q = url.searchParams.get("q") ?? "";
    queries.push(q);
    const after = /after:(\d+)/.exec(q)?.[1];
    // 新しいものから。after: だけは本物と同じく効かせる（ほかの条件は全部当てはまる扱い）
    const list = [...threads.entries()]
      .filter(([, ms]) => !after || ms.some((m) => Number(m.internalDate) / 1000 > Number(after)))
      .sort((a, b) => latest(b[1]) - latest(a[1]))
      .map(([id]) => ({ id }));
    const max = Number(url.searchParams.get("maxResults"));
    const start = Number(url.searchParams.get("pageToken") ?? 0);
    return json({
      threads: list.slice(start, start + max),
      nextPageToken: start + max < list.length ? String(start + max) : undefined,
    });
  }
  const m = /\/threads\/([^/?]+)$/.exec(url.pathname);
  if (m) return json({ messages: threads.get(decodeURIComponent(m[1])) ?? [] });
  return new Response("{}", { status: 404 });
}) as typeof fetch;

/* ── 確かめる ── */

db.contacts.push({ id: "ct1", email: "Taro@Client.co.jp", company_id: "co1", mail_watch: true, workspace_id: WS, archived_at: null });
db.workspace_members.push({ email: "me@nico-inc.net", workspace_id: WS }, { email: "kana@nico-inc.net", workspace_id: WS });

let state: ConnectedGmail = { email: "me@nico-inc.net", token: "tok", scope: "registered", lastSyncAt: null, stats: null };
const me = { workspaceId: WS, memberId: "mem-me", workspaceDomain: "nico-inc.net" };
const now = Date.now();

/** 1回取り込んで、次の取り込みのために「前回」を進める（mark_gmail_synced の代わり） */
async function sync(who = me) {
  const r = await runGmailSync(supabase, state, who);
  if ("ok" in r) state = { ...state, lastSyncAt: new Date().toISOString(), stats: r.stats };
  return r;
}

const mails = () => db.mails as { rfc_message_id: string; from_email: string; gmail_thread_id: string; [k: string]: unknown }[];

test("初回：相手とのやりとりが入り、社内どうしは入らない。返信済みもわかる", async () => {
  addMsg("t1", "Taro <taro@client.co.jp>", "me@nico-inc.net", ["INBOX"], now - 5 * 86400_000, "first");
  addMsg("t1", "me@nico-inc.net", "taro@client.co.jp", ["SENT"], now - 4 * 86400_000);
  addMsg("t2", "kana@nico-inc.net", "me@nico-inc.net", ["INBOX"], now - 3 * 86400_000);

  const r = await sync();
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(r.stats.imported, 2);
  assert.equal(r.stats.skipped, 1);
  assert.equal(mails().length, 2);

  const first = mails().find((m) => m.rfc_message_id === "first@x")!;
  assert.equal(first.replied, true);
  assert.equal(first.contact_id, "ct1");
  assert.equal(first.company_id, "co1");
  assert.equal(first.imported_by, "mem-me");
  assert.equal(first.workspace_id, WS);

  assert.match(queries[0], /from:taro@client\.co\.jp/);
  assert.match(queries[0], /newer_than:90d/);
  assert.equal(rpcCalls.at(-1)?.[0], "mark_gmail_synced");
});

test("2回目：前回以降だけ見る。相手の同僚からの返信も、取り込んだスレッドなら入る", async () => {
  queries.length = 0;
  addMsg("t1", "boss@client-hd.co.jp", "me@nico-inc.net", ["INBOX"], Date.now() + 1000);

  const r = await sync();
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(r.stats.imported, 1);
  assert.ok(queries.every((q) => q.includes("after:")), queries.join("\n"));

  const boss = mails().find((m) => m.from_email === "boss@client-hd.co.jp")!;
  assert.equal(boss.company_id, "co1");
  assert.equal(boss.contact_id, null);
});

test("同じメールを別のメンバーが取り込んでも増えない", async () => {
  const before = mails().length;
  const kana: ConnectedGmail = { ...state, email: "kana@nico-inc.net", lastSyncAt: null, stats: null };
  const r = await runGmailSync(supabase, kana, { ...me, memberId: "mem-kana" });
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(r.stats.imported, 0);
  assert.equal(mails().length, before);
});

test("あとから返信したら、未返信だったメールが返信済みになる", async () => {
  addMsg("t3", "taro@client.co.jp", "me@nico-inc.net", ["INBOX"], Date.now() + 2000, "ask");
  await sync();
  const ask = () => mails().find((m) => m.rfc_message_id === "ask@x")!;
  assert.equal(ask().replied, false);

  addMsg("t3", "me@nico-inc.net", "taro@client.co.jp", ["SENT"], Date.now() + 3000);
  const r = await sync();
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(r.stats.updated, 1);
  assert.equal(ask().replied, true);
});

test(`上限（${MAX_THREADS}スレッド）で打ち切ったら、次は続きから読む`, async () => {
  // 前回の取り込みは2時間前。そのあと（2時間前〜1時間半前）に100スレッド届いていた
  state = { ...state, lastSyncAt: new Date(Date.now() - 2 * 3600_000).toISOString() };
  for (let i = 0; i < 100; i++) {
    addMsg(`bulk${i}`, "taro@client.co.jp", "me@nico-inc.net", ["INBOX"], Date.now() - 2 * 3600_000 + i * 15_000);
  }
  const r1 = await sync();
  assert.ok("ok" in r1, JSON.stringify(r1));
  assert.equal(r1.stats.threads, MAX_THREADS);
  assert.equal(r1.stats.capped, true);
  assert.ok(r1.stats.backlog);

  const r2 = await sync();
  assert.ok("ok" in r2, JSON.stringify(r2));
  assert.equal(r2.stats.capped, false);
  assert.equal(r2.stats.backlog, null);
  assert.equal(mails().filter((m) => m.gmail_thread_id.startsWith("bulk")).length, 100);
});

test("取り込まないにした相手のメールは入らない", async () => {
  db.contacts[0].mail_watch = false;
  addMsg("t9", "taro@client.co.jp", "me@nico-inc.net", ["INBOX"], Date.now() + 500_000);
  const before = mails().length;
  const r = await sync();
  assert.ok("ok" in r, JSON.stringify(r));
  assert.equal(mails().length, before);
  db.contacts[0].mail_watch = true;
});

test("Gmail の許可が足りないと、つなぎ直しを促す", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: "Request had insufficient authentication scopes." } }), {
      status: 403,
    })) as typeof fetch;
  try {
    const r = await sync();
    assert.ok("error" in r);
    assert.equal(r.reconnect, true);
  } finally {
    globalThis.fetch = real;
  }
});
