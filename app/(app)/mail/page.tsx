import Link from "next/link";
import { requireCurrent } from "@/lib/workspace";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { OrganicButton } from "@/components/ui";

export default async function MailPage() {
  const current = await requireCurrent();

  return (
    <>
      <ScreenHeader title="メール" subtitle={current.workspace.name} />
      <div className="px-4 py-4">
        <EmptyState
          shape="square"
          color="blue"
          title="Gmail はまだつないでいません"
          desc={"登録した相手とのやりとりだけを取り込みます。\n連携とAIメール作成はフェーズ6で入ります。"}
        >
          <Link href="/customers" className="inline-block pt-1">
            <OrganicButton type="button" size="md" variant="outline" color="blue">
              顧客一覧にもどる
            </OrganicButton>
          </Link>
        </EmptyState>
      </div>
    </>
  );
}
