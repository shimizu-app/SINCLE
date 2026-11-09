/**
 * Gmail で送るメールの形（RFC 5322 / MIME）を組み立てる。
 * Gmail API の messages.send は、組み立てたメールを base64url で受け取る。
 *
 * 日本語の件名・名前は RFC 2047（=?UTF-8?B?…?=）で、本文は UTF-8 を base64 で送る。
 * 宛先や件名に改行を混ぜると、見出しを勝手に足せてしまう（ヘッダー・インジェクション）。
 * 改行は入れさせない。
 */

const ADDRESS = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;

export function isAddress(s: string): boolean {
  return ADDRESS.test(s.trim());
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** 英数字だけならそのまま、日本語などが入っていれば =?UTF-8?B?…?= にする */
export function encodeWord(text: string): string {
  const t = oneLine(text);
  if (/^[\x20-\x7e]*$/.test(t)) return t;
  // 長い件名は 45 バイトほどに区切って並べる（1行が長くなりすぎないように）
  const bytes = Buffer.from(t, "utf8");
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + 45, bytes.length);
    // UTF-8 の文字の途中で切らない
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(`=?UTF-8?B?${bytes.subarray(start, end).toString("base64")}?=`);
    start = end;
  }
  return parts.join("\r\n ");
}

function mailbox(address: string, name?: string | null): string {
  const a = oneLine(address);
  if (!name) return a;
  const n = oneLine(name).replace(/"/g, "");
  return `${/^[\x20-\x7e]*$/.test(n) ? `"${n}"` : encodeWord(n)} <${a}>`;
}

export type OutgoingMail = {
  from: { address: string; name?: string | null };
  to: { address: string; name?: string | null }[];
  cc?: { address: string; name?: string | null }[];
  subject: string;
  body: string;
  /** 返信のとき、元のメールの Message-ID（スレッドにつなぐ） */
  inReplyTo?: string | null;
  messageId?: string | null;
};

export function buildMime(mail: OutgoingMail): string {
  const headers = [
    `From: ${mailbox(mail.from.address, mail.from.name)}`,
    `To: ${mail.to.map((t) => mailbox(t.address, t.name)).join(", ")}`,
    mail.cc?.length ? `Cc: ${mail.cc.map((t) => mailbox(t.address, t.name)).join(", ")}` : "",
    `Subject: ${encodeWord(mail.subject)}`,
    mail.messageId ? `Message-ID: <${oneLine(mail.messageId).replace(/^<|>$/g, "")}>` : "",
    mail.inReplyTo ? `In-Reply-To: <${oneLine(mail.inReplyTo).replace(/^<|>$/g, "")}>` : "",
    mail.inReplyTo ? `References: <${oneLine(mail.inReplyTo).replace(/^<|>$/g, "")}>` : "",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);

  const encoded = Buffer.from(mail.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64");
  const wrapped = encoded.replace(/.{1,76}/g, (line) => `${line}\r\n`);
  return `${headers.join("\r\n")}\r\n\r\n${wrapped}`;
}

/** Gmail API の raw に入れる形 */
export function toGmailRaw(mime: string): string {
  return Buffer.from(mime, "utf8").toString("base64url");
}
