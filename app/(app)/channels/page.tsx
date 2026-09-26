import Link from "next/link";
import { C, SOFT, companyArt, type ColorKey, type ShapeKey } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { MemberDot, ShapeIcon } from "@/components/ui";
import { GroupSheet, type PickMember } from "./GroupSheet";
import { MemberRow, type MemberRowData } from "./MemberRow";
import type { Avatar } from "@/types/db";

const TABS = [
  { key: "dm", label: "個人" },
  { key: "group", label: "グループ" },
  { key: "company", label: "会社" },
  { key: "members", label: "メンバー" },
] as const;

type ChannelRow = {
  id: string;
  kind: string;
  name: string | null;
  shape: string | null;
  color: string | null;
  company_id: string | null;
  company_name: string | null;
  company_industry: string | null;
  member_count: number;
  unread: number;
  last_text: string | null;
  last_at: string | null;
  last_is_system: boolean | null;
};

type DmRow = {
  id: string;
  other_id: string;
  other_name: string;
  other_role: string;
  other_avatar: Avatar | null;
  unread: number;
  last_text: string | null;
  last_at: string | null;
};

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const current = await requireCurrent();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "dm";
  const supabase = await createClient();
  const ws = current.workspace.id;

  const [channelsRes, dmRes, membersRes] = await Promise.all([
    supabase.rpc("list_channels", { p_workspace_id: ws }),
    supabase.rpc("list_dm_threads", { p_workspace_id: ws }),
    supabase.rpc("list_members", { p_workspace_id: ws }),
  ]);

  const channels = (channelsRes.data ?? []) as unknown as ChannelRow[];
  const dms = (dmRes.data ?? []) as unknown as DmRow[];
  const members = (membersRes.data ?? []) as unknown as MemberRowData[];

  const groups = channels.filter((c) => c.kind === "group");
  const companies = channels.filter((c) => c.kind === "company");

  const unread = {
    dm: dms.reduce((n, d) => n + Number(d.unread), 0),
    group: groups.reduce((n, c) => n + Number(c.unread), 0),
    company: companies.reduce((n, c) => n + Number(c.unread), 0),
    members: 0,
  };

  const active = members.filter((m) => m.status === "active");

  return (
    <>
      <ScreenHeader title="チャンネル" subtitle={current.workspace.name} />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-1.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            const badge = unread[t.key];
            return (
              <Link
                key={t.key}
                href={t.key === "dm" ? "/channels" : `/channels?tab=${t.key}`}
                className={`relative flex-1 text-center text-xs font-bold py-2.5 ${on ? "anim-chip" : ""}`}
                style={{
                  background: on ? SOFT.pink : "#fff",
                  color: on ? "#B03060" : "#9AA0A6",
                  border: `2px solid ${on ? C.pink : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                {t.label}
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                    style={{ background: C.red }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── 個人（DM） ── */}
        {tab === "dm" && (
          <div className="space-y-3">
            {active.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto no-bar py-1">
                {active
                  .filter((m) => !m.is_me)
                  .map((m) => (
                    <Link
                      key={m.id}
                      href={`/channels?tab=members`}
                      className="flex flex-col items-center gap-1 shrink-0 w-16"
                    >
                      <MemberDot name={m.name} avatar={m.avatar} size={44} />
                      <span className="text-[10px] font-bold truncate w-full text-center">
                        {m.name}
                      </span>
                    </Link>
                  ))}
              </div>
            )}

            {dms.length === 0 ? (
              <EmptyState
                shape="flower"
                color="pink"
                title="1対1の会話はまだありません"
                desc={"メンバータブから相手を選ぶと始められます。"}
              />
            ) : (
              dms.map((dm, i) => (
                <Link
                  key={dm.id}
                  href={`/channels/dm/${dm.id}`}
                  className="flex items-center gap-3 p-3.5 bg-white anim-item"
                  style={{
                    borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
                    border: `2px solid ${C.line}`,
                  }}
                >
                  <MemberDot name={dm.other_name} avatar={dm.other_avatar} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-extrabold truncate">{dm.other_name}</div>
                    <div className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
                      {dm.last_text ?? dm.other_role}
                    </div>
                  </div>
                  {Number(dm.unread) > 0 && <Badge n={Number(dm.unread)} />}
                </Link>
              ))
            )}
          </div>
        )}

        {/* ── グループ ── */}
        {tab === "group" && (
          <div className="space-y-2.5">
            {groups.length === 0 ? (
              <EmptyState
                shape="clover"
                color="green"
                title="グループはまだありません"
                desc={"案件ごと・チームごとに話す場所を作れます。"}
              />
            ) : (
              groups.map((ch, i) => (
                <ChannelLink key={ch.id} channel={ch} index={i} />
              ))
            )}
            <GroupSheet members={active as unknown as PickMember[]} />
          </div>
        )}

        {/* ── 会社 ── */}
        {tab === "company" && (
          <div className="space-y-2.5">
            {companies.length === 0 ? (
              <EmptyState
                shape="hex"
                color="purple"
                title="会社チャンネルはまだありません"
                desc={"名刺を登録すると自動で作られます。"}
              />
            ) : (
              companies.map((ch, i) => <ChannelLink key={ch.id} channel={ch} index={i} />)
            )}
          </div>
        )}

        {/* ── メンバー ── */}
        {tab === "members" && (
          <div className="space-y-2.5">
            {members.map((m, i) => (
              <MemberRow key={m.id} member={m} index={i} />
            ))}
            <Link href="/settings" className="block">
              <p className="text-xs font-bold text-center py-3" style={{ color: C.purple }}>
                メンバーを増やす（設定）
              </p>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function ChannelLink({ channel, index }: { channel: ChannelRow; index: number }) {
  const art =
    channel.kind === "company"
      ? companyArt(channel.company_industry ?? undefined)
      : { shape: (channel.shape ?? "flower") as ShapeKey, color: (channel.color ?? "purple") as ColorKey };

  return (
    <Link
      href={`/channels/${channel.id}`}
      className="flex items-center gap-3 p-3.5 bg-white anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${C.line}`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      }}
    >
      <ShapeIcon shape={art.shape as ShapeKey} color={art.color as ColorKey} size={44} />
      <div className="flex-1 min-w-0">
        <div className="text-base font-extrabold truncate">{channel.name ?? "（名前なし）"}</div>
        <div className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
          {channel.last_text ?? `${channel.member_count}人`}
        </div>
      </div>
      {Number(channel.unread) > 0 && <Badge n={Number(channel.unread)} />}
    </Link>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      className="min-w-[20px] h-5 px-1.5 shrink-0 flex items-center justify-center text-[11px] font-extrabold text-white rounded-full anim-badge"
      style={{ background: C.red }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
