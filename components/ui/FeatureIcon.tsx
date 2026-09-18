import { FEATURE } from "@/lib/design";
import { ShapeIcon } from "./ShapeIcon";

/** 機能アイコン（ナビ・クイックアクション共通） */
export function FeatureIcon({
  name,
  size = 44,
  plain,
}: {
  name: keyof typeof FEATURE | string;
  size?: number;
  plain?: boolean;
}) {
  const f = FEATURE[name] ?? FEATURE.company;
  return <ShapeIcon shape={f.shape} color={f.color} size={size} face={!plain && f.face} wink={f.wink} />;
}
