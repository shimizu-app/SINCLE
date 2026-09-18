import type { ColorKey, ShapeKey } from "@/lib/design";
import { ShapeIcon } from "./ShapeIcon";

/** 設定などの見出し。アイコン＋タイトル＋一行説明。 */
export function SectionHead({
  shape,
  color,
  title,
  desc,
}: {
  shape: ShapeKey;
  color: ColorKey;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 mb-2 px-1">
      <ShapeIcon shape={shape} color={color} size={30} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-base font-extrabold leading-tight">{title}</div>
        {desc && (
          <div className="text-[11px] font-bold leading-snug mt-0.5" style={{ color: "#8A8A8A" }}>
            {desc}
          </div>
        )}
      </div>
    </div>
  );
}
