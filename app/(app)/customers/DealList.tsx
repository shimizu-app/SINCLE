"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { C, SOFT, DEAL_STATUS, DEAL_TYPES, dealHeat } from "@/lib/design";
import { CompanyAvatar, MemberDot, OrganicButton, Sheet } from "@/components/ui";
import { completeDeal, updateDeal, type DealResult } from "./deal-actions";
import type { Avatar, DealStatus } from "@/types/db";

export type DealRow = {
  id: string;
  company_id: string;
  company_name: string;
  company_industry: string | null;
  status: DealStatus;
  memo: string | null;
  amount: string | null;
  deal_type: string | null;
  updated_at: string;
  days_since_update: number;
  owner_id: string | null;
  owner_name: string | null;
  owner_avatar: Avatar | null;
  contact_name: string | null;
  open_task_count: number;
};

export type Owner = { id: string; name: string };

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

export function DealList({ deals, owners }: { deals: DealRow[]; owners: Owner[] }) {
  const [editing, setEditing] = useState<DealRow | null>(null);

  if (deals.length === 0) {
    return (
      <p className="text-sm font-bold text-center py-8" style={{ color: "#9AA0A6" }}>
        進行中の案件はありません。名刺を登録すると自動で始まります。
      </p>
    );
  }

  return (
    <>
      <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
        止まっている順に並んでいます
      </p>

      <div className="space-y-2.5">
        {deals.map((deal, i) => (
          <DealCard key={deal.id} deal={deal} index={i} onEdit={() => setEditing(deal)} />
        ))}
      </div>

      <DealSheet deal={editing} owners={owners} onClose={() => setEditing(null)} />
    </>
  );
}

function DealCard({
  deal, index, onEdit,
}: {
  deal: DealRow;
  index: number;
  onEdit: () => void;
}) {
  const status = DEAL_STATUS[deal.status] ?? DEAL_STATUS.talking;
  // しきい値は lib/design.ts が正。日数だけサーバーから受け取る。
  const heat = dealHeat(deal.days_since_update, deal.status);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full text-left bg-white p-3.5 anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${heat ? heat.color : C.line}`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <CompanyAvatar
          name={deal.company_name}
          industry={deal.company_industry}
          dealType={deal.deal_type}
          size={44}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-extrabold truncate">{deal.company_name}</span>
            <span
              className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 shrink-0"
              style={{
                background: SOFT[status.color as keyof typeof SOFT],
                color: status.color === "yellow" ? "#9A6B00" : C[status.color],
                borderRadius: "7px 14px 7px 14px",
              }}
            >
              {status.label}
            </span>
          </div>

          {deal.memo && (
            <p className="text-xs font-bold mt-1 line-clamp-2" style={{ color: "#6B6B6B" }}>
              {deal.memo}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            {deal.deal_type && <span>{deal.deal_type}</span>}
            {deal.amount && <span style={{ color: C.ink }}>{deal.amount}</span>}
            <span>{deal.days_since_update}日前</span>
            {deal.open_task_count > 0 && (
              <span style={{ color: C.orange }}>未完了 {deal.open_task_count}</span>
            )}
          </div>
        </div>

        {deal.owner_name && (
          <MemberDot name={deal.owner_name} avatar={deal.owner_avatar} size={28} />
        )}
      </div>

      {heat && (
        <div
          className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5"
          style={{
            background: heat.level === "stopped" ? SOFT.red : SOFT.orange,
            borderRadius: "10px 5px 10px 5px",
          }}
        >
          <AlertTriangle size={13} strokeWidth={2.5} style={{ color: heat.color }} />
          <span className="text-[11px] font-bold" style={{ color: heat.color }}>
            {heat.text}（{status.limitDays}日が目安）
          </span>
        </div>
      )}
    </button>
  );
}

function DealSheet({
  deal, owners, onClose,
}: {
  deal: DealRow | null;
  owners: Owner[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<DealResult, FormData>(updateDeal, undefined);
  const [, start] = useTransition();

  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  if (!deal) return null;

  return (
    <Sheet open onClose={onClose} title={deal.company_name} subtitle="案件のようす">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={deal.id} />
        <input type="hidden" name="companyId" value={deal.company_id} />

        <div className="space-y-2">
          <Label>状況</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(DEAL_STATUS) as DealStatus[]).map((key) => {
              const s = DEAL_STATUS[key];
              return (
                <label key={key} className="cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={key}
                    defaultChecked={deal.status === key}
                    className="peer sr-only"
                  />
                  <span
                    className="block text-center text-[11px] font-bold py-2 peer-checked:anim-chip"
                    style={{ borderRadius: "10px 5px 10px 5px", border: `2px solid ${C.line}` }}
                  >
                    <span style={{ color: C[s.color] }}>{s.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[10px] font-bold px-1" style={{ color: "#C8C2B6" }}>
            状況ごとに「何日で放置とみなすか」が変わります
          </p>
        </div>

        <div className="space-y-2">
          <Label>メモ</Label>
          <textarea
            name="memo"
            rows={3}
            defaultValue={deal.memo ?? ""}
            placeholder="いまどこまで進んでいるか"
            className="w-full px-4 py-3 text-sm bg-white outline-none resize-none"
            style={field}
          />
          <p className="text-[10px] font-bold px-1" style={{ color: "#C8C2B6" }}>
            書き直すと「最終更新」が今になり、放置の警告が消えます
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>金額</Label>
            <input
              name="amount"
              defaultValue={deal.amount ?? ""}
              placeholder="300万円"
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label>種類</Label>
            <select
              name="dealType"
              defaultValue={deal.deal_type ?? ""}
              className="w-full px-3 py-3 text-sm bg-white outline-none"
              style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
            >
              <option value="">未設定</option>
              {DEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>担当</Label>
          <select
            name="ownerId"
            defaultValue={deal.owner_id ?? ""}
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={field}
          >
            <option value="">未設定</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {state && "error" in state && state.error && (
          <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
            {state.error}
          </p>
        )}

        <OrganicButton type="submit" size="lg" color="purple" className="w-full" disabled={pending}>
          {pending ? "保存しています…" : "保存する"}
        </OrganicButton>

        <div className="flex gap-2">
          <Link href={`/customers/${deal.company_id}`} className="flex-1">
            <OrganicButton type="button" size="md" variant="outline" color="blue" className="w-full">
              会社を見る
            </OrganicButton>
          </Link>
          <button
            type="button"
            onClick={() => {
              start(() => void completeDeal(deal.id));
              onClose();
            }}
            className="flex-1 text-sm font-bold py-2.5"
            style={{ background: "#fff", color: C.green, border: `2.5px solid ${C.green}`, borderRadius: "14px 24px 14px 24px" }}
          >
            完了にする
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
      {children}
    </div>
  );
}
