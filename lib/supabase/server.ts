import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { requireSupabaseEnv } from "./env";

/**
 * サーバー側の Supabase クライアント。
 * Server Component / Route Handler / Server Action から使う。
 * リクエストごとに作る（使い回さない）。
 */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component からは書き込めない。
          // セッションの更新は middleware が行うのでここは無視してよい。
        }
      },
    },
  });
}
