import type { Tier } from "@/types/db";

/* ══════════════ search_companies の戻り ══════════════ */

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  tier: Tier | null;
  employees: number | null;
  deal_type: string | null;
  comment: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  stage_name: string | null;
  stage_position: number | null;
  stage_total: number;
  primary_contact_name: string | null;
  primary_contact_title: string | null;
  contact_count: number;
  open_task_count: number;
  deal_status: string | null;
  deal_updated_at: string | null;
  /** チームに共有しているか（023） */
  shared?: boolean;
  registered_by?: string | null;
  registrant_name?: string | null;
  /** 自分が登録した・担当している会社か（違えば、人が共有したもの） */
  is_mine?: boolean;
};

/**
 * 「自分の会社」（自分が登録した・担当している・チームに共有された）だけに絞る PostgREST の or 条件（023）。
 * 「全員の名刺を見る」許可がある人は、RLS では人の会社も見える。
 * 会社を選んで何かを作る画面（タスク・日程調整・メール）では、書ける会社だけを出す。
 */
export function mineFilter(memberId: string) {
  return `shared.eq.true,registered_by.eq.${memberId},owner_id.eq.${memberId}`;
}

/* ══════════════ company_groups の戻り（全社のまとめ） ══════════════ */

export type CompanyGroupRow = {
  key: string;
  name: string;
  record_count: number;
  registrants: string[];
  contact_count: number;
  tier: Tier | null;
  industry: string | null;
  shared: boolean;
  active_deals: number;
  open_task_count: number;
  latest_at: string;
  company_ids: string[];
};

export type Counts = {
  companies: number;
  tier_a: number;
  open_tasks: number;
  unreplied_mails: number;
};

export type Facet = { kind: "tier" | "industry" | "deal_type"; value: string; count: number };

export const SORTS = [
  ["new", "新しい順"],
  ["old", "古い順"],
  ["tier", "ティア順"],
  ["stage", "進捗順"],
  ["name", "会社名順"],
] as const;

export type SortKey = (typeof SORTS)[number][0];

export function isSortKey(value: string | undefined): value is SortKey {
  return SORTS.some(([key]) => key === value);
}

/* ══════════════ 絞り込みの状態 ══════════════ */

export type CustomerQuery = {
  q?: string;
  tier?: string;
  industry?: string;
  deal?: string;
  sort?: SortKey;
};

/** 絞り込みが1つでも効いているか */
export function hasFilter(query: CustomerQuery) {
  return Boolean(query.q || query.tier || query.industry || query.deal);
}
