/**
 * Gmail から受け取ったメールを、mails の行に直す（SPEC 6章 Gmail）。
 *
 * ここはデータベースにも Google にも触らない。中身だけを扱うので、
 * テスト（test/mail-parse.test.ts）からそのまま呼べる。
 *
 * 取り込みのきまり
 *   - 受信箱全体は入れない。登録した相手（名刺のメールアドレス）とのやりとりだけ
 *   - 範囲は3段階：registered（登録した相手だけ）/ domain（会社のドメインまで）/ all（受信箱すべて）
 *   - 取り込んだスレッドの返信は、範囲に関わらず入れる（相手の同僚が返してきた等）
 *   - 広告（プロモーション・ソーシャル）は入れない
 *   - 社内どうしのやりとりは入れない
 *   - 名刺で「取り込まない」にした相手のメールは入れない
 */

export type GmailScope = "registered" | "domain" | "all";

export const GMAIL_SCOPES: { key: GmailScope; label: string; desc: string }[] = [
  {
    key: "registered",
    label: "登録した相手だけ",
    desc: "名刺に載っているメールアドレスとのやりとりだけ。いちばん安全です",
  },
  {
    key: "domain",
    label: "会社のドメインまで",
    desc: "名刺の会社と同じドメイン（@以降）の人も入れます。名刺がまだ無い同僚の方も拾えます",
  },
  {
    key: "all",
    label: "受信箱すべて",
    desc: "広告・お知らせ以外の受信箱のメールを入れます。チームの全員に見えるので注意してください",
  },
];

export const isGmailScope = (v: unknown): v is GmailScope =>
  v === "registered" || v === "domain" || v === "all";

/* ── Gmail API の形（必要なところだけ） ───────────────────── */

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

/* ── アドレス ─────────────────────────────────────────────── */

const ADDRESS = /[^\s<>"',;:()[\]\\]+@[^\s<>"',;:()[\]\\]+\.[^\s<>"',;:()[\]\\]+/g;

/** 「山田 太郎 <taro@example.co.jp>, hanako@example.com」→ ["taro@example.co.jp", "hanako@example.com"] */
export function parseAddresses(header: string | undefined | null): string[] {
  if (!header) return [];
  const found = header.match(ADDRESS) ?? [];
  return Array.from(new Set(found.map((a) => a.toLowerCase().replace(/\.$/, ""))));
}

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** 個人向けのメールサービス。ここのドメインは「会社のドメイン」として扱わない（010 と同じ並び） */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.co.jp", "yahoo.com", "ymail.com", "ybb.ne.jp",
  "outlook.com", "outlook.jp", "hotmail.com", "hotmail.co.jp", "live.jp", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "docomo.ne.jp", "ezweb.ne.jp", "au.com", "softbank.ne.jp", "i.softbank.jp", "vodafone.ne.jp",
  "nifty.com", "ocn.ne.jp", "biglobe.ne.jp", "so-net.ne.jp", "plala.or.jp", "excite.co.jp",
  "zoho.com", "gmx.com", "mail.com", "yandex.com", "qq.com", "163.com",
]);

/** Gmail の検索に入れても壊れないアドレスか（空白・括弧・引用符を含むものは外す） */
const SAFE_FOR_QUERY = /^[^\s{}()"']+@[^\s{}()"']+$/;

/* ── 検索の組み立て ───────────────────────────────────────── */

/**
 * Gmail の検索文を作る。{a b c} は「どれか」の意味。
 * 1本に詰めすぎると Gmail に断られるので、何本かに分ける。
 *
 * since が無ければ（初めての取り込み）直近90日。
 */
export function buildQueries(
  scope: GmailScope,
  addresses: string[],
  domains: string[],
  since: Date | null
): string[] {
  const window = since ? `after:${Math.floor(since.getTime() / 1000)}` : "newer_than:90d";
  const noAds = "-category:promotions -category:social";

  if (scope === "all") {
    return [`{in:inbox in:sent} ${window} ${noAds} -category:updates -category:forums`];
  }

  const safe = addresses.filter((a) => SAFE_FOR_QUERY.test(a));
  // 会社のドメインで拾う範囲なら、そのドメインのアドレスは個別に書かなくてよい
  const byAddress =
    scope === "domain" ? safe.filter((a) => !domains.includes(domainOf(a))) : safe;

  const terms: string[] = [
    ...byAddress.map((a) => `from:${a} to:${a} cc:${a}`),
    ...(scope === "domain"
      ? domains.filter((d) => /^[a-z0-9.-]+$/i.test(d)).map((d) => `from:${d} to:${d} cc:${d}`)
      : []),
  ];

  const out: string[] = [];
  for (let i = 0; i < terms.length; i += 12) {
    out.push(`{${terms.slice(i, i + 12).join(" ")}} ${window} ${noAds}`);
  }
  return out;
}

/* ── 文字コード ───────────────────────────────────────────── */

function decodeBytes(bytes: Uint8Array, charset: string | undefined): string {
  const label = (charset ?? "utf-8").trim().toLowerCase().replace(/^"|"$/g, "");
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    // 知らない文字コード名。UTF-8 として読む（化けても落とさない）
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Gmail の body.data（base64url）を文字にする。日本語のメールは ISO-2022-JP が多い */
export function decodeBody(data: string | undefined, charset?: string): string {
  if (!data) return "";
  const bytes = Uint8Array.from(Buffer.from(data, "base64url"));
  return decodeBytes(bytes, charset);
}

/**
 * 「=?ISO-2022-JP?B?...?=」のような見出しを読む（RFC 2047）。
 * Gmail はたいてい読める形で返してくるが、そうでないものも来るので両方受ける。
 */
export function decodeHeader(value: string | undefined | null): string {
  if (!value) return "";
  // 続けて並んだ符号化語の間の空白は、つなげて読むきまり
  const joined = value.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset: string, enc: string, text: string) => {
    let bytes: Uint8Array;
    if (enc.toUpperCase() === "B") {
      bytes = Uint8Array.from(Buffer.from(text, "base64"));
    } else {
      const q = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
      bytes = Uint8Array.from(q, (c) => c.charCodeAt(0));
    }
    return decodeBytes(bytes, charset);
  });
}

