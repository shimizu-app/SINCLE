import type { CSSProperties, ReactNode } from "react";
import { C, SHAPES, FONT_STACK, type ColorKey, type ShapeKey } from "@/lib/design";

/** 顔（目と口）。丸ゴシックの線幅に合わせてある。 */
export function Face({ scale = 1, wink }: { scale?: number; wink?: boolean }) {
  return (
    <g transform={`translate(50 56) scale(${scale}) translate(-50 -56)`}>
      <ellipse cx="41" cy="50" rx="4" ry="5.4" fill={C.ink} />
      {wink ? (
        <path d="M54 50c2-3 6-3 8 0" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      ) : (
        <ellipse cx="59" cy="50" rx="4" ry="5.4" fill={C.ink} />
      )}
      <path d="M43 62c4 5 11 5 15 0" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </g>
  );
}

export type ShapeIconProps = {
  shape?: ShapeKey;
  /** design.ts の色キー、または任意のCSS色 */
  color?: ColorKey | string;
  size?: number;
  face?: boolean;
  wink?: boolean;
  /** 中央に置く文字（1文字想定） */
  label?: string;
  /** 中央に置く任意のSVG要素 */
  glyph?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** 12種のシェイプ。形・色・サイズ・顔の有無を props で決める。 */
export function ShapeIcon({
  shape = "blob",
  color = "purple",
  size = 44,
  face,
  wink,
  label,
  glyph,
  className = "",
  style,
}: ShapeIconProps) {
  const fill = (C as Record<string, string>)[color] ?? color;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path d={SHAPES[shape] ?? SHAPES.blob} fill={fill} />
      {face && <Face scale={0.92} wink={wink} />}
      {label && (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="42"
          fontWeight="800"
          fill="#fff"
          fontFamily={FONT_STACK}
        >
          {label}
        </text>
      )}
      {glyph}
    </svg>
  );
}
