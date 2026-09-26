"use client";

import { useActionState, useState } from "react";
import { Calendar, CheckCircle2, Clock, Mail } from "lucide-react";
import { C, SOFT, INDUSTRIES, DEAL_TYPES, sizeScore } from "@/lib/design";
import { OrganicButton, SectionHead, ShapeIcon, TierChip } from "@/components/ui";
import { updateCompany, type UpdateResult } from "../actions";
import type { Tables } from "@/types/supabase";
import type { Tier } from "@/types/db";

type Stage = { id: string; name: string; position: number };

const field = {
  borderRadius: "22px 11px 22px 11px",
  border: `2px solid ${C.line}`,
} as const;

export function CompanyOverview({
  company,
  stages,
  contactCount,
  titleScore,
  titleSource,
  openTasks,
  dealMemo,
}: {
  company: Tables<"companies">;
  stages: Stage[];
  contactCount: number;
  /** 所属する名刺のうち、いちばん高い役職スコア */
  titleScore: number;
  /** その点を付けた役職名（根拠の表示に使う） */
  titleSource: string | null;
  openTasks: number;
  dealMemo: string | null;
}) {
  const [state, action, pending] = useActionState<UpdateResult, FormData>(updateCompany, undefined);
  const [editing, setEditing] = useState(false);

  const stage = stages.find((s) => s.id === company.stage_id);
  const progress = stage && stages.length ? Math.round(((stage.position + 1) / stages.length) * 100) : null;
  const tier = (company.tier_manual ?? company.tier) as Tier | null;

  const quick = [
    { icon: Mail, label: "メール", tone: "blue" as const, phase: "フェーズ6" },
    { icon: Calendar, label: "日程調整", tone: "green" as const, phase: "フェーズ6" },
    { icon: Clock, label: "履歴", tone: "purple" as const, phase: "フェーズ5" },
    { icon: CheckCircle2, label: "タスク", tone: "yellow" as const, phase: "フェーズ3" },
  ];

  const info: [string, string | null][] = [
    ["業種", company.industry],
    ["従業員数", company.employees ? `${company.employees}名` : null],
    ["売上高", company.revenue],
    ["所在地", company.address],
    ["Web", company.web],
  ];

  return (
    <div className="space-y-5">
      {/* ── クイックアクション ── */}
      <div className="grid grid-cols-4 gap-2">
        {quick.map((q, i) => (
          <button
            key={q.label}
            type="button"
            title={`${q.phase}で使えるようになります`}
            className="flex flex-col items-center gap-1.5 py-3 bg-white opacity-50 cursor-not-allowed"
            style={{
              borderRadius: i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
              border: `2px solid ${C.line}`,
            }}
            disabled
          >
            <q.icon size={18} strokeWidth={2.5} style={{ color: C[q.tone] }} />
            <span className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
              {q.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── 進捗 ── */}
      {stage && (
        <div className="bg-white p-3.5" style={{ ...field, borderRadius: "26px 13px 26px 13px" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-extrabold">{stage.name}</span>
            <span className="text-sm font-bold" style={{ color: C.purple }}>
              {progress}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: C.purple, transition: "width .7s" }}
            />
          </div>
          <div className="flex gap-1 mt-2 overflow-x-auto no-bar">
            {stages.map((s) => (
              <span
                key={s.id}
                className="text-[10px] font-bold px-2 py-1 shrink-0"
                style={{
                  color: s.position <= stage.position ? C.purple : "#C8C2B6",
                  background: s.position === stage.position ? SOFT.purple : "transparent",
                  borderRadius: "7px 3px 7px 3px",
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 基本情報 ── */}
      <section>
        <SectionHead shape="hex" color="purple" title="基本情報" desc="名刺から分かっていること" />
        <div className="bg-white p-4 space-y-3" style={{ ...field, borderRadius: "26px 13px 26px 13px" }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tier && <TierChip tier={tier} />}
            <span className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
              {company.tier_manual ? "手動で指定しています" : "役職と規模から自動で判定しました"}
            </span>
          </div>

          {!company.tier_manual && (
            <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
              役職 {titleScore}点
              {titleSource ? `（${titleSource}）` : "（該当なし）"}
              ＋ 規模 {sizeScore(company.employees ?? 0)}点
              {company.employees ? `（${company.employees}名）` : "（未登録）"}
              ＝ <span style={{ color: C.ink }}>{titleScore + sizeScore(company.employees ?? 0)}点</span>
            </p>
          )}

          <dl className="space-y-2">
            {info.map(([label, value]) => (
              <div key={label} className="flex gap-3 text-sm">
                <dt className="w-20 shrink-0 font-bold" style={{ color: "#9AA0A6" }}>
                  {label}
                </dt>
                <dd className="flex-1 min-w-0 font-bold break-words">
                  {value ?? <span style={{ color: "#C8C2B6" }}>未登録</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex gap-3 text-xs font-bold pt-1" style={{ color: "#9AA0A6" }}>
            <span>名刺 {contactCount}枚</span>
            {openTasks > 0 && <span style={{ color: C.orange }}>未完了 {openTasks}件</span>}
          </div>
        </div>
      </section>

      {/* ── 案件メモ ── */}
      {dealMemo && (
        <section>
          <SectionHead shape="sun" color="orange" title="いまの話" desc="進行中の案件のメモ" />
          <div
            className="bg-white p-4 text-sm font-bold leading-relaxed whitespace-pre-wrap"
            style={{ ...field, borderRadius: "13px 26px 13px 26px" }}
          >
            {dealMemo}
          </div>
        </section>
      )}

      {/* ── 社内メモ ── */}
      {company.comment && (
        <section>
          <SectionHead shape="cloud" color="blue" title="社内メモ" desc="チームで共有しておくこと" />
          <div
            className="bg-white p-4 text-sm font-bold leading-relaxed whitespace-pre-wrap"
            style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
          >
            {company.comment}
          </div>
        </section>
      )}

      {/* ── 編集 ── */}
      <section>
        <SectionHead shape="stamp" color="green" title="編集" desc="あとから直せます" />

        {!editing ? (
          <OrganicButton
            type="button"
            variant="outline"
            color="green"
            size="lg"
            className="w-full"
            onClick={() => setEditing(true)}
          >
            この会社の情報を直す
          </OrganicButton>
        ) : (
          <form
            action={action}
            className="bg-white p-4 space-y-3"
            style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
          >
            <input type="hidden" name="id" value={company.id} />

            <Labeled label="会社名">
              <input
                name="name"
                defaultValue={company.name}
                required
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              />
            </Labeled>

            <Labeled label="業種">
              <select
                name="industry"
                defaultValue={company.industry ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              >
                <option value="">未設定</option>
                {INDUSTRIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Labeled>

            <div className="grid grid-cols-2 gap-2">
              <Labeled label="従業員数">
                <input
                  name="employees"
                  type="number"
                  min={0}
                  defaultValue={company.employees ?? 0}
                  className="w-full px-4 py-3 text-sm bg-white outline-none"
                  style={field}
                />
              </Labeled>
              <Labeled label="売上高">
                <input
                  name="revenue"
                  defaultValue={company.revenue ?? ""}
                  className="w-full px-4 py-3 text-sm bg-white outline-none"
                  style={field}
                />
              </Labeled>
            </div>

            <Labeled label="所在地">
              <input
                name="address"
                defaultValue={company.address ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              />
            </Labeled>

            <Labeled label="Web">
              <input
                name="web"
                defaultValue={company.web ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              />
            </Labeled>

            <Labeled label="案件種別">
              <select
                name="dealType"
                defaultValue={company.deal_type ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              >
                <option value="">未設定</option>
                {DEAL_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label="進捗">
              <select
                name="stageId"
                defaultValue={company.stage_id ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              >
                <option value="">未設定</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Labeled>

            <Labeled label="ティア">
              <select
                name="tierManual"
                defaultValue={company.tier_manual ?? "auto"}
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              >
                <option value="auto">自動で判定する</option>
                <option value="A">A にする</option>
                <option value="B">B にする</option>
                <option value="C">C にする</option>
              </select>
            </Labeled>

            <Labeled label="社内メモ">
              <textarea
                name="comment"
                rows={3}
                defaultValue={company.comment ?? ""}
                className="w-full px-4 py-3 text-sm bg-white outline-none resize-none"
                style={field}
              />
            </Labeled>

            {state && "error" in state && state.error && (
              <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
                {state.error}
              </p>
            )}
            {state && "ok" in state && (
              <p className="text-xs font-bold" style={{ color: C.green }}>
                保存しました
              </p>
            )}

            <div className="flex gap-2">
              <OrganicButton type="submit" size="md" color="green" className="flex-1" disabled={pending}>
                {pending ? "保存中…" : "保存する"}
              </OrganicButton>
              <OrganicButton
                type="button"
                size="md"
                variant="outline"
                color="purple"
                onClick={() => setEditing(false)}
              >
                閉じる
              </OrganicButton>
            </div>
          </form>
        )}
      </section>

      <div
        className="flex items-center gap-2.5 p-3.5"
        style={{ background: SOFT.lime, borderRadius: "22px 11px 22px 11px" }}
      >
        <ShapeIcon shape="clover" color="green" size={30} />
        <p className="text-[11px] font-bold leading-snug" style={{ color: "#4A7A3A" }}>
          履歴・タスク・チャンネル・メールは、フェーズ3以降で
          このタブから使えるようになります。
        </p>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
