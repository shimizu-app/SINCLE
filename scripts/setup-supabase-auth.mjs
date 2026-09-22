#!/usr/bin/env node
/**
 * Supabase の認証設定をコードから流し込む。
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:auth
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:auth -- --site-url https://syncle.vercel.app
 *
 * ダッシュボードの Authentication → URL Configuration と
 * Email Templates を手で触る代わりになる。
 *
 * トークンは https://supabase.com/dashboard/account/tokens で発行する。
 * 全プロジェクトを操作できるので、終わったら失効させること。
 *
 * 方針：項目名を推測して PATCH しない。
 * 先に GET して、返ってきた設定に存在する項目だけを更新する。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";

/* ── 入力 ───────────────────────────────────────────── */

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  fail(
    "SUPABASE_ACCESS_TOKEN がありません。\n" +
      "  https://supabase.com/dashboard/account/tokens で発行して、\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:auth のように渡してください。"
  );
}

const envLocal = readEnvLocal();
const args = parseArgs(process.argv.slice(2));

const projectRef =
  args["project-ref"] ??
  process.env.SUPABASE_PROJECT_REF ??
  refFromUrl(envLocal.NEXT_PUBLIC_SUPABASE_URL);

if (!projectRef) {
  fail(
    "プロジェクトの ref が分かりません。\n" +
      "  --project-ref xxxx を渡すか、.env.local に NEXT_PUBLIC_SUPABASE_URL を入れてください。"
  );
}

const siteUrl =
  args["site-url"] ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  envLocal.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

// 許可するリダイレクト先。Site URL 配下は明示しないと通らない。
const redirectUrls = unique([
  "http://localhost:3000/**",
  `${stripSlash(siteUrl)}/**`,
  ...(args["redirect"] ? args["redirect"].split(",") : []),
]);

const magicLink = readFileSync(join(ROOT, "supabase/templates/magic-link.html"), "utf8").trim();
const confirmation = readFileSync(join(ROOT, "supabase/templates/confirmation.html"), "utf8").trim();

/* ── 流し込みたい設定 ───────────────────────────────── */

// URL の設定と、メールの雛形は分けて送る。
// 無料プランで既定のメール送信のままだと雛形の変更が拒否され、
// まとめて送ると URL の設定まで巻き添えで適用されないため。

const urlConfig = {
  site_url: stripSlash(siteUrl),
  uri_allow_list: redirectUrls.join(","),
};

const mailConfig = {
  mailer_subjects_magic_link: "SYNCLE のログインコード {{ .Token }}",
  mailer_templates_magic_link_content: magicLink,

  // 初回ログインの人はこちらが飛ぶ。同じ内容にしておく。
  mailer_subjects_confirmation: "SYNCLE のログインコード {{ .Token }}",
  mailer_templates_confirmation_content: confirmation,
};

const desired = { ...urlConfig, ...mailConfig };

/* ── 実行 ───────────────────────────────────────────── */

console.log(`プロジェクト : ${projectRef}`);
console.log(`Site URL     : ${desired.site_url}`);
console.log(`Redirect URLs: ${redirectUrls.join(" / ")}\n`);

const before = await call("GET", `/projects/${projectRef}/config/auth`);

// 返ってきた設定に無い項目は送らない（項目名の推測で壊さないため）
const known = {};
const unknown = [];
for (const [key, value] of Object.entries(desired)) {
  if (key in before) known[key] = value;
  else unknown.push(key);
}

if (unknown.length) {
  console.warn("⚠ この項目はいまの API の設定に見当たらないので送りません:");
  for (const key of unknown) console.warn(`   - ${key}`);
  console.warn("  Supabase 側の項目名が変わった可能性があります。\n");
}

if (!Object.keys(known).length) {
  fail("送れる項目がありませんでした。");
}

console.log("変更する項目:");
for (const key of Object.keys(known)) {
  console.log(`   ${sameValue(before[key], known[key]) ? "・" : "→"} ${key}${sameValue(before[key], known[key]) ? "（変更なし）" : ""}`);
}
console.log();

const pick = (source) =>
  Object.fromEntries(Object.entries(known).filter(([key]) => key in source));

const urlPart = pick(urlConfig);
const mailPart = pick(mailConfig);

// URL の設定を先に。ここは必ず通したい。
if (Object.keys(urlPart).length) {
  await call("PATCH", `/projects/${projectRef}/config/auth`, urlPart);
}

// 雛形はプランによって拒否される。断られても URL の設定は残す。
let mailSkipped = null;
if (Object.keys(mailPart).length) {
  const result = await call("PATCH", `/projects/${projectRef}/config/auth`, mailPart, {
    allowFailure: true,
  });
  if (result.error) {
    mailSkipped = result.message;
    for (const key of Object.keys(mailPart)) delete known[key];
  }
}

/* ── 確認（書けたかを読み直す） ─────────────────────── */

const after = await call("GET", `/projects/${projectRef}/config/auth`);

let ok = true;
console.log("結果:");
for (const [key, value] of Object.entries(known)) {
  const applied = sameValue(after[key], value);
  if (!applied) ok = false;
  console.log(`   ${applied ? "✓" : "✗"} ${key}`);
  if (!applied) {
    console.log(`       期待: ${preview(value)}`);
    console.log(`       実際: ${preview(after[key])}`);
  }
}

if (!ok) {
  fail("\n反映されなかった項目があります。上の差分を確認してください。");
}

if (mailSkipped) {
  console.log("\nURL の設定は入りました。");
  console.log("ただしメールの雛形は Supabase 側に断られました:");
  console.log(`  ${mailSkipped}`);
  console.log("");
  console.log("無料プランで既定のメール送信を使っている間は雛形を変えられません。");
  console.log("6桁コードを出すには、独自SMTP（Resend など）を設定してから");
  console.log("もう一度このコマンドを流してください。");
  console.log("それまではメール内のリンクからログインできます。");
} else {
  console.log("\n完了しました。メールに6桁コードが出るようになります。");
}

/* ── 小物 ───────────────────────────────────────────── */

async function call(method, path, body, { allowFailure = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    if (allowFailure) {
      let message = text.slice(0, 300);
      try {
        message = JSON.parse(text).message ?? message;
      } catch {
        // JSON でなければ本文をそのまま使う
      }
      return { error: true, status: res.status, message };
    }
    if (res.status === 401) fail("トークンが無効です（401）。発行し直してください。");
    if (res.status === 403) fail("このトークンではこのプロジェクトを操作できません（403）。");
    if (res.status === 404) fail(`プロジェクト ${projectRef} が見つかりません（404）。`);
    fail(`${method} ${path} が ${res.status} を返しました。\n${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

function readEnvLocal() {
  try {
    const out = {};
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

function refFromUrl(url) {
  return url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      out[key] = value;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

// アロー関数を const で置くと巻き上がらず、上のほうから呼べない
function stripSlash(v) {
  return v.replace(/\/+$/, "");
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function sameValue(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function preview(v) {
  return String(v ?? "").replace(/\s+/g, " ").slice(0, 90);
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}
