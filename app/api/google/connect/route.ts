import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireCurrent } from "@/lib/workspace";
import { CALLBACK_PATH, authorizeUrl, googleConfig } from "@/lib/google";

/**
 * Google カレンダー連携の入口。同意画面へ送り出す。
 *
 * state は、戻ってきたのが本当にここから出ていった人かを確かめるための合言葉。
 * これが無いと、他人の Google アカウントを勝手につながせる攻撃ができてしまう。
 */
export const runtime = "nodejs";

const STATE_COOKIE = "syncle_google_state";

export async function GET(request: NextRequest) {
  await requireCurrent();

  const cfg = googleConfig();
  if (!cfg.ok) {
    return NextResponse.redirect(new URL("/settings?google=unconfigured#google", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL(CALLBACK_PATH, request.nextUrl.origin).toString();

  const res = NextResponse.redirect(authorizeUrl(cfg.config, redirectUri, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Google から戻ってくるのは別サイトからの遷移。lax なら上の階層の GET には付く
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
