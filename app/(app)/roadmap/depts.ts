import type { ColorKey, ShapeKey } from "@/lib/design";

/**
 * 計画（SCREENS 8）の部署と、表示する月の範囲。
 *
 * 部署の定義は lib/design.ts に無いので、ここに置く。
 * 色と形は PROTOTYPE.jsx の DEPTS に合わせてある。
 * データベースには sales | is | cs | dev の4つだけを入れる（008）。
 * 「全社」は絞り込みの呼び名で、4部署をまとめて見るという意味。
 */

export type DeptKey = "sales" | "is" | "cs" | "dev";
export type DeptFilter = DeptKey | "all";

export const DEPTS: { id: DeptFilter; name: string; shape: ShapeKey; color: ColorKey }[] = [
  { id: "all", name: "全社", shape: "burst", color: "purple" },
  { id: "sales", name: "営業", shape: "flower", color: "red" },
  { id: "is", name: "インサイドセールス", shape: "sun", color: "yellow" },
  { id: "cs", name: "カスタマーサクセス", shape: "clover", color: "green" },
  { id: "dev", name: "開発", shape: "hex", color: "blue" },
];

export const DEPT_KEYS: DeptKey[] = ["sales", "is", "cs", "dev"];

export function deptOf(id: string) {
  return DEPTS.find((d) => d.id === id) ?? DEPTS[0];
}

export function isDeptFilter(v: string | undefined): v is DeptFilter {
  return DEPTS.some((d) => d.id === v);
}

export type YearMonth = { year: number; month: number };

/** "2026-11" の形。URL に載せる */
export function ymKey({ year, month }: YearMonth) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseYm(v: string | undefined): YearMonth | null {
  const m = v?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

/**
 * 表示する6か月。先月から4か月先まで。
 * 先月を入れておくのは、終わったばかりの議題の「決まったこと」を見返すため。
 */
export function monthWindow(today: Date): YearMonth[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function sameYm(a: YearMonth, b: YearMonth) {
  return a.year === b.year && a.month === b.month;
}
