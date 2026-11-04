import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildQueries,
  decodeBody,
  decodeHeader,
  excerptOf,
  htmlToText,
  parseAddresses,
  pickBody,
  stripQuoted,
  threadToRows,
  type GmailMessage,
  type MatchContext,
} from "../lib/mail-parse";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
// 「こんにちは」を ISO-2022-JP で（日本語のメールで今も多い）
const ISO2022_HELLO = Buffer.from([
  0x1b, 0x24, 0x42, 0x24, 0x33, 0x24, 0x73, 0x24, 0x4b, 0x24, 0x41, 0x24, 0x4f, 0x1b, 0x28, 0x42,
]);

test("アドレスを抜き出す", () => {
  assert.deepEqual(parseAddresses('山田 太郎 <Taro@Example.co.jp>, "Hanako" <hanako@example.com>'), [
    "taro@example.co.jp",
    "hanako@example.com",
  ]);
  assert.deepEqual(parseAddresses("solo@example.com"), ["solo@example.com"]);
  assert.deepEqual(parseAddresses(""), []);
  assert.deepEqual(parseAddresses(undefined), []);
});

test("検索文：登録した相手だけ", () => {
  const [q] = buildQueries("registered", ["a@x.co.jp", "b@y.com"], [], null);
  assert.match(q, /^\{from:a@x\.co\.jp to:a@x\.co\.jp cc:a@x\.co\.jp from:b@y\.com/);
  assert.match(q, /newer_than:90d/);
  assert.match(q, /-category:promotions -category:social/);
});

test("検索文：多いときは分ける・前回からの差分だけ", () => {
  const many = Array.from({ length: 30 }, (_, i) => `p${i}@x.co.jp`);
  const qs = buildQueries("registered", many, [], new Date("2026-01-01T00:00:00Z"));
  assert.equal(qs.length, 3);
  assert.ok(qs.every((q) => q.includes(`after:${Date.parse("2026-01-01T00:00:00Z") / 1000}`)));
});

test("検索文：壊れるアドレスは入れない", () => {
  const [q] = buildQueries("registered", ["ok@x.com", 'bad"q@x.com', "a b@x.com"], [], null);
  assert.ok(q.includes("ok@x.com"));
  assert.ok(!q.includes("bad"));
});

test("検索文：会社のドメインまで", () => {
  const [q] = buildQueries("domain", ["a@x.co.jp", "me@gmail.com"], ["x.co.jp"], null);
  assert.ok(q.includes("from:x.co.jp"));
  // ドメインで拾うので、そのドメインのアドレスは個別に書かない
  assert.ok(!q.includes("from:a@x.co.jp"));
  // 個人のアドレスは個別に
  assert.ok(q.includes("from:me@gmail.com"));
});

test("検索文：受信箱すべて", () => {
  const qs = buildQueries("all", [], [], null);
  assert.equal(qs.length, 1);
  assert.match(qs[0], /in:inbox/);
  assert.match(qs[0], /-category:updates/);
});

test("検索文：相手がいなければ検索しない", () => {
  assert.deepEqual(buildQueries("registered", [], [], null), []);
});

test("見出しの符号化を読む（RFC 2047）", () => {
  assert.equal(decodeHeader(`=?ISO-2022-JP?B?${ISO2022_HELLO.toString("base64")}?=`), "こんにちは");
  assert.equal(decodeHeader("=?UTF-8?Q?=E3=81=8A=E7=A4=BC?= です"), "お礼 です");
  // 並んだ符号化語のあいだの空白は消す
  const a = Buffer.from("見積", "utf8").toString("base64");
  const b = Buffer.from("のご案内", "utf8").toString("base64");
  assert.equal(decodeHeader(`=?UTF-8?B?${a}?= =?UTF-8?B?${b}?=`), "見積のご案内");
  // もう読める形なら、そのまま
  assert.equal(decodeHeader("お打合せのお礼"), "お打合せのお礼");
});

test("本文の文字コード", () => {
  assert.equal(decodeBody(ISO2022_HELLO.toString("base64url"), "ISO-2022-JP"), "こんにちは");
  assert.equal(decodeBody(Buffer.from([0x82, 0xa0]).toString("base64url"), "Shift_JIS"), "あ");
  assert.equal(decodeBody(b64("ok"), "x-unknown-charset"), "ok");
});

test("HTML を文字にする", () => {
  const text = htmlToText(
    "<style>p{color:red}</style><p>山田様</p><p>いつも&nbsp;お世話に&amp;なって<br>おります</p>&#12354;&#x3044;"
  );
  assert.equal(text, "山田様\nいつも お世話に&なって\nおります\nあい");
});

test("本文はプレーンテキストを優先、添付は読まない", () => {
  const body = pickBody({
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: b64("プレーン") } },
          { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
        ],
      },
      { mimeType: "text/plain", filename: "memo.txt", body: { attachmentId: "x", data: b64("添付") } },
    ],
  });
  assert.equal(body, "プレーン");

  const htmlOnly = pickBody({ mimeType: "text/html", body: { data: b64("<div>HTMLだけ</div>") } });
  assert.equal(htmlOnly, "HTMLだけ");

  const jis = pickBody({
    mimeType: "text/plain",
    headers: [{ name: "Content-Type", value: 'text/plain; charset="ISO-2022-JP"' }],
    body: { data: ISO2022_HELLO.toString("base64url") },
  });
  assert.equal(jis, "こんにちは");
});

