import type { ButtonHTMLAttributes, ReactNode } from "react";
import { C, type ColorKey } from "@/lib/design";

const PAD = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
} as const;

const RADIUS = {
  wave: "22px 14px 22px 14px",
  pill: "999px",
  stamp: "18px 6px 18px 6px",
  arch: "999px 999px 14px 14px",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  color?: ColorKey;
  variant?: "solid" | "outline";
  size?: keyof typeof PAD;
  shape?: keyof typeof RADIUS;
};

/** 角丸が非対称のボタン。押下挙動は PressFeedback が全ボタンに与える。 */
export function OrganicButton({
  children,
  color = "purple",
  variant = "solid",
  size = "md",
  shape = "wave",
  className = "",
  style,
  ...rest
}: Props) {
  const solid = variant === "solid";
  const tone = C[color];
  return (
    <button
      {...rest}
      className={`${PAD[size]} font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 ${className}`}
      style={{
        borderRadius: RADIUS[shape],
        background: solid ? tone : "#fff",
        color: solid ? "#fff" : tone,
        border: solid ? "none" : `2.5px solid ${tone}`,
        boxShadow: solid ? `0 3px 0 0 ${tone}44` : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
