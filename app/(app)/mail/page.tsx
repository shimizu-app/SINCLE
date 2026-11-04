import Link from "next/link";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { gmailState } from "@/lib/gmail";
import { GMAIL_SCOPES } from "@/lib/mail-parse";
import { GmailConnect } from "./GmailConnect";
import { MailList } from "./MailList";
import { MailSync } from "./MailSync";
import { MAIL_FILTERS, isMailFilter, loadMails } from "./load";

// 取り込み（syncGmailNow）はこの画面から呼ぶ。Gmail を何十件も読むので長めに取る
export const maxDuration = 60;

/** Google から戻ってきたときの一言（?google=…） */
function notice(result?: string, detail?: string): { tone: "ok" | "ng"; text: string } | null {
  switch (result) {
    case "connected":
      return { tone: "ok", text: "Gmail をつなぎました。登録した相手とのメールを取り込みます。" };
    case "no_gmail":
      return {
        tone: "ng",
        text: "Google にはつながりましたが、Gmail の許可にチェックが入っていませんでした。もう一度つないで、Gmail の項目にチェックを入れてください。",
      };
    case "denied":
      return {
        tone: "ng",
        text:
          detail === "access_denied"
            ? "Google 側で許可されませんでした。同意画面が「テスト中」の間は、テストユーザーに登録した Google アカウントでしかつなげません。"
            : `Google 側で止められました（${detail ?? "理由不明"}）。`,
      };
    case "state":
      return { tone: "ng", text: "途中で別の画面に移ったため、つなげませんでした。もう一度お試しください。" };
    case "unconfigured":
      return { tone: "ng", text: "Google 連携の設定（環境変数）が足りません。" };
    case "failed":
      return { tone: "ng", text: `つなげませんでした。${detail ?? ""}` };
    default:
      return null;
  }
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; google?: string; detail?: string }>;
}) {
  const current = await requireCurrent();
  const { f, google, detail } = await searchParams;
  const filter = isMailFilter(f) ? f : "all";
  const supabase = await createClient();

  const [gmail, items, watchedRes, optedOutRes] = await Promise.all([
    gmailState(current.workspace.id),
    loadMails(current.workspace.id, { filter }),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", current.workspace.id)
      .is("archived_at", null)
      .not("email", "is", null)
      .eq("mail_watch", true),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", current.workspace.id)
      .is("archived_at", null)
      .not("email", "is", null)
      .eq("mail_watch", false),
  ]);

  const said = notice(google, detail);

  return (
    <>
      <ScreenHeader title="メール" subtitle={current.workspace.name} />
      <div className="px-4 py-4 space-y-4">
        {said && (
          <p
            className="text-xs font-bold px-3 py-2.5"
            style={{
              background: said.tone === "ok" ? SOFT.green : SOFT.red,
              color: said.tone === "ok" ? C.green : C.red,
              borderRadius: "14px 7px 14px 7px",
            }}
            role="status"
          >
            {said.text}
          </p>
        )}

        {gmail.state === "connected" ? (
          <MailSync
            scopeLabel={GMAIL_SCOPES.find((s) => s.key === gmail.scope)?.label ?? "登録した相手だけ"}
            watched={watchedRes.count ?? 0}
            optedOut={optedOutRes.count ?? 0}
            email={gmail.email}
            lastSyncAt={gmail.lastSyncAt}
            last={gmail.stats}
          />
        ) : (
          <GmailConnect state={gmail} />
        )}

        {/* 絞り込み：すべて / 未返信 / 受信 / 送信 */}
        <nav className="flex gap-1.5 overflow-x-auto no-bar">
          {MAIL_FILTERS.map(([key, label]) => {
            const on = filter === key;
            return (
              <Link
                key={key}
                href={key === "all" ? "/mail" : `/mail?f=${key}`}
                className={`text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                style={{
                  background: on ? C.ink : "#fff",
                  color: on ? "#fff" : "#6B6B6B",
                  border: `2px solid ${on ? C.ink : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {items.length ? (
          <MailList items={items} />
        ) : (
          <EmptyState
            shape="square"
            color="blue"
            title={filter === "unreplied" ? "未返信のメールはありません" : "メールはまだありません"}
            desc={
              gmail.state === "connected"
                ? "登録した相手とのやりとりが、ここに並びます。"
                : "Gmail をつなぐと、登録した相手とのやりとりがここに並びます。"
            }
          />
        )}

        <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: "#9AA0A6" }}>
          ここに並ぶのは、チームのメンバーが Gmail から取り込んだメールです（全員に見えます）。
          AIでの返信の下書きは、これから入ります。
        </p>
      </div>
    </>
  );
}
