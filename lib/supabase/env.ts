/**
 * Supabase の接続情報。
 *
 * NEXT_PUBLIC_ の値はビルド時にコードへ焼き込まれるため、
 * 参照はこの形（process.env.NEXT_PUBLIC_XXX）のまま書く。
 * 変数に入れて組み立てると置換されない。
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type Problem = { name: string; reason: string };

/**
 * 使えない環境変数を、理由つきで返す。揃っていれば空配列。
 *
 * 「名前ごと無い」のか「名前はあるが中身が空」なのかで直し方が違う。
 * Vercel は空の値でも変数として登録できてしまい、
 * 追加しようとすると「既にある」と言われる一方で
 * ビルドからは使えない、という状態になる。
 */
export function checkSupabaseEnv(): Problem[] {
  return [
    { name: "NEXT_PUBLIC_SUPABASE_URL", value: SUPABASE_URL },
    { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: SUPABASE_KEY },
  ]
    .map(({ name, value }) => {
      if (value === undefined) return { name, reason: "未設定（変数そのものが無い）" };
      if (value.trim() === "") return { name, reason: "空（名前はあるが中身が入っていない）" };
      return null;
    })
    .filter((problem): problem is Problem => problem !== null);
}

/** 足りない環境変数の名前だけを返す。 */
export function missingSupabaseEnv(): string[] {
  return checkSupabaseEnv().map((problem) => problem.name);
}

export function supabaseEnvMessage(problems: Problem[] = checkSupabaseEnv()): string {
  const empty = problems.some((problem) => problem.reason.startsWith("空"));

  return [
    "SYNCLE: 環境変数が使えません。",
    "",
    ...problems.map((problem) => `  - ${problem.name} … ${problem.reason}`),
    "",
    "ローカル → .env.local に入れる（.env.example が見本です）",
    "Vercel   → Settings → Environment Variables に入れて Redeploy",
    "",
    ...(empty
      ? [
          "「空」と出ているものは、いったん削除してから入れ直してください。",
          "値を上書きするより、消して作り直すほうが確実です。",
          "",
        ]
      : []),
    "NEXT_PUBLIC_ の値はビルド時に焼き込まれるため、",
    "あとから足した場合は必ず Redeploy が必要です。",
  ].join("\n");
}

/** 使えなければ、何がどう駄目かを書いて落とす。 */
export function requireSupabaseEnv(): { url: string; key: string } {
  const problems = checkSupabaseEnv();
  if (problems.length) throw new Error(supabaseEnvMessage(problems));
  return { url: SUPABASE_URL!, key: SUPABASE_KEY! };
}
