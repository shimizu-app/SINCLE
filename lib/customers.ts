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
