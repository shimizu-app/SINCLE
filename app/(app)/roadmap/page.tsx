import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function RoadmapPage() {
  const current = await requireCurrent();

  return (
    <>
      <ScreenHeader title="計画" subtitle={current.workspace.name} />
      <div className="px-4 py-4">
        <EmptyState
          shape="burst"
          color="orange"
          title="議題はまだありません"
          desc={"部署ごと・月ごとの議題とロードマップ図はフェーズ5以降で入ります。"}
        />
      </div>
    </>
  );
}
