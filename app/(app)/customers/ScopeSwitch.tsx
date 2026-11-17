import Link from "next/link";
import { Building2, Lock, User } from "lucide-react";
import { C } from "@/lib/design";

/**
 * 顧客の「個人」と「会社全体」の切り替え（023）。
 * 会社全体（全員の登録）は許可がある人だけ。無い人には鍵の印を出す（押すと鍵の画面）。
 */
export function ScopeSwitch({ view, canViewAll }: { view: "mine" | "all"; canViewAll: boolean }) {
  const items = [
    { key: "mine", label: "個人", sub: "自分の登録", href: "/customers", Icon: User },
    {
      key: "all",
      label: "会社全体",
      sub: canViewAll ? "全員の登録" : "許可が必要",
      href: "/customers?view=all",
      Icon: canViewAll ? Building2 : Lock,
    },
  ] as const;

  return (
    <div
      className="grid grid-cols-2 p-1 gap-1 bg-white"
      role="tablist"
      aria-label="見る範囲"
      style={{ border: `2px solid ${C.line}`, borderRadius: "18px 9px 18px 9px" }}
    >
      {items.map(({ key, label, sub, href, Icon }) => {
        const on = view === key;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={on}
            className="flex items-center justify-center gap-1.5 py-2 min-w-0"
            style={{
              background: on ? C.ink : "transparent",
              color: on ? "#fff" : "#6B6B6B",
              borderRadius: "14px 7px 14px 7px",
            }}
          >
            <Icon size={15} strokeWidth={2.6} className="shrink-0" />
            <span className="text-sm font-extrabold shrink-0">{label}</span>
            <span className="text-[10px] font-bold truncate" style={{ opacity: 0.7 }}>
              {sub}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
