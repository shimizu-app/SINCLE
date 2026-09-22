"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C } from "@/lib/design";
import { AuthShell } from "@/components/AuthShell";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "on";

export function EmailForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmUrl = (origin: string) =>
    `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: confirmUrl(window.location.origin),
      },
    });

    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "送信の回数制限に達しました。少し待ってからもう一度お試しください。"
          : error.message
      );
      return;
    }
    router.push(
      `/auth/code?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`
    );
  }

  async function withGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <AuthShell>
      <div className="anim-screen space-y-6">
        <Link href="/auth" className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#9AA0A6" }}>
          <ChevronLeft size={16} strokeWidth={3} />
          もどる
        </Link>

        <div className="flex items-center gap-3">
          <ShapeIcon shape="square" color="blue" size={48} face wink />
          <div>
            <h1 className="text-xl font-extrabold">メールアドレス</h1>
            <p className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
              ログイン用のメールをお送りします
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.co.jp"
            className="w-full px-4 py-3.5 text-base bg-white outline-none"
            style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
          />

          {error && (
            <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
              {error}
            </p>
          )}

          <OrganicButton type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
            {busy ? "送信しています…" : "メールを送る"}
          </OrganicButton>
        </form>

        {GOOGLE_ENABLED && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex-1 h-px" style={{ background: C.line }} />
              <span className="text-xs font-bold" style={{ color: "#C8C2B6" }}>
                または
              </span>
              <span className="flex-1 h-px" style={{ background: C.line }} />
            </div>
            <OrganicButton
              type="button"
              variant="outline"
              color="blue"
              size="lg"
              shape="pill"
              className="w-full"
              onClick={withGoogle}
            >
              Google でログイン
            </OrganicButton>
          </>
        )}
      </div>
    </AuthShell>
  );
}
