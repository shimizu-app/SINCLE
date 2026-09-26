#!/usr/bin/env node
/**
 * types/supabase.ts を作り直す。
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:gen
 *
 * Supabase CLI を入れなくても Management API から取れる。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "types/supabase.ts");

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) fail("SUPABASE_ACCESS_TOKEN がありません。");

const ref =
  process.env.SUPABASE_PROJECT_REF ??
  readEnvLocal().NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\./)?.[1];
if (!ref) fail("プロジェクトの ref が分かりません。");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const body = await res.text();
if (!res.ok) fail(`${res.status}: ${body.slice(0, 400)}`);

const types = JSON.parse(body).types;
if (!types) fail("型が返ってきませんでした。");

writeFileSync(
  OUT,
  `// このファイルは自動生成です。手で編集しないでください。\n` +
    `//   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:gen\n` +
    `// 手で定義するユニオン型は types/db.ts にあります。\n\n` +
    types
);
console.log(`types/supabase.ts を更新しました（${types.split("\n").length} 行）`);

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

function fail(m) {
  console.error(`\n${m}\n`);
  process.exit(1);
}
