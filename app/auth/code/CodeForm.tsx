"use client";

import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C } from "@/lib/design";
import { AuthShell } from "@/components/AuthShell";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const LENGTH = 6;

export function CodeForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  function put(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? "" : v)));
      return;
    }
    // 貼り付けにも対応する
    setDigits((d) => {
      const next = [...d];
      for (let i = 0; i < clean.length && index + i < LENGTH; i++) {
        next[index + i] = clean[i];
      }
      return next;
    });
    const moveTo = Math.min(index + clean.length, LENGTH - 1);
    boxes.current[moveTo]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== LENGTH) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

    setBusy(false);
    if (error) {
      setError("コードが違うか、期限が切れています。もう一度お試しください。");
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
      return;
    }
    // 戻り先の指定がなければ、起動画面が行き先
    //（所属1つ / 複数 / 同ドメイン / 0件）を判断する
    router.replace(next);
  }

  async function resend() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(
        error.status === 429
          ? "送信の回数制限に達しました。少し待ってからもう一度お試しください。"
          : error.message
      );
      return;
    }
    setResent(true);
  }

  return (
    <AuthShell>
      <div className="anim-screen space-y-6">
        <Link
          href={`/auth/email?next=${encodeURIComponent(next)}`}
          className="inline-flex items-center gap-1 text-sm font-bold"
          style={{ color: "#9AA0A6" }}
        >
          <ChevronLeft size={16} strokeWidth={3} />
          メールを入れ直す
        </Link>

        <div className="flex items-center gap-3">
          <ShapeIcon shape="sun" color="yellow" size={48} face />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold">コードを入力</h1>
            <p className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
              {email} に送りました
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-2 justify-between">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={d}
                onChange={(e: ChangeEvent<HTMLInputElement>) => put(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={LENGTH}
                autoFocus={i === 0}
                aria-label={`${i + 1}桁目`}
                className="w-full aspect-square text-center text-2xl font-extrabold bg-white outline-none focus:border-[color:var(--syncle-purple)]"
                style={{
                  borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px",
                  border: `2.5px solid ${d ? C.purple : C.line}`,
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
              {error}
            </p>
          )}

          <OrganicButton type="submit" size="lg" className="w-full" disabled={busy || code.length !== LENGTH}>
            {busy ? "確認しています…" : "ログイン"}
          </OrganicButton>
        </form>

        <div className="text-center">
          {resent ? (
            <p className="text-xs font-bold" style={{ color: C.green }}>
              もう一度送りました
            </p>
          ) : (
            <button type="button" onClick={resend} className="text-xs font-bold" style={{ color: C.purple }}>
              コードが届かない場合はこちら
            </button>
          )}
        </div>

        <p className="text-[11px] font-bold leading-relaxed text-center" style={{ color: "#C8C2B6" }}>
          メール内のリンクからでもログインできます。
        </p>
      </div>
    </AuthShell>
  );
}
