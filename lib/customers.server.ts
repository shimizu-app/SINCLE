import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, Counts, CustomerQuery, Facet } from "./customers";

/* ══════════════ 取得 ══════════════ */

export async function loadCustomers(workspaceId: string, query: CustomerQuery) {
  const supabase = await createClient();

  // 一覧・件数・絞り込みの選択肢を一度に取りに行く
  const [list, counts, facets] = await Promise.all([
    supabase.rpc("search_companies", {
      p_workspace_id: workspaceId,
      p_q: query.q || undefined,
      p_tier: query.tier || undefined,
      p_industry: query.industry || undefined,
      p_deal_type: query.deal || undefined,
      p_sort: query.sort ?? "new",
    }),
    supabase.rpc("customer_counts", { p_workspace_id: workspaceId }),
    supabase.rpc("company_facets", { p_workspace_id: workspaceId }),
  ]);

  return {
    companies: (list.data ?? []) as unknown as CompanyRow[],
    counts: ((counts.data as unknown as Counts[])?.[0] ?? {
      companies: 0,
      tier_a: 0,
      open_tasks: 0,
      unreplied_mails: 0,
    }) as Counts,
    facets: (facets.data ?? []) as unknown as Facet[],
    error: list.error?.message ?? null,
  };
}

