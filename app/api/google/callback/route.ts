import { NextResponse, type NextRequest } from "next/server";
import { requireCurrent } from "@/lib/workspace";
import { CALLBACK_PATH, GMAIL_READ_SCOPE, connectWithCode } from "@/lib/google";

/**
 * Google の同意画面から戻ってくる所。
 * Google Cloud の OAuth クライアントに「承認済みのリダイレクトURI」として
 *   https://sincle.vercel.app/api/google/callback
 * を登録しておくこと。1文字でも違うと Google が redirect_uri_mismatch を返す。
 *
 * カレンダーから来た人は設定へ、Gmail から来た人はメール画面へ戻す。
 */
export const runtime = "nodejs";

const STATE_COOKIE = "syncle_google_state";
const PURPOSE_COOKIE = "syncle_google_for";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const gmail = request.cookies.get(PURPOSE_COOKIE)?.value === "gmail";

  const back = (result: string, detail?: string) => {
    const to = new URL(gmail ? "/mail" : "/settings", request.url);
    to.searchParams.set("google", result);
    if (detail) to.searchParams.set("detail", detail.slice(0, 200));
    if (!gmail) to.hash = "google";
    const res = NextResponse.redirect(to);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    res.cookies.delete({ name: PURPOSE_COOKIE, path: "/api/google" });
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

  // 同意画面で Gmail のチェックを外された（Google は項目ごとに外せる）
  if (gmail && !result.scopes.includes(GMAIL_READ_SCOPE)) {
    console.log("[google] つないだが Gmail の許可は無し");
    return back("no_gmail");
  }

  console.log(`[google] 連携した${gmail ? "（Gmail も）" : ""}`);
  return back("connected");
}
