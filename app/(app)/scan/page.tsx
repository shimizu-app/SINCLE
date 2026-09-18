import Link from "next/link";
import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { OrganicButton } from "@/components/ui";

export default async function ScanPage() {
  const current = await requireCurrent();

  return (
    <>
      <ScreenHeader title="スキャン" subtitle={current.workspace.name} />
      <div className="px-4 py-4">
        <EmptyState
          shape="clover"
          color="green"
          title="名刺の読み取り"
          desc={"カメラでの撮影とOCRはフェーズ4で入ります。\nそれまでは手入力で登録します（フェーズ2）。"}
        >
          <Link href="/customers" className="inline-block pt-1">
            <OrganicButton type="button" size="md" variant="outline" color="green">
              顧客一覧にもどる
            </OrganicButton>
          </Link>
        </EmptyState>
      </div>
    </>
  );
}
