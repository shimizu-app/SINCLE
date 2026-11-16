"use client";

import { useState, useTransition } from "react";
import { Eye, Lock, Users } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { setCompanyShared } from "../actions";

/**
 * 会社の見える範囲（023）。
 *   ・自分だけ … 登録した人と担当者だけが見る（いつもはこれ）
 *   ・チームに共有 … ワークスペースの全員が見て書ける
 * 「全員の名刺を見る」許可で人の会社を見ているときは、見るだけと伝える。
 */
export function CompanySharing(props: {
  companyId: string;
  shared: boolean;
  registrantName: string | null;
  registeredByMe: boolean;
  canShare: boolean;
  readOnly: boolean;
}) {
  const [shared, setShared] = useState(props.shared);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const who = props.registeredByMe ? "あなた" : props.registrantName ? `${props.registrantName}さん` : "退会した人";

  if (props.readOnly) {
    return (
      <div
        className="flex items-start gap-2 px-3.5 py-2.5 text-[11px] font-bold leading-relaxed"
        style={{ background: SOFT.yellow, color: "#7A5A00", borderRadius: "16px 8px 16px 8px" }}
      >
        <Eye size={14} strokeWidth={2.6} className="shrink-0 mt-0.5" />
        <span>
          {who}が登録した会社です。「全員の名刺を見る」の許可で見ています。見るだけで、書き換えはできません。
        </span>
      </div>
    );
  }

  const toggle = () => {
    const next = !shared;
    setError(null);
    setShared(next);
    start(async () => {
      const r = await setCompanyShared(props.companyId, next);
      if ("error" in r) {
        setShared(!next);
        setError(r.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white"
        style={{ border: `2px solid ${C.line}`, borderRadius: "16px 8px 16px 8px" }}
      >
        {shared ? (
          <Users size={15} strokeWidth={2.6} style={{ color: C.green }} className="shrink-0" />
        ) : (
          <Lock size={15} strokeWidth={2.6} style={{ color: "#9AA0A6" }} className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-extrabold">{shared ? "チームに共有しています" : "自分だけ（共有していません）"}</div>
          <div className="text-[10px] font-bold mt-0.5" style={{ color: "#9AA0A6" }}>
            登録：{who}
            {shared ? " ・ 全員が見て書けます" : " ・ 見えるのは登録した人と担当者だけ"}
          </div>
        </div>
        {props.canShare && (
          <button
            type="button"
            role="switch"
            aria-checked={shared}
            aria-label="チームに共有"
            onClick={toggle}
            disabled={pending}
            className="shrink-0 w-12 h-7 rounded-full relative disabled:opacity-60"
            style={{ background: shared ? C.green : "#D9D4CA", transition: "background .2s" }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full bg-white"
              style={{ left: shared ? 24 : 4, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}
            />
          </button>
        )}
      </div>
      {error && (
        <p className="text-[11px] font-bold px-1" style={{ color: C.red }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
