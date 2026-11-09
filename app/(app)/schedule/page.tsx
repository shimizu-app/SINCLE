import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { CALENDAR_WRITE_SCOPE, freeBusy, googleLink, listCalendars } from "@/lib/google";
import { DURATIONS, FORMATS, WEEKS, buildSlots, searchWindow, type DaySlots } from "@/lib/slots";
import { ScheduleClient } from "./ScheduleClient";

type Params = { company?: string; contact?: string; d?: string; f?: string; w?: string; cal?: string };

/** 日程調整（SCREENS 10）：条件 → 空き時間 → メールに入れる / 予約ページを発行 */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<Params> }) {
  const current = await requireCurrent();
  const p = await searchParams;
  const supabase = await createClient();

  // 会社が決まっていなければ、まず会社を選ぶ
  if (!p.company) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("workspace_id", current.workspace.id)
      .is("archived_at", null)
      .order("name")
      .limit(300);
    return (
      <>
        <ScreenHeader title="日程調整" subtitle="どの会社との打合せですか？" />
        <div className="px-4 py-4 space-y-2">
          {(companies ?? []).map((c, i) => (
            <Link
              key={c.id}
              href={`/schedule?company=${c.id}`}
              className="block bg-white px-4 py-3 text-sm font-extrabold"
              style={{
                border: `2px solid ${C.line}`,
                borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
              }}
            >
              {c.name}
            </Link>
          ))}
          {!companies?.length && (
            <EmptyState shape="arch" color="green" title="会社がまだありません" desc="名刺を登録すると、ここに並びます。" />
          )}
        </div>
      </>
    );
  }

  const [{ data: company }, { data: contacts }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name")
      .eq("id", p.company)
      .eq("workspace_id", current.workspace.id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, email, title")
      .eq("company_id", p.company)
      .is("archived_at", null)
      .order("created_at"),
  ]);

  const durationMin = DURATIONS.find((d) => String(d) === p.d) ?? 60;
  const format = FORMATS.find((f) => f === p.f) ?? "Google Meet";
  const weeks = WEEKS.find((w) => String(w) === p.w) ?? 2;
  const contactId = (contacts ?? []).find((c) => c.id === p.contact)?.id ?? contacts?.[0]?.id ?? null;

  const link = await googleLink(current.workspace.id);
  let days: DaySlots[] = [];
  let problem: string | null = null;
  let calendars: { id: string; name: string; primary: boolean }[] = [];
  let chosen: string[] = [];
  let canWrite = false;

  if (link.state === "connected") {
    canWrite = link.scopes.includes(CALENDAR_WRITE_SCOPE);
    const list = await listCalendars(link.token);
    calendars = Array.isArray(list) ? list.map((c) => ({ id: c.id, name: c.name, primary: c.primary })) : [];
    chosen = p.cal
      ? p.cal.split(",").filter(Boolean)
      : link.calendarIds.length
        ? link.calendarIds
        : calendars.filter((c) => c.primary).map((c) => c.id);
    const now = Date.now();
    const { from, to } = searchWindow(now, weeks);
    const fb = await freeBusy(link.token, chosen, new Date(from), new Date(to));
    if ("error" in fb) problem = fb.error;
    else days = buildSlots({ now, weeks, durationMin, busy: fb.busy });
  }

  return (
    <>
      <ScreenHeader
        title="日程調整"
        subtitle={company?.name ?? "会社が見つかりません"}
        actions={
          <Link
            href={company ? `/customers/${company.id}` : "/customers"}
            className="inline-flex items-center gap-0.5 text-xs font-bold"
            style={{ color: "#9AA0A6" }}
          >
            <ChevronLeft size={14} strokeWidth={3} />
            会社へ
          </Link>
        }
      />
      <div className="px-4 py-4 space-y-4">
        {link.state !== "connected" ? (
          <div className="bg-white p-4 space-y-3" style={{ border: `2.5px solid ${C.line}`, borderRadius: "26px 13px 26px 13px" }}>
            <p className="text-sm font-extrabold">Google カレンダーをつなぐと、空き時間が出ます</p>
            <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
              {link.state === "expired"
                ? "連携が切れています。設定からもう一度つないでください。"
                : link.state === "unconfigured"
                  ? "Google 連携の設定（環境変数）がまだです。"
                  : link.state === "needs_migration"
                    ? "データベースの更新（020）がまだです。"
                    : "空き時間は、あなたの Google カレンダーの予定を避けて出します（予定の中身は読みません）。"}
            </p>
            <Link
              href="/settings#google"
              className="block text-center text-sm font-extrabold py-3"
              style={{ background: SOFT.green, color: C.green, borderRadius: "14px 7px 14px 7px" }}
            >
              設定で Google カレンダーをつなぐ
            </Link>
          </div>
        ) : !company ? (
          <EmptyState shape="arch" color="green" title="会社が見つかりません" desc="一覧から選び直してください。" />
        ) : (
          <ScheduleClient
            companyId={company.id}
            companyName={company.name}
            contacts={(contacts ?? []).map((c) => ({ id: c.id, name: c.name, email: c.email, title: c.title }))}
            contactId={contactId}
            durationMin={durationMin}
            format={format}
            weeks={weeks}
            calendars={calendars}
            chosenCalendars={chosen}
            days={days}
            problem={problem}
            canWrite={canWrite}
            hasMeetingUrl={Boolean(current.member.meeting_url)}
          />
        )}
      </div>
    </>
  );
}