function charsetOf(part: GmailPart): string | undefined {
  const type = part.headers?.find((h) => h.name.toLowerCase() === "content-type")?.value ?? "";
  return /charset\s*=\s*"?([^";\s]+)"?/i.exec(type)?.[1];
}

/* ── 本文 ─────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'",
  yen: "¥", copy: "©", reg: "®", hellip: "…", mdash: "—", ndash: "–",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z#0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 本文を取り出す。プレーンテキストがあればそれ、無ければ HTML を文字にする。添付は読まない */
export function pickBody(payload: GmailPart | undefined): string {
  if (!payload) return "";
  let plain: string | null = null;
  let html: string | null = null;

  const walk = (part: GmailPart) => {
    const type = (part.mimeType ?? "").toLowerCase();
    const isAttachment = Boolean(part.filename) || Boolean(part.body?.attachmentId);
    if (!isAttachment && part.body?.data) {
      if (type === "text/plain" && plain === null) plain = decodeBody(part.body.data, charsetOf(part));
      if (type === "text/html" && html === null) html = decodeBody(part.body.data, charsetOf(part));
    }
    part.parts?.forEach(walk);
  };
  walk(payload);

  const text = plain ?? (html !== null ? htmlToText(html) : "");
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * 返信の下にくっついている引用を落とす。
 * 「On ... wrote:」「2024年1月1日(月) 10:00 山田 <...>:」「-----Original Message-----」と、
 * 「>」で始まる行より下を引用とみなす。
 */
export function stripQuoted(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^>/.test(t)) break;
    if (/^_{8,}$/.test(t)) break; // Outlook の区切り線
    // Outlook の引用見出し（差出人: / 送信日時: / 件名: が続く）
    if (
      /^(差出人|from)\s*[:：]/i.test(t) &&
      lines.slice(i + 1, i + 4).some((l) => /^(送信日時|日時|sent|date|件名|subject)\s*[:：]/i.test(l.trim()))
    ) {
      break;
    }
    if (/^-{2,}\s*(original message|元のメッセージ|転送メッセージ|forwarded message)/i.test(t)) break;
    if (/^on .{4,200} wrote:$/i.test(t)) break;
    if (/^\d{4}[年/.-]\s*\d{1,2}[月/.-]\s*\d{1,2}日?.{0,120}(<[^>]+>|@).{0,40}[:：]$/.test(t)) break;
    if (/^\d{4}[年/.-]\s*\d{1,2}[月/.-]\s*\d{1,2}日?.{0,160}(wrote|書きました|送信)[:：]?$/i.test(t)) break;
    out.push(line);
  }
  const kept = out.join("\n").trim();
  return kept || text.trim();
}

