import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_MARK,
  SLOTS_MARK,
  draftPrompt,
  fillMarks,
  revisePrompt,
  withSignature,
  type MailContext,
} from "../lib/mail-compose";
import { buildMime, encodeWord, isAddress, toGmailRaw } from "../lib/mime";

const ctx: MailContext = {
  myName: "清水",
  myRole: "営業",
  myCompany: "株式会社NICO",
  companyName: "ミライ精機株式会社",
  industry: "製造",
  employees: 120,
  dealType: "Web制作",
  dealStatus: "提案準備中",
  dealMemo: "採用サイトのリニューアル。予算300万円",
  stage: "提案",
  companyMemo: "社長はスピード重視",
  openTasks: ["提案書を作る"],
  contactName: "佐藤 花子",
  contactTitle: "部長",
  contactDept: "人事部",
  replyTo: null,
  hasSlots: true,
  hasBooking: false,
};

test("下書きの依頼には、SPEC 6章の情報が入る", () => {
  const p = draftPrompt(ctx, { purpose: "提案書の送付", tone: "標準", notes: "来週の打合せの話も" });
  for (const word of ["提案書の送付", "標準", "ミライ精機株式会社", "佐藤 花子", "部長", "人事部", "製造", "120名", "Web制作", "提案準備中", "提案", "社長はスピード重視", "提案書を作る", "来週の打合せの話も", SLOTS_MARK]) {
    assert.ok(p.includes(word), word);
  }
  assert.ok(!p.includes(BOOKING_MARK));
  assert.ok(!/\n{3,}/.test(p));
});

test("返信のときは、元のメールを資料として渡す", () => {
  const p = draftPrompt(
    { ...ctx, hasSlots: false, replyTo: { subject: "お見積について", body: "先日の件です", from: "hanako@mirai.example" } },
    { purpose: "返信", tone: "かなり丁寧", notes: "" }
  );
  assert.ok(p.includes("<返信元のメール>"));
  assert.ok(p.includes("お見積について"));
  assert.ok(p.includes("Re: "));
  assert.ok(p.includes("（特になし）"));
});

test("修正の依頼", () => {
  const p = revisePrompt({ subject: "件名", body: "本文" }, "もう少し短く");
  assert.ok(p.includes("「もう少し短く」"));
  assert.ok(p.includes("<本文>\n本文\n</本文>"));
});

test("候補日時と予約ページは、こちらで差し込む", () => {
  const body = `佐藤様\n\n下記からお選びください。\n${SLOTS_MARK}\n\nよろしくお願いいたします。`;
  const filled = fillMarks(body, { slotsText: "　候補1：11月10日（火）10:00〜11:00" });
  assert.ok(filled.includes("候補1：11月10日"));
  assert.ok(!filled.includes(SLOTS_MARK));

  // 印が無ければ最後に足す
  const appended = fillMarks("佐藤様\n\nよろしくお願いいたします。", { bookingUrl: "https://example.com/booking/x" });
  assert.ok(appended.endsWith("https://example.com/booking/x"));

  // 使わない印は消す
  const cleaned = fillMarks(`本文\n${BOOKING_MARK}\n以上`, {});
  assert.equal(cleaned, "本文\n以上");
});

test("署名は最後に1回だけ", () => {
  const once = withSignature("本文", "――\n清水");
  assert.equal(once, "本文\n\n――\n清水");
  assert.equal(withSignature(once, "――\n清水"), once);
});

test("アドレスの形", () => {
  assert.ok(isAddress("taro@example.co.jp"));
  assert.ok(!isAddress("taro@example"));
  assert.ok(!isAddress("taro@example.com\r\nBcc: x@y.z"));
});

test("日本語の件名は =?UTF-8?B?…?= にする。英字だけならそのまま", () => {
  assert.equal(encodeWord("Hello"), "Hello");
  const w = encodeWord("お見積のご案内");
  assert.match(w, /^=\?UTF-8\?B\?/);
  const decoded = w
    .split("\r\n ")
    .map((part) => Buffer.from(part.slice(10, -2), "base64").toString("utf8"))
    .join("");
  assert.equal(decoded, "お見積のご案内");
  // 長い件名は、文字の途中で切らずに区切る
  const long = encodeWord("あ".repeat(40));
  const back = long
    .split("\r\n ")
    .map((part) => Buffer.from(part.slice(10, -2), "base64").toString("utf8"))
    .join("");
  assert.equal(back, "あ".repeat(40));
});

test("メールの形：改行で見出しを足させない・返信はスレッドにつなぐ", () => {
  const mime = buildMime({
    from: { address: "me@nico.example", name: "清水" },
    to: [{ address: "hanako@mirai.example", name: "佐藤 花子" }],
    subject: "Re: お見積\r\nBcc: evil@example.com",
    body: "佐藤様\n\nありがとうございます。",
    inReplyTo: "<abc@mirai.example>",
  });
  const head = mime.split("\r\n\r\n")[0];
  assert.ok(!/^Bcc:/m.test(head), "改行で Bcc を足せない");
  assert.match(head, /^In-Reply-To: <abc@mirai\.example>$/m);
  assert.match(head, /^References: <abc@mirai\.example>$/m);
  assert.match(head, /^From: =\?UTF-8\?B\?.+\?= <me@nico\.example>$/m);
  assert.match(head, /^Content-Type: text\/plain; charset=UTF-8$/m);
  const body = Buffer.from(mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");
  assert.equal(body, "佐藤様\r\n\r\nありがとうございます。");
  assert.ok(!toGmailRaw(mime).includes("+"));
});
