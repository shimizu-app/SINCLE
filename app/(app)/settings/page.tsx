import { headers } from "next/headers";
import { C, type ColorKey, type ShapeKey } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHead, ShapeIcon } from "@/components/ui";
import { MemberAdmin, type JoinRequest, type MemberInfo } from "./MemberAdmin";
import { StageAdmin, type StageRow } from "./StageAdmin";
import { GoogleCalendarCard, type GoogleCardProps } from "./GoogleCalendarCard";
import { GmailCard, type GmailCardProps, type MailContact } from "./GmailCard";
import { googleLink, listCalendars } from "@/lib/google";
import { gmailState } from "@/lib/gmail";
import { signOut } from "@/app/auth/actions";

/** まだ入っていない設定。入ったものはここから外す。 */
const LATER: { shape: ShapeKey; color: ColorKey; title: string; desc: string; phase: string }[] = [
  { shape: "stamp", color: "red", title: "セキュリティ", desc: "Face ID でのロック", phase: "フェーズ4" },
];

/** Google から戻ってきたときの一言（?google=…） */
function googleNotice(result?: string, detail?: string): { tone: "ok" | "ng"; text: string } | undefined {
  switch (result) {
    case "connected":
      return { tone: "ok", text: "Google カレンダーをつなぎました。タスクのカレンダーに予定が並びます。" };
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
      return undefined;
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; detail?: string }>;
}) {
  const current = await requireCurrent();
  const { google: googleResult, detail } = await searchParams;
  const supabase = await createClient();

  const [{ data: members }, { data: requests }] = await Promise.all([
    supabase.rpc("list_members", { p_workspace_id: current.workspace.id }),
    supabase
      .from("join_requests")
      .select("id, email, name, via")
      .eq("workspace_id", current.workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  const { data: stages } = await supabase
    .from("stages")
    .select("id, name, position")
    .eq("workspace_id", current.workspace.id)
    .order("position", { ascending: true });

  // Google カレンダー。つながっていれば、選べるカレンダーの一覧も取る
  const link = await googleLink(current.workspace.id);
  const google: GoogleCardProps =
    link.state === "connected"
      ? {
          state: "connected",
          email: link.email,
          selected: link.calendarIds,
          calendars: await listCalendars(link.token),
        }
      : link;

  // Gmail。連携は Google カレンダーと同じ行を使う
  const [gmail, { data: mailContacts }] = await Promise.all([
    gmailState(current.workspace.id, link),
    supabase
      .from("contacts")
      .select("id, name, email, mail_watch, companies(name)")
      .eq("workspace_id", current.workspace.id)
      .is("archived_at", null)
      .not("email", "is", null)
      .order("name")
      .limit(500),
  ]);
  // トークンは画面（ブラウザ）に渡さない。必要なものだけ取り出す
  const gmailProps: GmailCardProps = {
    state: gmail.state,
    email: "email" in gmail ? gmail.email : null,
    scope: gmail.state === "connected" ? gmail.scope : "registered",
    lastSyncAt: gmail.state === "connected" ? gmail.lastSyncAt : null,
    migration: gmail.state === "needs_migration" ? gmail.migration : undefined,
    contacts: ((mailContacts ?? []) as unknown as {
      id: string;
      name: string;
      email: string | null;
      mail_watch: boolean;
      companies: { name: string } | null;
    }[])
      .filter((c) => c.email)
      .map(
        (c): MailContact => ({
          id: c.id,
          name: c.name,
          email: c.email as string,
          company: c.companies?.name ?? null,
          mail_watch: c.mail_watch,
        })
      ),
  };

  // 招待リンクの見本に使う。ヘッダーから今のURLを組み立てる。
  const host = (await headers()).get("host") ?? "localhost:3000";
  const siteUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const card = {
    borderRadius: "26px 13px 26px 13px",
    border: `2.5px solid ${C.line}`,
  } as const;

  return (
    <>
      <ScreenHeader title="設定" subtitle="アプリ全体の設定です" />

      <div className="px-4 py-4 space-y-6">
        <section>
          <SectionHead shape="flower" color="purple" title="ワークスペース" desc="いま開いている場所と、参加しているメンバー" />
          <div className="bg-white p-4 space-y-4" style={card}>
            <div className="flex items-center gap-3">
              <ShapeIcon
                shape={current.workspace.shape as ShapeKey}
                color={current.workspace.color as ColorKey}
                size={48}
              />
              <div className="min-w-0">
                <div className="text-base font-extrabold truncate">{current.workspace.name}</div>
                <div className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
                  /{current.workspace.slug}
                  {current.workspace.domain && ` ・ @${current.workspace.domain}`}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── メンバーの管理（SPEC 4章の3経路） ── */}
        <MemberAdmin
          members={(members ?? []) as unknown as MemberInfo[]}
          requests={(requests ?? []) as unknown as JoinRequest[]}
          isAdmin={current.member.is_admin}
          domain={current.workspace.domain}
          openJoin={current.workspace.open_join}
          siteUrl={siteUrl}
        />

        <section>
          <SectionHead shape="wave" color="blue" title="商談の進み具合" desc="いまの流れ。段階の名前と並びを変えられます" />
          <StageAdmin stages={(stages ?? []) as StageRow[]} isAdmin={current.member.is_admin} />
        </section>

        <section id="google">
          <SectionHead
            shape="arch"
            color="green"
            title="Google カレンダー"
            desc="あなたの予定を、タスクのカレンダーに並べます"
          />
          <GoogleCalendarCard {...google} notice={googleNotice(googleResult, detail)} />
        </section>

        <section id="gmail">
          <SectionHead
            shape="square"
            color="blue"
            title="Gmail"
            desc="登録した相手とのメールを、会社ごとの履歴に取り込みます"
          />
          <GmailCard {...gmailProps} />
        </section>

        <section>
          <SectionHead shape="blob" color="orange" title="これから入るもの" desc="フェーズごとに順番に足していきます" />
          <div className="space-y-2">
            {LATER.map((item, i) => (
              <div
                key={item.title}
                className="flex items-center gap-3 bg-white p-3.5 opacity-60"
                style={{
                  borderRadius: i % 2 ? "22px 11px 22px 11px" : "11px 22px 11px 22px",
                  border: `2px solid ${C.line}`,
                }}
              >
                <ShapeIcon shape={item.shape} color={item.color} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold truncate">{item.title}</div>
                  <div className="text-[11px] font-bold truncate" style={{ color: "#9AA0A6" }}>
                    {item.desc}
                  </div>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: "#C8C2B6" }}>
                  {item.phase}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHead shape="drop" color="red" title="アカウント" desc={current.email} />
          <form action={signOut}>
            <button
              type="submit"
              className="w-full bg-white py-3.5 text-sm font-extrabold"
              style={{ ...card, color: C.red }}
            >
              サインアウト
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
