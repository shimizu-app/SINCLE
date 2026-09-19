/**
 * Supabase の接続情報。
 *
 * NEXT_PUBLIC_ の値はビルド時にコードへ焼き込まれるため、
 * 参照はこの形（process.env.NEXT_PUBLIC_XXX）のまま書く。
 * 変数に入れて組み立てると置換されない。
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 足りない環境変数の名前を返す。揃っていれば空配列。 */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

export function supabaseEnvMessage(missing: string[]): string {
  return [
    "SYNCLE: 環境変数が設定されていません。",
    "",
    ...missing.map((name) => `  - ${name}`),
    "",
    "ローカル → .env.local に入れる（.env.example が見本です）",
    "Vercel   → Settings → Environment Variables に入れて Redeploy",
    "",
    "NEXT_PUBLIC_ の値はビルド時に焼き込まれるため、",
    "あとから足した場合は必ず Redeploy が必要です。",
  ].join("\n");
}

/** 揃っていなければ、何が足りないかを書いて落とす。 */
export function requireSupabaseEnv(): { url: string; key: string } {
  const missing = missingSupabaseEnv();
  if (missing.length) throw new Error(supabaseEnvMessage(missing));
  return { url: SUPABASE_URL!, key: SUPABASE_KEY! };
}
