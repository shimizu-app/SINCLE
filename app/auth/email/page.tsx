import { safeNext } from "@/lib/next-path";
import { EmailForm } from "./EmailForm";

export default async function EmailStep({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <EmailForm next={safeNext(next)} />;
}
