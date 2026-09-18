"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C, SOFT, FEATURE } from "@/lib/design";
import { FeatureIcon } from "@/components/ui";

/** SCREENS「ナビゲーション」の5つ。メールはここに置かない。 */
const TABS = [
  { href: "/customers", key: "customers", label: "顧客" },
  { href: "/channels", key: "channels", label: "チャンネル" },
  { href: "/scan", key: "scan", label: "スキャン" },
  { href: "/tasks", key: "tasks", label: "タスク" },
  { href: "/roadmap", key: "roadmap", label: "計画" },
] as const;

export function BottomNav({ badges }: { badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white flex items-end justify-around px-2 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      style={{ borderTop: `2px solid ${C.line}` }}
    >
      {TABS.map((tab) => {
        const on = pathname.startsWith(tab.href);
        const badge = badges?.[tab.key] ?? 0;
        const tone = FEATURE[tab.key].color;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={on ? "page" : undefined}
            className="relative flex-1 flex flex-col items-center gap-1 px-1 py-1"
          >
            {on && (
              <span
                className="absolute anim-navblob"
                style={{
                  width: 52,
                  height: 52,
                  top: -2,
                  borderRadius: "22px 10px 22px 10px",
                  background: SOFT[tone as keyof typeof SOFT] ?? SOFT.purple,
                }}
              />
            )}
            <span
              className={`relative ${on ? "anim-iconpop" : ""}`}
              style={{
                transition: "transform .24s cubic-bezier(.34,1.56,.64,1)",
                transform: on ? "translateY(-3px)" : "none",
              }}
            >
              <FeatureIcon name={tab.key} size={34} />
              {badge > 0 && (
                <span
                  className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                  style={{ background: C.red }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className="relative text-[11px] font-bold whitespace-nowrap"
              style={{ color: on ? C.purple : "#9AA0A6", transition: "color .2s ease" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
