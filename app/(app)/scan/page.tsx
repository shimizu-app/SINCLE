import { requireCurrent } from "@/lib/workspace";
import { ScanClient } from "./ScanClient";

export default async function ScanPage() {
  const current = await requireCurrent();
  return <ScanClient workspaceId={current.workspace.id} />;
}
