"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { MemberDot, OrganicButton, SectionHead } from "@/components/ui";
import {
  approveRequest, inviteMember, makeInviteLink, rejectRequest, removeMember, setOpenJoin,
  type MemberResult,
} from "./actions";
import type { Avatar } from "@/types/db";

export type MemberInfo = {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: Avatar | null;
  is_admin: boolean;
  status: string;
  is_me: boolean;
  company_count: number;
  open_task_count: number;
};

export type JoinRequest = { id: string; email: string; name: string | null; via: string };

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

export function MemberAdmin({
  members,
  requests,
  isAdmin,
  domain,
  openJoin,
  siteUrl,
}: {
  members: MemberInfo[];
  requests: JoinRequest[];
  isAdmin: boolean;
  domain: string | null;
  openJoin: boolean;
  siteUrl: string;
}) {
  const [invite, inviteAction, invitePending] = useActionState<MemberResult, FormData>(
    inviteMember,
    undefined
  );
  const [link, linkAction, linkPending] = useActionState<MemberResult, FormData>(
    makeInviteLink,
    undefined
  );
  const [, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const inviteUrl = link && "ok" in link ? `${siteUrl}/join/${link.ok}` : null;

  return (
    <div className="space-y-5">
      {/* ── メンバー一覧 ── */}
      <section>
        <SectionHead shape="flower" color="purple" title="メンバー" desc={`${members.length}人`} />
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 p-3 bg-white"
              style={{ ...field, borderRadius: "22px 11px 22px 11px" }}
            >
              <MemberDot name={m.name} avatar={m.avatar} size={34} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate">{m.name}</span>
                  {m.is_admin && (
                    <span
                      className="text-[10px] font-extrabold px-1.5 py-0.5 shrink-0"
                      style={{ background: SOFT.purple, color: C.purple, borderRadius: "6px 3px 6px 3px" }}
                    >
                      管理者
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
                  {m.email}
                  {m.status === "invited" && " ・ 登録済み（未ログイン）"}
                </div>
              </div>
              {isAdmin && !m.is_me && (
                <button
                  type="button"
                  aria-label={`${m.name} を外す`}
                  onClick={() => start(() => void removeMember(m.id))}
                  className="shrink-0 p-1.5"
                >
                  <X size={15} strokeWidth={3} style={{ color: "#C8C2B6" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {!isAdmin && (
        <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
          メンバーの追加は管理者だけができます。
        </p>
      )}

      {isAdmin && (
        <>
          {/* ── ① 事前登録 ── */}
          <section>
            <SectionHead
              shape="stamp"
              color="green"
              title="メンバーを登録する"
              desc="登録しておくと、本人がログインした時点で参加になります"
            />
            {!showInvite ? (
              <OrganicButton
                type="button"
                size="lg"
                variant="outline"
                color="green"
                className="w-full"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus size={16} strokeWidth={2.5} />
                メールアドレスで登録する
              </OrganicButton>
            ) : (
              <form
                action={inviteAction}
                className="bg-white p-4 space-y-2.5"
                style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
              >
                <input
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="メールアドレス"
                  className="w-full px-4 py-3 text-sm bg-white outline-none"
                  style={field}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="name"
                    placeholder="名前"
                    className="w-full px-4 py-3 text-sm bg-white outline-none"
                    style={field}
                  />
                  <input
                    name="role"
                    placeholder="役割"
                    className="w-full px-4 py-3 text-sm bg-white outline-none"
                    style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
                  />
                </div>
                <label className="flex items-center gap-2 px-1 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isAdmin"
                    className="w-4 h-4 accent-[color:var(--syncle-purple)]"
                  />
                  <span className="text-xs font-bold" style={{ color: "#6B6B6B" }}>
                    管理者にする
                  </span>
                </label>

                {invite && "error" in invite && (
                  <p className="text-xs font-bold" style={{ color: C.red }}>
                    {invite.error}
                  </p>
                )}
                {invite && "ok" in invite && (
                  <p className="text-xs font-bold" style={{ color: C.green }}>
                    {invite.ok}
                  </p>
                )}

                <OrganicButton
                  type="submit"
                  size="md"
                  color="green"
                  className="w-full"
                  disabled={invitePending}
                >
                  {invitePending ? "登録しています…" : "登録する"}
                </OrganicButton>
              </form>
            )}
          </section>

          {/* ── ② 同ドメイン ── */}
          {domain && (
            <section>
              <SectionHead
                shape="hex"
                color="blue"
                title="同じ会社の人"
                desc={`@${domain} の人が見つけて申請できます`}
              />
              <div className="space-y-2">
                <label
                  className="flex items-start gap-2.5 p-3.5 bg-white cursor-pointer"
                  style={{ ...field, borderRadius: "26px 13px 26px 13px" }}
                >
                  <input
                    type="checkbox"
                    defaultChecked={openJoin}
                    onChange={(e) => start(() => void setOpenJoin(e.target.checked))}
                    className="mt-0.5 w-4 h-4 shrink-0 accent-[color:var(--syncle-purple)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">承認なしで参加できるようにする</span>
                    <span className="block text-[11px] font-bold leading-snug" style={{ color: "#9AA0A6" }}>
                      オフのときは、申請が下に並びます
                    </span>
                  </span>
                </label>

                {requests.length > 0 ? (
                  requests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 p-3 bg-white"
                      style={{ ...field, borderColor: C.orange }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{r.name ?? r.email}</div>
                        <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
                          {r.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => start(() => void approveRequest(r.id))}
                        className="px-3 py-1.5 text-xs font-bold shrink-0"
                        style={{ background: SOFT.green, color: C.green, borderRadius: "10px 5px 10px 5px" }}
                      >
                        承認
                      </button>
                      <button
                        type="button"
                        onClick={() => start(() => void rejectRequest(r.id))}
                        className="px-3 py-1.5 text-xs font-bold shrink-0"
                        style={{ background: "#fff", color: C.red, border: `2px solid ${C.line}`, borderRadius: "5px 10px 5px 10px" }}
                      >
                        却下
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-bold px-1" style={{ color: "#C8C2B6" }}>
                    いま来ている申請はありません。
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── ③ 招待リンク ── */}
          <section>
            <SectionHead
              shape="burst"
              color="orange"
              title="招待リンク"
              desc="期限と使用回数を決めて配れます"
            />
            <form
              action={linkAction}
              className="bg-white p-4 space-y-2.5"
              style={{ ...field, borderRadius: "13px 26px 13px 26px" }}
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
                    有効期限（日）
                  </span>
                  <input
                    name="days"
                    type="number"
                    min={1}
                    defaultValue={7}
                    className="w-full px-4 py-3 text-sm bg-white outline-none"
                    style={field}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
                    使える回数
                  </span>
                  <input
                    name="maxUses"
                    type="number"
                    min={1}
                    defaultValue={10}
                    className="w-full px-4 py-3 text-sm bg-white outline-none"
                    style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
                  />
                </label>
              </div>

              {link && "error" in link && (
                <p className="text-xs font-bold" style={{ color: C.red }}>
                  {link.error}
                </p>
              )}

              {inviteUrl && (
                <div
                  className="p-3 space-y-2"
                  style={{ background: SOFT.orange, borderRadius: "14px 7px 14px 7px" }}
                >
                  <p className="text-[11px] font-bold break-all" style={{ color: "#8A5200" }}>
                    {inviteUrl}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(inviteUrl);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5"
                    style={{ background: "#fff", color: C.orange, borderRadius: "10px 5px 10px 5px" }}
                  >
                    {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} strokeWidth={2.5} />}
                    {copied ? "コピーしました" : "コピーする"}
                  </button>
                </div>
              )}

              <OrganicButton
                type="submit"
                size="md"
                color="orange"
                className="w-full"
                disabled={linkPending}
              >
                <Link2 size={15} strokeWidth={2.5} />
                {linkPending ? "発行しています…" : "リンクを発行する"}
              </OrganicButton>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
