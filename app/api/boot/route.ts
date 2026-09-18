import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WS_COOKIE } from "@/lib/workspace";

/**
 * 起動時の行き先を決める。
 * 起動アニメーションの裏でこれを呼び、返ってきた瞬間に画面を飛ばす
 * （SCREENS 1：アニメーションの時間を固定にしない）。
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ next: "/auth" });
  }

  // 事前登録（status='invited'）の行を自分のものにする
  await supabase.rpc("claim_membership");

  // RLS により、自分が所属するワークスペースだけが返る
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ next: "/auth/workspace" });
  }

  const ids = (workspaces ?? []).map((w) => w.id);
  if (ids.length === 0) {
    return NextResponse.json({ next: "/auth/workspace" });
  }

  const current = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const active = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ACTIVE_WS_COOKIE}=`))
    ?.split("=")[1];

  if (active && ids.includes(active)) {
    return NextResponse.json({ next: "/customers" });
  }

  if (ids.length === 1) {
    const response = NextResponse.json({ next: "/customers" });
    response.cookies.set(ACTIVE_WS_COOKIE, ids[0], {
      httpOnly: true,
      sameSite: "lax",
      secure: current.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  return NextResponse.json({ next: "/auth/workspace" });
}
