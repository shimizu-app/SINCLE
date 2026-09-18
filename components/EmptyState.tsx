import type { ReactNode } from "react";
import { C, type ColorKey, type ShapeKey } from "@/lib/design";
import { ShapeIcon } from "@/components/ui";

/** まだ中身がない画面。フェーズ1ではこれが並ぶ。 */
export function EmptyState({
  shape,
  color,
  title,
  desc,
  children,
}: {
  shape: ShapeKey;
  color: ColorKey;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="bg-white p-6 space-y-3 text-center anim-item"
      style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` }}
    >
      <div className="flex justify-center">
        <ShapeIcon shape={shape} color={color} size={64} />
      </div>
      <p className="text-base font-extrabold">{title}</p>
      <p className="text-xs font-bold leading-relaxed whitespace-pre-line" style={{ color: "#9AA0A6" }}>
        {desc}
      </p>
      {children}
    </div>
  );
}
