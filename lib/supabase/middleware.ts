import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/** 未ログインでも通す入口 */
const PUBLIC_PREFIXES = ["/auth", "/join", "/booking", "/_next", "/favicon"];

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
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
    }
  );

  // getSession ではなく getUser を使う。
  // Cookie の中身は改ざんできるが、getUser は必ずサーバーに問い合わせる。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
