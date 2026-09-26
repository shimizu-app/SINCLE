import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { C, companyArt, type ColorKey, type ShapeKey } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ShapeIcon } from "@/components/ui";
import { MessageStream, type StreamMessage } from "../MessageStream";
import type { Avatar } from "@/types/db";

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*, companies(name, industry)")
    .eq("id", id)
    .eq("workspace_id", current.workspace.id)
    .maybeSingle();

  if (!channel) notFound();

  const company = channel.companies as { name: string; industry: string | null } | null;
  const title = channel.kind === "company" ? company?.name ?? "会社" : channel.name ?? "グループ";

  const [{ data: rows }, { data: people }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, text, created_at, author_id, is_system")
      .eq("channel_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("workspace_members")
      .select("id, name, avatar")
      .eq("workspace_id", current.workspace.id),
  ]);

  const peopleMap = Object.fromEntries(
    (people ?? []).map((p) => [p.id, { name: p.name, avatar: p.avatar as unknown as Avatar }])
  );

  const messages: StreamMessage[] = (rows ?? []).map((m) => ({
    id: m.id,
    text: m.text,
    created_at: m.created_at,
    author_id: m.author_id,
    author_name: m.author_id ? peopleMap[m.author_id]?.name ?? null : null,
    author_avatar: m.author_id ? peopleMap[m.author_id]?.avatar ?? null : null,
    is_system: m.is_system,
  }));

  const art =
    channel.kind === "company"
      ? companyArt(company?.industry ?? undefined)
      : {
          shape: (channel.shape ?? "flower") as ShapeKey,
          color: (channel.color ?? "purple") as ColorKey,
        };

  return (
    <>
      <header
        className="sticky top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-white"
        style={{ borderBottom: `2px solid ${C.line}`, borderRadius: "0 0 14px 28px" }}
      >
        <Link
          href={`/channels?tab=${channel.kind === "company" ? "company" : "group"}`}
          className="inline-flex items-center gap-1 text-sm font-bold mb-2"
          style={{ color: "#9AA0A6" }}
        >
          <ChevronLeft size={16} strokeWidth={3} />
          チャンネル
        </Link>
        <div className="flex items-center gap-2.5">
          <ShapeIcon shape={art.shape as ShapeKey} color={art.color as ColorKey} size={36} />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold truncate">{title}</h1>
            {channel.kind === "company" && channel.company_id && (
              <Link
                href={`/customers/${channel.company_id}`}
                className="text-[11px] font-bold"
                style={{ color: C.purple }}
              >
                会社の詳細を見る
              </Link>
            )}
          </div>
        </div>
      </header>

      <MessageStream
        kind="channel"
        targetId={id}
        initial={messages}
        myMemberId={current.member.id}
        people={peopleMap}
      />
    </>
  );
}
