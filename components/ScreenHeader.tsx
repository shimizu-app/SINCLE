import type { ReactNode } from "react";
import { C } from "@/lib/design";

/** 画面上部の見出し。右側にアクションを置ける。 */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 bg-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3"
      style={{ borderBottom: `2px solid ${C.line}`, borderRadius: "0 0 14px 28px" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