/** 一覧に出す短い抜き出し */
export function excerptOf(text: string, length = 140): string {
  const flat = stripQuoted(text).replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

/* ── スレッド → 行 ────────────────────────────────────────── */

export type WatchedContact = { contactId: string; companyId: string | null };

export type MatchContext = {
  scope: GmailScope;
  /** 取り込む相手（名刺のアドレス → 名刺と会社） */
  watched: Map<string, WatchedContact>;
  /** 名刺で「取り込まない」にした相手 */
  unwatched: Set<string>;
  /** 会社のドメイン → 会社（scope が domain / all のとき使う） */
  domains: Map<string, string>;
  /** 社内のアドレスか（メンバーのアドレスと、ワークスペースのドメイン） */
  isInternal: (email: string) => boolean;
};

export type MailRow = {
  gmail_message_id: string;
  gmail_thread_id: string;
  rfc_message_id: string;
  direction: "in" | "out";
  subject: string;
  body: string;
  excerpt: string;
  from_email: string | null;
  to_email: string | null;
  sent_at: string;
  replied: boolean;
  company_id: string | null;
  contact_id: string | null;
};

export type ThreadResult = { rows: MailRow[]; ads: number; skipped: number };

const BODY_LIMIT = 20_000;

function header(msg: GmailMessage, name: string): string {
  const lower = name.toLowerCase();
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

type Match = { contactId: string | null; companyId: string | null } | "optout" | null;

function matchOf(counterparts: string[], ctx: MatchContext): Match {
  for (const a of counterparts) {
    const hit = ctx.watched.get(a);
    if (hit) return { contactId: hit.contactId, companyId: hit.companyId };
  }
  if (counterparts.some((a) => ctx.unwatched.has(a))) return "optout";
  if (ctx.scope !== "registered") {
    for (const a of counterparts) {
      const company = ctx.domains.get(domainOf(a));
      if (company) return { contactId: null, companyId: company };
    }
  }
  return null;
}

/**
 * 1つのスレッドのメールを、取り込む行に直す。
 *
 * 返信済み（replied）は、受信したメールより後に、こちらから送ったメールが
 * 同じスレッドにあるかで決める。
 */
export function threadToRows(messages: GmailMessage[], ctx: MatchContext): ThreadResult {
  const sorted = [...messages]
    .filter((m) => !(m.labelIds ?? []).some((l) => l === "DRAFT" || l === "SPAM" || l === "TRASH"))
    .sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));

  type Seen = {
    msg: GmailMessage;
    direction: "in" | "out";
    from: string | null;
    to: string[];
    counterparts: string[];
    match: Match;
    ad: boolean;
  };

  const adLabels = new Set(
    ctx.scope === "all"
      ? ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"]
      : ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"]
  );

  const seen: Seen[] = sorted.map((msg) => {
    const labels = msg.labelIds ?? [];
    const direction = labels.includes("SENT") ? "out" : "in";
    const from = parseAddresses(header(msg, "From"))[0] ?? null;
    const to = [...parseAddresses(header(msg, "To")), ...parseAddresses(header(msg, "Cc"))];
    const raw = direction === "in" ? (from ? [from] : []) : to;
    const counterparts = raw.filter((a) => !ctx.isInternal(a));
    return {
      msg,
      direction,
      from,
      to,
      counterparts,
      match: counterparts.length ? matchOf(counterparts, ctx) : null,
      ad: labels.some((l) => adLabels.has(l)),
    };
  });

  // スレッドの会社。最初に相手が分かったメールの会社にする
  const anchor = seen.find((s) => s.match && s.match !== "optout" && !s.ad)?.match as
    | { contactId: string | null; companyId: string | null }
    | undefined;

  let ads = 0;
  let skipped = 0;
  const rows: MailRow[] = [];

  seen.forEach((s, i) => {
    // 社内どうし（相手がいない）は入れない
    if (!s.counterparts.length) return void skipped++;
    if (s.match === "optout") return void skipped++;
    if (s.ad) return void ads++;

    let target: { contactId: string | null; companyId: string | null } | null = null;
    if (s.match) target = s.match;
    else if (anchor) target = { contactId: null, companyId: anchor.companyId }; // 取り込んだスレッドの返信
    else if (ctx.scope === "all") target = { contactId: null, companyId: null };
    if (!target) return void skipped++;

    const text = pickBody(s.msg.payload);
    const replied =
      s.direction === "in" && seen.slice(i + 1).some((later) => later.direction === "out");
    const rfc = header(s.msg, "Message-ID").trim().replace(/^<|>$/g, "");

    rows.push({
      gmail_message_id: s.msg.id,
      gmail_thread_id: s.msg.threadId,
      rfc_message_id: rfc || `gmail:${s.msg.id}`,
      direction: s.direction,
      subject: decodeHeader(header(s.msg, "Subject")).trim().slice(0, 300) || "（件名なし）",
      body: text.slice(0, BODY_LIMIT),
      excerpt: excerptOf(text || s.msg.snippet || ""),
      from_email: s.from,
      to_email: s.to.length ? s.to.join(", ").slice(0, 1000) : null,
      sent_at: new Date(Number(s.msg.internalDate ?? Date.now())).toISOString(),
      replied,
      company_id: target.companyId,
      contact_id: target.contactId,
    });
  });

  return { rows, ads, skipped };
}
