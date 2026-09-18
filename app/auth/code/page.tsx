import { safeNext } from "@/lib/next-path";
import { CodeForm } from "./CodeForm";

export default async function CodeStep({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  return <CodeForm email={email ?? ""} next={safeNext(next)} />;
}
