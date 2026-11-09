import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { aiConfigured } from "@/lib/ai-mail";
import { gmailSendState } from "@/lib/gmail-send";
import { slotLabel } from "@/lib/slots";
import { composeSource } from "./context";
import { ComposeClient } from "./ComposeClient";

// AI の下書きと Gmail での送信を、この画面から呼ぶ
export const maxDuration = 60;

type Params = { company?: string; contact?: string; reply?: string; slots?: string; d?: string; f?: string; booking?: string };

/** AIメール作成（SCREENS 9）。返信（?reply=）・日程の候補（?slots=）・予約ページ（?booking=）からも来る */
export default async function ComposePage({ searchParams }: { searchParams: Promise<Params> }) {
  const current = await requireCurrent();
  const p = await searchParams;

  const src = await composeSource(current, { companyId: p.company, contactId: p.contact, replyId: p.reply });

  if (!src) {
    const supabase = await createClient();
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("workspace_id", current.workspace.id)
      .is("archived_at", null)
      .order("name")
      .limit(300);
    return (
      <>
        <ScreenHeader title="メールを作る" subtitle="どの会社に送りますか？" />
        <div className="px-4 py-4 space-y-2">
          {(companies ?? []).map((c, i) => (
            <Link
              key={c.id}
              href={`/mail/compose?company=${c.id}`}
              className="block bg-white px-4 py-3 text-sm font-extrabold"
              style={{ border: `2px solid ${C.line}`, borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px" }}
            >
              {c.name}
            </Link>
          ))}
          {!companies?.length && (
            <EmptyState shape="square" color="blue" title="会社がまだありません" desc="名刺を登録すると、ここに並びます。" />
          )}
        </div>
      </>
    );
  }

  const slots = (p.slots ?? "").split(",").filter((s) => Number.isFinite(Date.parse(s))).slice(0, 4);
  const durationMin = Number(p.d) || 60;
  const send = await gmailSendState(current.workspace.id);

  return (
    <>
      <ScreenHeader
        title={src.reply ? "AIで返信" : "メールを作る"}
        subtitle={src.ctx.companyName}
        actions={
          <Link
            href={`/customers/${src.companyId}?tab=mail`}
            className="inline-flex items-center gap-0.5 text-xs font-bold"
            style={{ color: "#9AA0A6" }}
          >
            <ChevronLeft size={14} strokeWidth={3} />
            会社へ
          </Link>
        }
      />
      <div className="px-4 py-4">
        <ComposeClient
          companyId={src.companyId}
          contactId={src.contactId}
          replyId={src.reply?.id ?? null}
          replySubject={src.reply?.subject ?? null}
          recipients={src.recipients}
          slots={slots}
          slotLabels={slots.map((s) => slotLabel(s, durationMin))}
          durationMin={durationMin}
          bookingUrl={p.booking ?? null}
          aiReady={aiConfigured()}
          canSend={send.ok}
          fromAddress={send.ok ? send.email : null}
        />
      </div>
    </>
  );
}
