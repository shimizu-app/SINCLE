import Link from "next/link";
import { C, SOFT } from "@/lib/design";
import { AuthShell } from "@/components/AuthShell";
import { ShapeIcon, SyncleMark } from "@/components/ui";
import { safeNext } from "@/lib/next-path";

const MESSAGES: Record<string, string> = {
  link: "リンクが正しくありません。もう一度コードを送ってください。",
  expired: "リンクの有効期限が切れています。もう一度コードを送ってください。",
  oauth: "Google でのログインに失敗しました。メールでログインしてください。",
};

export default async function AuthEntry({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const back = safeNext(next);
  const message = error ? MESSAGES[error] : null;

  // ログイン後の戻り先。作成を選んだ場合は作成画面へ直行する。
  const loginHref = back === "/" ? "/auth/email" : `/auth/email?next=${encodeURIComponent(back)}`;
  const createHref = `/auth/email?next=${encodeURIComponent("/auth/new")}`;

  return (
    <AuthShell>
      <div className="anim-screen space-y-8">
        <div className="flex flex-col items-center gap-3">
          <SyncleMark size={72} />
          <div className="text-2xl font-extrabold tracking-wide">SYNCLE</div>
          <p className="text-xs font-bold text-center" style={{ color: "#9AA0A6" }}>
            名刺から始まる営業CRM
          </p>
        </div>

        {message && (
          <p
            className="text-xs font-bold px-3.5 py-2.5 text-center"
            style={{ background: SOFT.red, color: C.red, borderRadius: "14px 7px 14px 7px" }}
            role="alert"
          >
            {message}
          </p>
        )}

        <div className="space-y-3">
          <Link
            href={loginHref}
            className="w-full flex items-center gap-3 p-4 bg-white anim-item"
            style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.ink}` }}
          >
            <ShapeIcon shape="flower" color="purple" size={44} face />
            <span className="flex-1 min-w-0">
              <span className="block text-base font-extrabold">ワークスペースにログイン</span>
              <span className="block text-xs font-bold" style={{ color: "#9AA0A6" }}>
                メールに6桁のコードを送ります
              </span>
            </span>
          </Link>

          <Link
            href={createHref}
            className="w-full flex items-center gap-3 p-4 bg-white anim-item"
            style={{
              borderRadius: "13px 26px 13px 26px",
              border: `2.5px solid ${C.line}`,
              animationDelay: "60ms",
            }}
          >
            <ShapeIcon shape="clover" color="green" size={44} face />
            <span className="flex-1 min-w-0">
              <span className="block text-base font-extrabold">新しくワークスペースを作る</span>
              <span className="block text-xs font-bold" style={{ color: "#9AA0A6" }}>
                会社ごとに1つ。あとから招待できます
              </span>
            </span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
