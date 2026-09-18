import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function TasksPage() {
  const current = await requireCurrent();

  return (
    <>
      <ScreenHeader title="タスク" subtitle={current.workspace.name} />
      <div className="px-4 py-4">
        <EmptyState
          shape="sun"
          color="yellow"
          title="タスクはまだありません"
          desc={"リスト・カレンダー・メモはフェーズ3で使えるようになります。"}
        />
      </div>
    </>
  );
}
