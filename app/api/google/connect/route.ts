import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireCurrent } from "@/lib/workspace";
import { CALLBACK_PATH, GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, authorizeUrl, googleConfig } from "@/lib/google";

/**
 * Google 連携の入口。同意画面へ送り出す。
 *
 *   /api/google/connect             Google カレンダー（設定から）
 *   /api/google/connect?with=gmail  Gmail も（メール画面・設定の Gmail から）
 *
 * state は、戻ってきたのが本当にここから出ていった人かを確かめるための合言葉。
 * これが無いと、他人の Google アカウントを勝手につながせる攻撃ができてしまう。
 */
export const runtime = "nodejs";

const STATE_COOKIE = "syncle_google_state";
const PURPOSE_COOKIE = "syncle_google_for";

export async function GET(request: NextRequest) {
  await requireCurrent();
  const gmail = request.nextUrl.searchParams.get("with") === "gmail";

  const cfg = googleConfig();
  if (!cfg.ok) {
    const to = gmail ? "/mail?google=unconfigured" : "/settings?google=unconfigured#google";
    return NextResponse.redirect(new URL(to, request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL(CALLBACK_PATH, request.nextUrl.origin).toString();

  const res = NextResponse.redirect(
    authorizeUrl(cfg.config, redirectUri, state, gmail ? [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE] : [])
  );
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Google から戻ってくるのは別サイトからの遷移。lax なら上の階層の GET には付く
    sameSite: "lax" as const,
    path: "/api/google",
    maxAge: 600,
  };
  res.cookies.set(STATE_COOKIE, state, cookie);
  res.cookies.set(PURPOSE_COOKIE, gmail ? "gmail" : "calendar", cookie);
  return res;
}
