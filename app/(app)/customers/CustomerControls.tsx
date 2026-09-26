"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { C, SOFT, INDUSTRIES, DEAL_TYPES } from "@/lib/design";
import { SORTS, type Facet } from "@/lib/customers";

/** 検索・並べ替え・絞り込み。状態は URL に持たせる（戻るで元に戻せる）。 */
export function CustomerControls({ facets }: { facets: Facet[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  const sort = params.get("sort") ?? "new";
  const tier = params.get("tier");
  const industry = params.get("industry");
  const deal = params.get("deal");
  const filterCount = [tier, industry, deal].filter(Boolean).length;

  // 入力のたびに飛ばすと遅いので、止まってから送る
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const id = window.setTimeout(() => push({ q: q || null }), 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function push(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    start(() => router.replace(`/customers?${next.toString()}`, { scroll: false }));
  }

  const used = (kind: Facet["kind"]) => facets.filter((f) => f.kind === kind);
  const industryOptions = INDUSTRIES.filter((name) =>
    used("industry").some((f) => f.value === name)
  );
  const dealOptions = DEAL_TYPES.filter((name) => used("deal_type").some((f) => f.value === name));

  const chip = (active: boolean, tone: keyof typeof SOFT = "purple") => ({
    background: active ? SOFT[tone] : "#fff",
    color: active ? C[tone] : "#6B6B6B",
    border: `2px solid ${active ? C[tone] : C.line}`,
    borderRadius: "14px 7px 14px 7px",
  });

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-3.5 py-2.5 bg-white min-w-0"
          style={{ borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` }}
        >
          <Search size={16} strokeWidth={2.5} style={{ color: "#C8C2B6" }} className="shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="会社名・担当者・役職・メール…"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="検索を消す" className="shrink-0">
              <X size={15} strokeWidth={3} style={{ color: "#C8C2B6" }} />
            </button>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="絞り込み"
          aria-expanded={open}
          className="relative w-11 shrink-0 flex items-center justify-center"
          style={chip(open || filterCount > 0)}
        >
          <SlidersHorizontal size={17} strokeWidth={2.5} />
          {filterCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
              style={{ background: C.red }}
            >
              {filterCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-bar">
        {SORTS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => push({ sort: key === "new" ? null : key })}
            className={`text-xs font-bold px-3 py-1.5 shrink-0 ${sort === key ? "anim-chip" : ""}`}
            style={chip(sort === key, "blue")}
          >
            {label}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="bg-white p-3.5 space-y-3 anim-fade"
          style={{ borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` }}
        >
          <Group label="ティア">
            {(["A", "B", "C"] as const).map((value) => (
              <button
                key={value}
                onClick={() => push({ tier: tier === value ? null : value })}
                className={`text-xs font-bold px-3 py-1.5 ${tier === value ? "anim-chip" : ""}`}
                style={chip(tier === value, value === "A" ? "purple" : value === "B" ? "blue" : "green")}
              >
                Tier {value}
                <span className="ml-1 opacity-60">
                  {used("tier").find((f) => f.value === value)?.count ?? 0}
                </span>
              </button>
            ))}
          </Group>

          {industryOptions.length > 0 && (
            <Group label="業種">
              {industryOptions.map((value) => (
                <button
                  key={value}
                  onClick={() => push({ industry: industry === value ? null : value })}
                  className={`text-xs font-bold px-3 py-1.5 ${industry === value ? "anim-chip" : ""}`}
                  style={chip(industry === value, "green")}
                >
                  {value}
                </button>
              ))}
            </Group>
          )}

          {dealOptions.length > 0 && (
            <Group label="案件種別">
              {dealOptions.map((value) => (
                <button
                  key={value}
                  onClick={() => push({ deal: deal === value ? null : value })}
                  className={`text-xs font-bold px-3 py-1.5 ${deal === value ? "anim-chip" : ""}`}
                  style={chip(deal === value, "pink")}
                >
                  {value}
                </button>
              ))}
            </Group>
          )}

          {filterCount > 0 && (
            <button
              onClick={() => push({ tier: null, industry: null, deal: null })}
              className="text-xs font-bold pt-1"
              style={{ color: C.red }}
            >
              絞り込みを外す
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold px-0.5" style={{ color: "#9AA0A6" }}>
        {label}
      </div>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}
