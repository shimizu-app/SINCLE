"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { MemberDot } from "@/components/ui";
import { openDm } from "./actions";
import type { Avatar } from "@/types/db";

export type MemberRowData = {
  id: string;
  name: string;
  role: string;
  avatar: Avatar | null;
  note: string | null;
  is_admin: boolean;
  status: string;
  is_me: boolean;
  company_count: number;
  open_task_count: number;
};

export function MemberRow({ member, index }: { member: MemberRowData; index: number }) {
  const [pending, start] = useTransition();

  return (
    <div
      className="flex items-center gap-3 p-3.5 bg-white anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${C.line}`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      }}
    >
      <MemberDot name={member.name} avatar={member.avatar} size={44} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-extrabold truncate">{member.name}</span>
          {member.is_me && (
            <span className="text-[10px] font-bold shrink-0" style={{ color: "#C8C2B6" }}>
              あなた
            </span>
          )}
          {member.is_admin && (
            <span
              className="text-[10px] font-extrabold px-1.5 py-0.5 shrink-0"
              style={{ background: SOFT.purple, color: C.purple, borderRadius: "6px 3px 6px 3px" }}
            >
              管理者
            </span>
          )}
        </div>
        <div className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
          {member.role}
          {member.status === "invited" && " ・ 未ログイン"}
        </div>
        <div className="text-[11px] font-bold mt-0.5" style={{ color: "#6B6B6B" }}>
          担当 {member.company_count}社
          {member.open_task_count > 0 && (
            <span style={{ color: C.orange }}> ／ 未完了 {member.open_task_count}件</span>
          )}
        </div>
      </div>

      {!member.is_me && member.status === "active" && (
        <button
          type="button"
          aria-label={`${member.name} と1対1で話す`}
          disabled={pending}
          onClick={() => start(() => void openDm(member.id))}
          className="w-10 h-10 shrink-0 flex items-center justify-center disabled:opacity-40"
          style={{ background: SOFT.blue, borderRadius: "14px 7px 14px 7px" }}
        >
          <MessageCircle size={17} strokeWidth={2.5} style={{ color: C.blue }} />
        </button>
      )}
    </div>
  );
}
