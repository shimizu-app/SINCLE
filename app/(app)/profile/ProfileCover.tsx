import { SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import { ShapeIcon } from "@/components/ui";
import type { Avatar } from "@/types/db";

const SHAPE_ORDER: ShapeKey[] = ["flower", "clover", "sun", "blob", "hex", "drop", "cloud", "stamp", "wave", "burst"];
const COLOR_ORDER: ColorKey[] = ["purple", "blue", "green", "pink", "yellow", "orange", "red", "lime"];

/** 文字列から決まった数を作る（同じ人はいつも同じ柄になる） */
function seed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** プロフィールのカバー（SCREENS 12）。既定はシェイプが散った柄、写真にも変えられる */
export function ProfileCover({ cover, seedText, height = 150 }: { cover: Avatar | null; seedText: string; height?: number }) {
  if (cover?.kind === "photo" && cover.src) {
    return (
      <div className="w-full overflow-hidden" style={{ height, borderRadius: "0 0 14px 28px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.src} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  const rnd = seed(seedText);
  const base = COLOR_ORDER[Math.floor(rnd() * COLOR_ORDER.length)];
  const items = Array.from({ length: 9 }, (_, i) => ({
    shape: SHAPE_ORDER[Math.floor(rnd() * SHAPE_ORDER.length)],
    color: COLOR_ORDER[(i + Math.floor(rnd() * 3)) % COLOR_ORDER.length],
    left: rnd() * 100,
    top: rnd() * 100,
    size: 28 + Math.floor(rnd() * 46),
    rotate: Math.floor(rnd() * 360),
  }));

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{ height, background: SOFT[base as keyof typeof SOFT] ?? SOFT.purple, borderRadius: "0 0 14px 28px" }}
      aria-hidden="true"
    >
      {items.map((it, i) => (
        <span
          key={i}
          className="absolute opacity-70"
          style={{ left: `${it.left}%`, top: `${it.top}%`, transform: `translate(-50%,-50%) rotate(${it.rotate}deg)` }}
        >
          <ShapeIcon shape={it.shape} color={it.color} size={it.size} />
        </span>
      ))}
    </div>
  );
}
