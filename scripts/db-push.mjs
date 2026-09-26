#!/usr/bin/env node
/**
 * supabase/migrations/ の未適用ぶんを順に流す。
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run db:push
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run db:push -- --dry-run
 *
 * Supabase CLI はDBのパスワードを要求するが、Management API は
 * アクセストークンだけで SQL を流せる。適用済みの記録は CLI と同じ
 * supabase_migrations.schema_migrations に残すので、あとから
 * CLI に移っても食い違わない。
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// stamp() が使う。let はトップレベルの処理より前に置かないと
// 一時的死角（TDZ）に入って参照できない。
let lastStamp = 0;
const DIR = join(ROOT, "supabase/migrations");
const API = "https://api.supabase.com/v1";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) fail("SUPABASE_ACCESS_TOKEN がありません。");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  readEnvLocal().NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\./)?.[1];
if (!projectRef) fail("プロジェクトの ref が分かりません。");

/* ── 適用済みの一覧 ─────────────────────────────────────── */

await run(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

// 突き合わせは name 列でする。version は Supabase CLI / MCP が
// 日時で採番するので、ファイル名の連番とは揃わない。
const applied = new Set(
  (await run("select name from supabase_migrations.schema_migrations"))
    .map((r) => r.name)
    .filter(Boolean)
);

/* ── 流す ───────────────────────────────────────────────── */

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const pending = files.filter((f) => !applied.has(nameOf(f)));

console.log(`プロジェクト : ${projectRef}`);
console.log(`適用済み     : ${applied.size} 件`);
console.log(`未適用       : ${pending.length} 件\n`);

if (!pending.length) {
  console.log("流すものはありません。");
  process.exit(0);
}

for (const file of pending) {
  console.log(`${dryRun ? "[dry-run] " : ""}→ ${file}`);
  if (dryRun) continue;

  const sql = readFileSync(join(DIR, file), "utf8");
  try {
    await run(sql);
  } catch (error) {
    fail(`${file} で失敗しました。\n\n${error.message}`);
  }
  await run(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ('${stamp()}', '${nameOf(file).replace(/'/g, "''")}')
     on conflict (version) do nothing`
  );
  console.log("   ✓");
}

console.log("\n完了しました。");

/* ── 小物 ───────────────────────────────────────────────── */

function nameOf(file) {
  // 014_rls_performance.sql → 014_rls_performance
  return file.replace(/\.sql$/, "");
}

/** CLI と同じ採番（YYYYMMDDHHmmss）。同じ秒に2本流れないよう1秒ずらす。 */
function stamp() {
  let now = Math.floor(Date.now() / 1000);
  if (now <= lastStamp) now = lastStamp + 1;
  lastStamp = now;
  const d = new Date(now * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds())
  );
}

async function run(sql) {
  const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 800);
    try {
      message = JSON.parse(text).message ?? message;
    } catch {
      // JSON でなければ本文をそのまま
    }
    throw new Error(message);
  }
  return text ? JSON.parse(text) : [];
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

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}
