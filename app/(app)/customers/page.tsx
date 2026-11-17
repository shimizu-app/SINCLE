import Link from "next/link";
import { Mail, Plus, Search, Settings } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { OrganicButton } from "@/components/ui";
import { hasFilter, isSortKey, type CustomerQuery } from "@/lib/customers";
import { loadCompanyGroups, loadCustomers } from "@/lib/customers.server";
import { createClient } from "@/lib/supabase/server";
import { CustomerControls } from "./CustomerControls";
import { CompanyCard } from "./CompanyCard";
import { GroupCard } from "./GroupCard";
import { LockedAll } from "./LockedAll";
import { ScopeSwitch } from "./ScopeSwitch";
import { DealList, type DealRow, type Owner } from "./DealList";
import {
  KeyPersons, type ContactOption, type KeyFacet, type KeyPersonRow, type Referral,
} from "./KeyPersons";

/** SCREENS 3 の上部3切り替え。進行中とキーパーソンはフェーズ5。 */
const TABS = [
  { key: "company", label: "会社" },
  { key: "deals", label: "進行中" },
  { key: "keypersons", label: "キーパーソン" },
] as const;

type Params = {
  tab?: string;
  genre?: string | string[];
  scope?: string | string[];
  pref?: string | string[];
  layer?: string | string[];
  q?: string;
  tier?: string;
  industry?: string;
  deal?: string;
  sort?: string;
  /** all＝全社のまとめ（「全員の名刺を見る」許可がある人だけ） */
  view?: string;
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const current = await requireCurrent();
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "company";

  const query: CustomerQuery = {
    q: params.q,
    tier: params.tier,
    industry: params.industry,
    deal: params.deal,
    sort: isSortKey(params.sort) ? params.sort : "new",
  };

  // 「個人」と「会社全体」の切り替え（023）。
  // 会社全体（全員の登録）は、許可がある人だけが開ける。無い人には鍵をかけて見せる
  const canViewAll = Boolean(current.member.can_view_all);
  const wantAll = params.view === "all";
  const viewAll = canViewAll && wantAll;
  const locked = wantAll && !canViewAll;

  const [{ companies, counts, facets, error }, groupsRes] = await Promise.all([
    loadCustomers(current.workspace.id, query),
    viewAll
      ? loadCompanyGroups(current.workspace.id, { q: params.q, tier: params.tier })
      : Promise.resolve({ groups: [], error: null }),
  ]);

  // 進行中とキーパーソンは、そのタブを開いたときだけ引く
  const supabase = await createClient();
  const ws = current.workspace.id;
  const many = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v : [v];

  // 鍵の画面に出す管理者（許可をお願いする相手）
  const { data: admins } = locked
    ? await supabase
        .from("workspace_members")
        .select("id, name")
        .eq("workspace_id", ws)
        .eq("is_admin", true)
        .eq("status", "active")
        .order("created_at")
    : { data: [] };

  const [dealsRes, ownersRes] =
    !wantAll && tab === "deals"
      ? await Promise.all([
          supabase.rpc("list_deals", { p_workspace_id: ws, p_sort: "stale" }),
          supabase
            .from("workspace_members")
            .select("id, name")
            .eq("workspace_id", ws)
            .eq("status", "active")
            .order("created_at"),
        ])
      : [{ data: [] }, { data: [] }];

  const [keyRes, refRes, keyFacetRes, contactRes] =
    !wantAll && tab === "keypersons"
      ? await Promise.all([
          supabase.rpc("list_key_persons", {
            p_workspace_id: ws,
            p_genres: many(params.genre),
            p_scopes: many(params.scope),
            p_prefs: many(params.pref),
            p_layers: many(params.layer),
          }),
          supabase
            .from("referrals")
            .select("id, key_person_id, to_name, result, happened_at")
            .eq("workspace_id", ws)
            .order("happened_at", { ascending: false, nullsFirst: false }),
          supabase.rpc("key_person_facets", { p_workspace_id: ws }),
          supabase
            .from("contacts")
            .select("id, name, title, companies(name)")
            .eq("workspace_id", ws)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(200),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const contactOptions: ContactOption[] = ((contactRes.data ?? []) as unknown as {
    id: string;
    name: string;
    title: string | null;
    companies: { name: string } | null;
  }[]).map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    company: c.companies?.name ?? "",
  }));

  const groups = groupsRes.groups;
  const stats = viewAll
    ? [
        { label: "社（会社全体）", value: groups.length, color: "purple" as const },
        { label: "何人かが登録", value: groups.filter((g) => g.record_count > 1).length, color: "pink" as const },
        { label: "名刺", value: groups.reduce((n, g) => n + Number(g.contact_count), 0), color: "yellow" as const },
      ]
    : locked
      ? []
      : [
          { label: "社", value: counts.companies, color: "purple" as const },
          { label: "Tier A", value: counts.tier_a, color: "pink" as const },
          { label: "未完了", value: counts.open_tasks, color: "yellow" as const },
        ];

  const keep = (next: string) => {
    const sp = new URLSearchParams();
    if (next !== "company") sp.set("tab", next);
    return sp.toString() ? `/customers?${sp}` : "/customers";
  };

  return (
    <>
      <ScreenHeader
        title="顧客"
        subtitle={current.workspace.name}
        actions={
          <>
            <Link
              href="/mail"
              aria-label="メール"
              className="relative w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "14px 7px 14px 7px", background: SOFT.blue }}
            >
              <Mail size={18} strokeWidth={2.5} style={{ color: C.blue }} />
              {counts.unreplied_mails > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                  style={{ background: C.red }}
                >
                  {counts.unreplied_mails}
                </span>
              )}
            </Link>
            <Link
              href="/customers/new"
              aria-label="追加"
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "7px 14px 7px 14px", background: SOFT.green }}
            >
              <Plus size={18} strokeWidth={3} style={{ color: C.green }} />
            </Link>
            <Link
              href="/settings"
              aria-label="設定"
              className="w-10 h-10 flex items-center justify-center"
              style={{ borderRadius: "14px 7px 14px 7px", background: SOFT.purple }}
            >
              <Settings size={18} strokeWidth={2.5} style={{ color: C.purple }} />
            </Link>
          </>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* ── 個人 ／ 会社全体 ── */}
        <ScopeSwitch view={wantAll ? "all" : "mine"} canViewAll={canViewAll} />

        {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="bg-white px-3 py-2.5 anim-item"
              style={{
                borderRadius: i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
                border: `2px solid ${C.line}`,
                animationDelay: `${i * 45}ms`,
              }}
            >
              <div className="text-2xl font-extrabold leading-none" style={{ color: C[s.color] }}>
                {s.value}
              </div>
              <div className="text-[11px] font-bold mt-1" style={{ color: "#9AA0A6" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        )}

        {locked && (
          <LockedAll
            admins={admins ?? []}
            isAdmin={current.member.is_admin}
            myMemberId={current.member.id}
          />
        )}

        {!wantAll && (
        <div className="flex gap-1.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Link
                key={t.key}
                href={keep(t.key)}
                className={`flex-1 text-center text-sm font-bold py-2.5 ${on ? "anim-chip" : ""}`}
                style={{
                  background: on ? SOFT.purple : "#fff",
                  color: on ? C.purple : "#9AA0A6",
                  border: `2px solid ${on ? C.purple : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        )}

        {viewAll && (
          <>
            <form action="/customers" className="flex gap-2">
              <input type="hidden" name="view" value="all" />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="会社名・名刺の名前・メールで探す"
                className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-bold outline-none bg-white"
                style={{ border: `2px solid ${C.line}`, borderRadius: "18px 9px 18px 9px" }}
              />
              <button
                type="submit"
                aria-label="探す"
                className="w-11 shrink-0 flex items-center justify-center"
                style={{ background: C.purple, borderRadius: "14px 7px 14px 7px" }}
              >
                <Search size={16} strokeWidth={2.8} className="text-white" />
              </button>
            </form>
            <p className="text-[11px] font-bold leading-relaxed px-1" style={{ color: "#9AA0A6" }}>
              全員が登録した名刺を、会社ごとに1つにまとめています。見るだけで、人の会社は書き換えられません。
            </p>
            {groupsRes.error && (
              <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
                {groupsRes.error}
              </p>
            )}
            {groups.length > 0 ? (
              <div className="space-y-2.5">
                {params.q && (
                  <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
                    {groups.length}社が該当しました
                  </p>
                )}
                {groups.map((group, i) => (
                  <GroupCard key={group.key} group={group} index={i} />
                ))}
              </div>
            ) : (
              !groupsRes.error && (
                <EmptyState
                  shape="cloud"
                  color="blue"
                  title={params.q ? "見つかりませんでした" : "まだ誰も登録していません"}
                  desc={params.q ? "言葉を変えて探してみてください。" : "名刺を登録すると、ここに全員のぶんが集まります。"}
                />
              )
            )}
          </>
        )}

        {!wantAll && tab === "company" && (
          <>
            <CustomerControls facets={facets} />

            {error && (
              <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
                {error}
              </p>
            )}

            {companies.length > 0 ? (
              <div className="space-y-2.5">
                {hasFilter(query) && (
                  <p className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
                    {companies.length}社が該当しました
                  </p>
                )}
                {companies.map((company, i) => (
                  <CompanyCard key={company.id} company={company} index={i} />
                ))}
              </div>
            ) : hasFilter(query) ? (
              <EmptyState
                shape="cloud"
                color="blue"
                title="見つかりませんでした"
                desc={"条件を変えるか、絞り込みを外してみてください。"}
              >
                <Link href="/customers" className="inline-block pt-1">
                  <OrganicButton type="button" size="md" variant="outline" color="blue">
                    条件をすべて外す
                  </OrganicButton>
                </Link>
              </EmptyState>
            ) : (
              <EmptyState
                shape="hex"
                color="purple"
                title="まだ顧客がいません"
                desc={"名刺を登録すると、会社・チャンネル・最初のタスクまで\n自動で用意されます。"}
              >
                <Link href="/customers/new" className="inline-block pt-1">
                  <OrganicButton type="button" size="md" color="green">
                    名刺を登録する
                  </OrganicButton>
                </Link>
              </EmptyState>
            )}
          </>
        )}

        {!wantAll && tab === "deals" && (
          <DealList
            deals={(dealsRes.data ?? []) as unknown as DealRow[]}
            owners={(ownersRes.data ?? []) as unknown as Owner[]}
          />
        )}

        {!wantAll && tab === "keypersons" && (
          <KeyPersons
            people={(keyRes.data ?? []) as unknown as KeyPersonRow[]}
            referrals={(refRes.data ?? []) as unknown as Referral[]}
            facets={(keyFacetRes.data ?? []) as unknown as KeyFacet[]}
            contacts={contactOptions}
          />
        )}
      </div>
    </>
  );
}
