import { requireCurrent } from "@/lib/workspace";
import { NewContactForm } from "./NewContactForm";

export default async function NewCustomerPage() {
  const current = await requireCurrent();
  return <NewContactForm workspaceId={current.workspace.id} />;
}
