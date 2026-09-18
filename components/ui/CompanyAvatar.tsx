import { companyArt } from "@/lib/design";
import { ShapeIcon } from "./ShapeIcon";

type Props = {
  name: string;
  industry?: string | null;
  dealType?: string | null;
  size?: number;
};

/** 会社アイコン。業種と案件種別から形と色が決まる。 */
export function CompanyAvatar({ name, industry, dealType, size = 52 }: Props) {
  const art = companyArt(industry ?? undefined, dealType ?? undefined);
  const initial = name.replace(/株式会社|有限会社|合同会社/g, "").trim().charAt(0);
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <ShapeIcon shape={art.shape} color={art.color} size={size} />
      <span className="absolute font-bold text-white" style={{ fontSize: size * 0.36 }}>
        {initial}
      </span>
    </span>
  );
}
