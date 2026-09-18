/**
 * 認証後の戻り先。外部サイトへ飛ばされないよう、
 * 自サイト内の絶対パスだけを通す。
 */
export function safeNext(value: string | undefined | null, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//example.com" はブラウザが外部URLとして解釈する
  if (value.startsWith("//")) return fallback;
  return value;
}
