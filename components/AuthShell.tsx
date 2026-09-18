import type { ReactNode } from "react";

/** 起動・認証系の共通の枠。スマホ幅で中央に置く。 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
