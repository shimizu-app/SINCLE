"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { requireSupabaseEnv } from "./env";

/** ブラウザ側の Supabase クライアント。クライアントコンポーネントから使う。 */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}
