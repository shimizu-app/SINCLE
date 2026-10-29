/**
 * Supabase の認証エラーを、日本語の「次にどうするか」に言い換える。
 *
 * これまで error.message をそのまま出していたので、
 * 画面に英語のまま出て、何が起きたのか分からなかった。
 * とくに繋がらないときは iOS Safari が "Load failed"、
 * Chrome が "Failed to fetch" と言うだけで、原因が読めない。
 *
 * 当てはまらないものは、元の文も添えて出す。黙って握りつぶさない。
 */

type SupabaseAuthError = { message?: string; status?: number; code?: string };

const RULES: [RegExp, string][] = [
  // 繋がらない。プロジェクトの一時停止、圏外、通信の遮断。
  [
    /load failed|failed to fetch|networkerror|network request failed|err_internet/i,
    "サーバーに繋がりませんでした。電波を確かめてもう一度お試しください。" +
      "それでも駄目なら、Supabase のプロジェクトが一時停止している可能性があります。",
  ],
  // 送りすぎ
  [
    /rate limit|too many requests/i,
    "送信の回数制限に達しました。しばらく待ってからもう一度お試しください。",
  ],
  [
    /you can only request this after (\d+) seconds?/i,
    "少し間を置いてからもう一度お送りください。",
  ],
  // メールが出ていかない（送信の設定・送信先の制限）
  [
    /error sending|smtp|email.*(failed|error)/i,
    "ログイン用のメールを送れませんでした。メール送信の設定を確かめてください。" +
      "（独自ドメインの認証が済んでいないと、持ち主以外には届きません）",
  ],
  // 新規登録が止められている
  [
    /signups? not allowed|signup is disabled/i,
    "このメールアドレスは新しく登録できません。管理者に登録してもらってからお試しください。",
  ],
  // アドレスの形
  [
    /invalid format|unable to validate email/i,
    "メールアドレスの形が正しくないようです。打ち間違いがないか確かめてください。",
  ],
  // コードが違う・切れた
  [
    /token has expired|invalid token|otp.*(expired|invalid)|invalid.*otp/i,
    "コードが違うか、期限が切れています。もう一度お送りください。",
  ],
];

export function authErrorText(error: SupabaseAuthError | null | undefined): string {
  if (!error) return "うまくいきませんでした。もう一度お試しください。";

  const raw = (error.message ?? "").trim();

  if (error.status === 429) {
    return "送信の回数制限に達しました。しばらく待ってからもう一度お試しください。";
  }

  for (const [pattern, text] of RULES) {
    if (pattern.test(raw)) return text;
  }

  // 知らないものは、こちらで原因を追えるように元の文を見せる
  return raw
    ? `うまくいきませんでした。もう一度お試しください。（${raw}）`
    : "うまくいきませんでした。もう一度お試しください。";
}

/** 通信そのものが届いていないか。画面の出し分けに使う。 */
export function isOffline(error: SupabaseAuthError | null | undefined): boolean {
  return /load failed|failed to fetch|networkerror|network request failed/i.test(
    error?.message ?? ""
  );
}

/**
 * Supabase に問い合わせそのものが届かなかったか。
 *
 * 「ログインしていない」と「Supabase に繋がらない」は別物。
 * 混ぜると、繋がらないだけの人を未ログイン扱いで追い出してしまう。
 *
 * 未ログインのときは 400（AuthSessionMissingError）。
 * 届かなかったときは status が 0 か 5xx、または取り直せる種類のエラー。
 */
export function isOutage(error: (SupabaseAuthError & { name?: string }) | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.status === 0) return true;
  if (typeof error.status === "number" && error.status >= 500) return true;
  return /fetch failed|load failed|failed to fetch|networkerror|econnrefused|enotfound|getaddrinfo/i.test(
    error.message ?? ""
  );
}