test("引用を落とす", () => {
  assert.equal(
    stripQuoted("承知しました。\n\n2026年1月5日(月) 10:00 山田 太郎 <taro@x.co.jp>:\n> 先日は"),
    "承知しました。"
  );
  assert.equal(stripQuoted("Thanks!\n\nOn Mon, Jan 5, 2026 at 10:00 AM Taro <t@x.com> wrote:\n> hi"), "Thanks!");
  assert.equal(
    stripQuoted("了解です\n\n差出人: 山田 太郎\n送信日時: 2026年1月5日 10:00\n件名: RE: 見積"),
    "了解です"
  );
  assert.equal(stripQuoted("本文\n-----Original Message-----\n前の"), "本文");
  // 全部が引用でも、空にはしない
  assert.equal(stripQuoted("> 全部引用"), "> 全部引用");
  assert.equal(excerptOf("一行目\n二行目\n> 引用"), "一行目 二行目");
});

/* ── スレッド → 行 ── */

let seq = 0;
function msg(opts: {
  from: string;
  to?: string;
  cc?: string;
  subject?: string;
  labels?: string[];
  at: number;
  body?: string;
  messageId?: string | null;
}): GmailMessage {
  seq++;
  const headers = [
    { name: "From", value: opts.from },
    { name: "To", value: opts.to ?? "" },
    { name: "Cc", value: opts.cc ?? "" },
    { name: "Subject", value: opts.subject ?? "お打合せの件" },
  ];
  if (opts.messageId !== null) headers.push({ name: "Message-ID", value: `<${opts.messageId ?? `m${seq}@mail`}>` });
  return {
    id: `g${seq}`,
    threadId: "t1",
    labelIds: opts.labels ?? ["INBOX"],
    internalDate: String(opts.at),
    payload: { mimeType: "text/plain", headers, body: { data: b64(opts.body ?? "本文です") } },
  };
}

function ctx(over: Partial<MatchContext> = {}): MatchContext {
  return {
    scope: "registered",
    watched: new Map([["taro@client.co.jp", { contactId: "ct-taro", companyId: "co-client" }]]),
    unwatched: new Set(["nope@other.co.jp"]),
    domains: new Map([["client.co.jp", "co-client"]]),
    isInternal: (e) => e.endsWith("@nico-inc.net"),
    ...over,
  };
}

test("登録した相手からのメールは入る。あとで返していれば返信済み", () => {
  const r = threadToRows(
    [
      msg({ from: "山田 太郎 <taro@client.co.jp>", to: "me@nico-inc.net", at: 1000, messageId: "first@client" }),
      msg({ from: "me@nico-inc.net", to: "taro@client.co.jp", labels: ["SENT"], at: 2000 }),
    ],
    ctx()
  );
  assert.equal(r.rows.length, 2);
  const [first, reply] = r.rows;
  assert.equal(first.direction, "in");
  assert.equal(first.replied, true);
  assert.equal(first.contact_id, "ct-taro");
  assert.equal(first.company_id, "co-client");
  assert.equal(first.rfc_message_id, "first@client");
  assert.equal(first.from_email, "taro@client.co.jp");
  assert.equal(reply.direction, "out");
  assert.equal(reply.replied, false);
  assert.equal(reply.contact_id, "ct-taro");
});

