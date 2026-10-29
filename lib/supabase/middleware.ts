import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { SUPABASE_URL, SUPABASE_KEY, checkSupabaseEnv, supabaseEnvMessage } from "./env";
import { isOutage } from "@/lib/auth-errors";

/** 未ログインでも通す入口 */
const PUBLIC_PREFIXES = [
  "/auth",
  "/join",
  "/booking",
  // 起動画面が行き先を訊きに来る。ここを閉じると未ログイン時に
  // JSON ではなく /auth の HTML が返り、起動画面が例外側で復帰していた。
  "/api/boot",
  "/_next",
  "/favicon",
];

function isPublic(pathname: string) {
  if (pathname === "/") return true; // 起動画面。中で行き先を判断する
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * セッションの更新。
 * Supabase のトークンは短命なので、毎リクエストで
 * getUser() を呼んで更新し、新しい Cookie を返す。
 */
export async function updateSession(request: NextRequest) {
  // 環境変数が無いまま進むと middleware ごと落ちて、
  // どのページも MIDDLEWARE_INVOCATION_FAILED としか出なくなる。
  // 何が足りないのかを画面に出す。
  const problems = checkSupabaseEnv();
  if (problems.length) {
    return new NextResponse(supabaseEnvMessage(problems), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getSession ではなく getUser を使う。
  // Cookie の中身は改ざんできるが、getUser は必ずサーバーに問い合わせる。
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 「ログインしていない」と「Supabase に繋がらない」を混ぜないこと。
  // 混ぜると、繋がらないだけの人まで /auth へ飛ばしてしまい、
  // ログインし直しても戻されるので「追い出された」ように見える。
  if (isOutage(error)) {
    return new NextResponse(
      [
        "SYNCLE: データの保管先（Supabase）に繋がりませんでした。",
        "",
        "しばらく待ってから開き直してください。",
        "何度も続く場合は、Supabase のプロジェクトが",
        "一時停止していないか確かめてください。",
        "（無料プランは、しばらく使わないと自動で止まります）",
        "",
        `原因: ${error?.message ?? "不明"}`,
      ].join("\n"),
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
