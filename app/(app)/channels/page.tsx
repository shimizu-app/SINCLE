import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";

export default async function ChannelsPage() {
  const current = await requireCurrent();

  return (
    <>
      <ScreenHeader title="チャンネル" subtitle={current.workspace.name} />
      <div className="px-4 py-4">
        <EmptyState
          shape="flower"
          color="pink"
          title="チャンネルはまだありません"
          desc={"会社チャンネルは名刺を登録すると自動で作られます。\nグループと個人チャットはフェーズ3で使えるようになります。"}
        />
      </div>
    </>
  );
}