test("まだ返していなければ未返信", () => {
  const r = threadToRows([msg({ from: "taro@client.co.jp", to: "me@nico-inc.net", at: 1000 })], ctx());
  assert.equal(r.rows[0].replied, false);
});

test("取り込んだスレッドへの返信は、名刺の無い人からでも入る", () => {
  const r = threadToRows(
    [
      msg({ from: "me@nico-inc.net", to: "taro@client.co.jp", labels: ["SENT"], at: 1000 }),
      msg({ from: "boss@client-hd.co.jp", to: "me@nico-inc.net", at: 2000 }),
    ],
    ctx()
  );
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].company_id, "co-client");
  assert.equal(r.rows[1].contact_id, null);
});

test("社内どうし・広告・取り込まない相手は入れない", () => {
  const r = threadToRows(
    [
      msg({ from: "taro@client.co.jp", to: "me@nico-inc.net", at: 1000 }),
      msg({ from: "colleague@nico-inc.net", to: "me@nico-inc.net", at: 2000 }),
      msg({ from: "taro@client.co.jp", to: "me@nico-inc.net", labels: ["INBOX", "CATEGORY_PROMOTIONS"], at: 3000 }),
      msg({ from: "nope@other.co.jp", to: "me@nico-inc.net", at: 4000 }),
    ],
    ctx()
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.ads, 1);
  assert.equal(r.skipped, 2);
});

test("下書き・迷惑メールは数えもしない", () => {
  const r = threadToRows(
    [
      msg({ from: "me@nico-inc.net", to: "taro@client.co.jp", labels: ["DRAFT"], at: 1000 }),
      msg({ from: "taro@client.co.jp", to: "me@nico-inc.net", labels: ["SPAM"], at: 2000 }),
    ],
    ctx()
  );
  assert.deepEqual(r, { rows: [], ads: 0, skipped: 0 });
});

test("知らない相手：登録した相手だけなら入れない、ドメインまでなら会社で拾う", () => {
  const one = [msg({ from: "hanako@client.co.jp", to: "me@nico-inc.net", at: 1000 })];
  assert.equal(threadToRows(one, ctx()).rows.length, 0);

  const r = threadToRows(one, ctx({ scope: "domain" }));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].company_id, "co-client");
  assert.equal(r.rows[0].contact_id, null);
});

test("受信箱すべて：会社が分からなくても入る。お知らせは入れない", () => {
  const r = threadToRows(
    [
      msg({ from: "someone@elsewhere.jp", to: "me@nico-inc.net", at: 1000 }),
      msg({ from: "news@elsewhere.jp", to: "me@nico-inc.net", labels: ["INBOX", "CATEGORY_UPDATES"], at: 2000 }),
    ],
    ctx({ scope: "all" })
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].company_id, null);
  assert.equal(r.ads, 1);
});

test("送ったメールは宛先と CC から相手を探す", () => {
  const r = threadToRows(
    [msg({ from: "me@nico-inc.net", to: "colleague@nico-inc.net", cc: "Taro <taro@client.co.jp>", labels: ["SENT"], at: 1000 })],
    ctx()
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].contact_id, "ct-taro");
  assert.equal(r.rows[0].to_email, "colleague@nico-inc.net, taro@client.co.jp");
});

test("件名なし・Message-ID なし", () => {
  const m = msg({ from: "taro@client.co.jp", to: "me@nico-inc.net", subject: "", at: 1000, messageId: null });
  const [row] = threadToRows([m], ctx()).rows;
  assert.equal(row.subject, "（件名なし）");
  assert.equal(row.rfc_message_id, `gmail:${m.id}`);
  assert.equal(row.sent_at, new Date(1000).toISOString());
});
