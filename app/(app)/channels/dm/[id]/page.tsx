import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { C } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { MemberDot } from "@/components/ui";
import { MessageStream, type StreamMessage } from "../../MessageStream";
import type { Avatar } from "@/types/db";

export default async function DmPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  // RLS により、当事者でなければそもそも取れない
  const { data: thread } = await supabase
    .from("dm_threads")
    .select("id, member_a, member_b")
    .eq("id", id)
    .maybeSingle();

  if (!thread) notFound();

  const otherId = thread.member_a === current.member.id ? thread.member_b : thread.member_a;

  const [{ data: other }, { data: rows }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("id, name, role, avatar")
      .eq("id", otherId)
      .maybeSingle(),
    supabase
      .from("dm_messages")
      .select("id, text, created_at, author_id")
      .eq("thread_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const peopleMap: Record<string, { name: string; avatar: Avatar | null }> = {
    [current.member.id]: { name: current.member.name, avatar: current.member.avatar },
  };
  if (other) {
    peopleMap[other.id] = { name: other.name, avatar: other.avatar as unknown as Avatar };
  }

  const messages: StreamMessage[] = (rows ?? []).map((m) => ({
    id: m.id,
    text: m.text,
    created_at: m.created_at,
    author_id: m.author_id,
    author_name: peopleMap[m.author_id]?.name ?? null,
    author_avatar: peopleMap[m.author_id]?.avatar ?? null,
    is_system: false,
  }));

  return (
    <>
      <header
        className="sticky top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-white"
        style={{ borderBottom: `2px solid ${C.line}`, borderRadius: "0 0 14px 28px" }}
      >
        <Link
          href="/channels"
          className="inline-flex items-center gap-1 text-sm font-bold mb-2"
          style={{ color: "#9AA0A6" }}
        >
          <ChevronLeft size={16} strokeWidth={3} />
          チャンネル
        </Link>
        <div className="flex items-center gap-2.5">
          <MemberDot
            name={other?.name ?? "?"}
            avatar={(other?.avatar as unknown as Avatar) ?? null}
            size={36}
          />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold truncate">{other?.name ?? "メンバー"}</h1>
            <p className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
              {other?.role ?? ""}
            </p>
          </div>
        </div>
      </header>

      <MessageStream
        kind="dm"
        targetId={id}
        initial={messages}
        myMemberId={current.member.id}
        people={peopleMap}
        placeholder={other ? `${other.name} さんへ` : "メッセージ"}
      />
    </>
  );
}
