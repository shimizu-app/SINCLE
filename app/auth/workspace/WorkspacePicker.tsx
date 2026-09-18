"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { C, SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { joinByDomain, selectWorkspace, signOut } from "../actions";
import type { DomainCandidate, Workspace } from "@/types/db";

type Props = {
  email: string;
  mine: Workspace[];
  candidates: DomainCandidate[];
};

export function WorkspacePicker({ email, mine, candidates }: Props) {
  const [pending, start] = useTransition();
  const [requested, setRequested] = useState<string[]>(
    candidates.filter((c) => c.requested).map((c) => c.id)
  );
  const [error, setError] = useState<string | null>(null);

  const nothing = mine.length === 0 && candidates.length === 0;

  function enter(id: string) {
    start(async () => {
      const result = await selectWorkspace(id);
      if (result?.error) setError(result.error);
    });
  }

  function join(id: string) {
    start(async () => {
      const result = await joinByDomain(id);
      if (result && "error" in result) setError(result.error);
      else if (result && "requested" in result) setRequested((v) => [...v, id]);
    });
  }

  return (
    <div className="anim-screen space-y-6">
      <div>
        <h1 className="text-xl font-extrabold">ワークスペース</h1>
        <p className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
          {email} でログイン中
        </p>
      </div>

      {error && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {error}
        </p>
      )}

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            所属しています
          </h2>
          {mine.map((w, i) => (
            <button
              key={w.id}
              onClick={() => enter(w.id)}
              disabled={pending}
              className="w-full flex items-center gap-3 p-3.5 bg-white text-left anim-item disabled:opacity-50"
              style={{
                borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
                border: `2.5px solid ${C.line}`,
                animationDelay: `${i * 50}ms`,
              }}
            >
              <ShapeIcon shape={w.shape as ShapeKey} color={w.color as ColorKey} size={44} />
              <span className="flex-1 min-w-0">
                <span className="block text-base font-extrabold truncate">{w.name}</span>
                <span className="block text-xs font-bold" style={{ color: "#9AA0A6" }}>
                  /{w.slug}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={3} style={{ color: "#C8C2B6" }} />
            </button>
          ))}
        </section>
      )}

      {candidates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            同じ会社にあります
          </h2>
          {candidates.map((c, i) => {
            const done = requested.includes(c.id);
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3.5 bg-white anim-item"
                style={{
                  borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                  border: `2.5px solid ${C.line}`,
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <ShapeIcon shape={c.shape as ShapeKey} color={c.color as ColorKey} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-extrabold truncate">{c.name}</div>
                  <div className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
                    {c.member_count}人が参加中
                  </div>
                </div>
                {done ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 shrink-0"
                    style={{ background: SOFT.green, color: C.green, borderRadius: "10px 5px 10px 5px" }}
                  >
                    <Check size={13} strokeWidth={3} />
                    申請済み
                  </span>
                ) : (
                  <OrganicButton size="sm" color={c.open_join ? "purple" : "blue"} onClick={() => join(c.id)} disabled={pending}>
                    {c.open_join ? "参加する" : "参加を申請"}
                  </OrganicButton>
                )}
              </div>
            );
          })}
        </section>
      )}

      {nothing && (
        <div
          className="p-5 bg-white space-y-3 text-center anim-item"
          style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` }}
        >
          <div className="flex justify-center">
            <ShapeIcon shape="cloud" color="blue" size={56} />
          </div>
          <p className="text-sm font-extrabold">参加できるワークスペースがありません</p>
          <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
            管理者に登録してもらうか、招待リンクを受け取ってください。
            <br />
            新しく作ることもできます。
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Link href="/auth/new" className="block">
          <OrganicButton size="lg" className="w-full" color="green" shape="wave" type="button">
            新しくワークスペースを作る
          </OrganicButton>
        </Link>
        <form action={signOut}>
          <button type="submit" className="w-full text-xs font-bold py-2" style={{ color: "#9AA0A6" }}>
            別のアカウントでログインする
          </button>
        </form>
      </div>
    </div>
  );
}
