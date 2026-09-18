import { C, SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import type { Avatar } from "@/types/db";
import { ShapeIcon } from "./ShapeIcon";

type Props = {
  name: string;
  avatar?: Avatar | null;
  size?: number;
};

/** メンバーのアバター。写真 / シンボル / 頭文字 の3形態。 */
export function MemberDot({ name, avatar, size = 26 }: Props) {
  const base = "relative inline-flex shrink-0 rounded-full border-[2.5px] border-white";

  if (avatar?.kind === "photo" && avatar.src) {
    return (
      <span className={`${base} overflow-hidden`} style={{ width: size, height: size }} title={name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar.src} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }

  if (avatar?.kind === "shape") {
    const col = (avatar.color as ColorKey) || "purple";
    return (
      <span
        className={`${base} items-center justify-center overflow-hidden`}
        style={{ width: size, height: size, background: SOFT[col as keyof typeof SOFT] ?? "#EEE" }}
        title={name}
      >
        <ShapeIcon shape={avatar.shape as ShapeKey} color={col} size={Math.round(size * 0.72)} />
      </span>
    );
  }

  // 頭文字
  const cols: ColorKey[] = ["purple", "green", "pink", "orange", "blue", "red", "yellow"];
  const col = cols[name.charCodeAt(0) % cols.length];
  return (
    <span
      className={`${base} items-center justify-center`}
      style={{ width: size, height: size, background: C[col] }}
      title={name}
    >
      <span className="font-bold text-white" style={{ fontSize: size * 0.42 }}>
        {name.charAt(0)}
      </span>
    </span>
  );
}
