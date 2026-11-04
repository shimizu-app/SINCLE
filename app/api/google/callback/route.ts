import { NextResponse, type NextRequest } from "next/server";
import { requireCurrent } from "@/lib/workspace";
import { CALLBACK_PATH, connectWithCode } from "@/lib/google";

/**
 * Google の同意画面から戻ってくる所。
 * Google Cloud の OAuth クライアントに「承認済みのリダイレクトURI」として
 *   https://sincle.vercel.app/api/google/callback
 * を登録しておくこと。1文字でも違うと Google が redirect_uri_mismatch を返す。
 */
export const runtime = "nodejs";

const STATE_COOKIE = "syncle_google_state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const back = (result: string, detail?: string) => {
    const to = new URL("/settings", request.url);
    to.searchParams.set("google", result);
    if (detail) to.searchParams.set("detail", detail.slice(0, 200));
    to.hash = "google";
    const res = NextResponse.redirect(to);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return res;
  };

  // 同意画面で「キャンセル」した、またはテストユーザーに入っていない
  const denied = url.searchParams.get("error");
  if (denied) return back("denied", denied);

  const state = url.searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) return back("state");

  const code = url.searchParams.get("code");
  if (!code) return back("failed", "code がありません");

  const current = await requireCurrent();
  const redirectUri = new URL(CALLBACK_PATH, url.origin).toString();
  const result = await connectWithCode(current.workspace.id, code, redirectUri);

  if (!result.ok) {
    console.error(`[google] 連携に失敗 ${result.message}`);
    return back("failed", result.message);
  }
  console.log("[google] 連携した");
  return back("connected");
}
