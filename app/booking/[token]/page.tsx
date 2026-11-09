import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { C } from "@/lib/design";
import { SyncleMark } from "@/components/ui";
import { BookingClient } from "./BookingClient";
import { slotLabel } from "@/lib/slots";

export const metadata: Metadata = {
  title: "打合せの日程を選ぶ",
  robots: { index: false, follow: false },
};

/** 予約ページ（SCREENS 10）。お客さまが開く。ログインは要らない */
export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("booking_page", { p_token: token });
  const b = data?.[0];

  return (
    <main className="min-h-dvh px-4 py-8 flex flex-col items-center" style={{ background: C.bg }}>
      <div className="w-full max-w-md space-y-5">
        {!b ? (
          <Note title="ページが見つかりません" text="URL が正しいか、担当者にご確認ください。" />
        ) : (
          <>
            <header className="space-y-1.5 text-center">
              <div className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
                {b.workspace_name}
                {b.organizer_name ? ` ・ ${b.organizer_name}` : ""}
              </div>
              <h1 className="text-xl font-extrabold leading-snug">
                {b.contact_name ? `${b.contact_name}様` : `${b.company_name}様`}
                <br />
                打合せの日程を選んでください
              </h1>
              <div className="text-sm font-bold" style={{ color: "#6B6B6B" }}>
                {b.duration_min}分 ・ {b.format}
              </div>
            </header>

            {b.state === "confirmed" ? (
              <Note
                title="日程は確定しています"
                text={b.confirmed_start ? `${slotLabel(b.confirmed_start, b.duration_min)} でお待ちしております。` : "ありがとうございます。"}
              />
            ) : b.state === "expired" || !(Array.isArray(b.slots) && b.slots.length) ? (
              <Note title="このページは期限が切れました" text="お手数ですが、担当者に新しい候補をお尋ねください。" />
            ) : (
              <BookingClient token={token} slots={b.slots as string[]} durationMin={b.duration_min} format={b.format} />
            )}
          </>
        )}

        <footer className="flex items-center justify-center gap-1.5 pt-4 text-[11px] font-bold" style={{ color: "#C8C2B6" }}>
          <SyncleMark size={14} />
          SYNCLE
        </footer>
      </div>
    </main>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="bg-white p-5 text-center space-y-1.5"
      style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` }}
    >
      <div className="text-base font-extrabold">{title}</div>
      <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
        {text}
      </p>
    </div>
  );
}
