"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  C, SOFT, INDUSTRIES, DEAL_TYPES, judgeTier, type ColorKey,
} from "@/lib/design";
import { OrganicButton, ShapeIcon, TierChip } from "@/components/ui";
import { ScreenHeader } from "@/components/ScreenHeader";
import { createClient } from "@/lib/supabase/client";
import { registerContact, type RegisterResult } from "../actions";
import type { Tier } from "@/types/db";

type Similar = {
  id: string;
  name: string;
  industry: string | null;
  tier: string | null;
  contact_count: number;
  exact: boolean;
};

const field = {
  borderRadius: "22px 11px 22px 11px",
  border: `2px solid ${C.line}`,
} as const;

export function NewContactForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<RegisterResult, FormData>(
    registerContact,
    undefined
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [employees, setEmployees] = useState("");
  const [tierManual, setTierManual] = useState("");
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [linkTo, setLinkTo] = useState<Similar | null>(null);

  // SPEC 7章：法人格と空白を落として近い会社を探す
  useEffect(() => {
    if (linkTo) return;
    const name = companyName.trim();
    if (name.length < 2) {
      setSimilar([]);
      return;
    }
    const id = window.setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("find_similar_companies", {
        p_workspace_id: workspaceId,
        p_name: name,
      });
      setSimilar((data ?? []) as unknown as Similar[]);
    }, 400);
    return () => window.clearTimeout(id);
  }, [companyName, workspaceId, linkTo]);

  const judged = judgeTier(title, Number(employees) || 0);
  const effectiveTier = (tierManual || judged.tier) as Tier;
  const canNext = Boolean((linkTo ? linkTo.name : companyName).trim());

  return (
    <form action={action}>
      <ScreenHeader
        title={step === 1 ? "名刺を登録" : "案件のこと"}
        subtitle={step === 1 ? "① 基本情報" : "② どんな話か"}
        actions={
          <Link
            href="/customers"
            className="text-xs font-bold px-3 py-2"
            style={{ color: "#9AA0A6" }}
          >
            やめる
          </Link>
        }
      />

      {/* 隠しフィールド：手入力なので値はここで持ち回る */}
      <input type="hidden" name="companyId" value={linkTo?.id ?? ""} />
      <input type="hidden" name="tierManual" value={tierManual} />

      <div className="px-4 py-4 space-y-4">
        {/* ── 進み具合 ── */}
        <div className="flex gap-1.5">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="flex-1 h-1.5 rounded-full"
              style={{ background: step >= n ? C.purple : C.line, transition: "background .3s" }}
            />
          ))}
        </div>

        <div className={step === 1 ? "space-y-4 anim-screen" : "hidden"}>
          {/* ── 会社 ── */}
          <Section label="会社">
            {linkTo ? (
              <div
                className="flex items-center gap-3 p-3.5"
                style={{ ...field, background: SOFT.green, borderColor: C.green }}
              >
                <ShapeIcon shape="hex" color="green" size={38} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold truncate">{linkTo.name}</div>
                  <div className="text-[11px] font-bold" style={{ color: C.green }}>
                    この会社に名刺を追加します
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkTo(null)}
                  className="text-xs font-bold shrink-0"
                  style={{ color: C.red }}
                >
                  やめる
                </button>
              </div>
            ) : (
              <input
                name="companyName"
                required
                autoFocus
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社アルテック"
                className="w-full px-4 py-3 text-base bg-white outline-none"
                style={field}
              />
            )}

            {/* 重複の警告（SPEC 7章） */}
            {!linkTo && similar.length > 0 && (
              <div
                className="p-3.5 space-y-2 anim-item"
                style={{ ...field, background: SOFT.orange, borderColor: C.orange }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} strokeWidth={2.5} style={{ color: C.orange }} />
                  <span className="text-xs font-extrabold" style={{ color: "#8A5200" }}>
                    もしかして、この会社ですか？
                  </span>
                </div>
                {similar.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLinkTo(s)}
                    className="w-full flex items-center gap-2.5 p-2.5 bg-white text-left"
                    style={{ borderRadius: "11px 22px 11px 22px", border: `2px solid ${C.line}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{s.name}</div>
                      <div className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
                        {s.industry ?? "業種未設定"} ・ 名刺{s.contact_count}枚
                      </div>
                    </div>
                    {s.tier && <TierChip tier={s.tier as Tier} small />}
                    <ChevronRight size={15} strokeWidth={3} style={{ color: "#C8C2B6" }} />
                  </button>
                ))}
                <p className="text-[11px] font-bold leading-snug" style={{ color: "#8A5200" }}>
                  別の会社ならそのまま進んでください。
                </p>
              </div>
            )}
          </Section>

          {/* ── 名刺の人 ── */}
          <Section label="名刺の人">
            <input
              name="contactName"
              placeholder="山田 太郎"
              className="w-full px-4 py-3 text-base bg-white outline-none"
              style={field}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="dept"
                placeholder="部署"
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              />
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="役職"
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
              />
            </div>
            <input
              name="email"
              type="email"
              inputMode="email"
              placeholder="メール"
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={field}
            />
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="電話"
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
            />
            <label className="flex items-center gap-2 px-1 pt-0.5 cursor-pointer">
              <input
                type="checkbox"
                name="makePrimary"
                defaultChecked
                className="w-4 h-4 accent-[color:var(--syncle-purple)]"
              />
              <span className="text-xs font-bold" style={{ color: "#6B6B6B" }}>
                この人を窓口にする
              </span>
            </label>
          </Section>

          {/* ── 会社の規模（新規のときだけ） ── */}
          {!linkTo && (
            <Section label="会社のこと">
              <select
                name="industry"
                defaultValue=""
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              >
                <option value="">業種を選ぶ</option>
                {INDUSTRIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="employees"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={employees}
                  onChange={(e) => setEmployees(e.target.value)}
                  placeholder="従業員数"
                  className="w-full px-4 py-3 text-sm bg-white outline-none"
                  style={field}
                />
                <input
                  name="revenue"
                  placeholder="売上高"
                  className="w-full px-4 py-3 text-sm bg-white outline-none"
                  style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
                />
              </div>
              <input
                name="address"
                placeholder="所在地"
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={field}
              />
              <input
                name="web"
                inputMode="url"
                placeholder="Web"
                className="w-full px-4 py-3 text-sm bg-white outline-none"
                style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
              />
            </Section>
          )}

          {/* ── ティアの根拠（SCREENS 6） ── */}
          {!linkTo && (
            <div
              className="p-3.5 space-y-2.5"
              style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
            >
              <div className="flex items-center gap-2.5">
                <TierChip tier={effectiveTier} />
                <span className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
                  {tierManual ? "手動で指定しています" : "役職と規模から自動で判定しました"}
                </span>
              </div>

              <div className="text-[11px] font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
                役職 {judged.titleScore}点
                {title ? `（${title}）` : "（未入力）"}
                ＋ 規模 {judged.sizeScore}点
                {employees ? `（${employees}名）` : "（未入力）"}
                ＝ <span style={{ color: C.ink }}>{judged.total}点</span>
                <br />
                4点以上でA、2〜3点でB、それ未満はC
              </div>

              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setTierManual("")}
                  className="text-[11px] font-bold px-2.5 py-1.5"
                  style={pill(!tierManual, "purple")}
                >
                  自動
                </button>
                {(["A", "B", "C"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTierManual(t)}
                    className="text-[11px] font-bold px-2.5 py-1.5"
                    style={pill(tierManual === t, "blue")}
                  >
                    {t} にする
                  </button>
                ))}
              </div>
            </div>
          )}

          <OrganicButton
            type="button"
            size="lg"
            className="w-full"
            disabled={!canNext}
            onClick={() => setStep(2)}
          >
            次へ：案件のこと
          </OrganicButton>
        </div>

        {/* ── ステップ2 ── */}
        <div className={step === 2 ? "space-y-4 anim-screen" : "hidden"}>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1 text-sm font-bold"
            style={{ color: "#9AA0A6" }}
          >
            <ChevronLeft size={16} strokeWidth={3} />
            基本情報にもどる
          </button>

          <div
            className="flex items-center gap-3 p-3.5"
            style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
          >
            <ShapeIcon shape="hex" color="purple" size={40} />
            <div className="min-w-0">
              <div className="text-sm font-extrabold truncate">
                {linkTo ? linkTo.name : companyName || "（会社名未入力）"}
              </div>
              <div className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
                {linkTo ? "既存の会社に追加します" : `新しく登録します ・ Tier ${effectiveTier}`}
              </div>
            </div>
          </div>

          <Section label="案件">
            <select
              name="dealType"
              defaultValue=""
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={field}
            >
              <option value="">案件種別を選ぶ</option>
              {DEAL_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <textarea
              name="dealMemo"
              rows={3}
              placeholder="どんな話か（例：基幹システムの刷新を検討中）"
              className="w-full px-4 py-3 text-sm bg-white outline-none resize-none"
              style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
            />
          </Section>

          <Section label="社内メモ">
            <textarea
              name="comment"
              rows={2}
              placeholder="覚えておきたいこと（例：展示会で名刺交換）"
              className="w-full px-4 py-3 text-sm bg-white outline-none resize-none"
              style={field}
            />
          </Section>

          {state?.error && (
            <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
              {state.error}
            </p>
          )}

          <div
            className="p-3.5 text-[11px] font-bold leading-relaxed"
            style={{ background: SOFT.purple, color: C.purple, borderRadius: "22px 11px 22px 11px" }}
          >
            登録すると、会社チャンネル・ティア判定・初回フォロータスク・商談が
            まとめて用意されます。
          </div>

          <OrganicButton type="submit" size="lg" color="green" className="w-full" disabled={pending}>
            {pending ? "登録しています…" : "登録する"}
          </OrganicButton>
        </div>
      </div>
    </form>
  );
}

function pill(active: boolean, tone: ColorKey) {
  return {
    background: active ? SOFT[tone as keyof typeof SOFT] : "#fff",
    color: active ? C[tone] : "#9AA0A6",
    border: `2px solid ${active ? C[tone] : C.line}`,
    borderRadius: "10px 5px 10px 5px",
  } as const;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
        {label}
      </div>
      {children}
    </div>
  );
}
