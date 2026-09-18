"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { C } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { joinViaInvite } from "@/app/auth/actions";

export function JoinByLink({ token, email }: { token: string; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  function join() {
    setError(null);
    start(async () => {
      const result = await joinViaInvite(token, name.trim() || undefined);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="anim-screen space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <ShapeIcon shape="burst" color="orange" size={64} face />
        <h1 className="text-xl font-extrabold">招待されています</h1>
        <p className="text-xs font-bold" style={{ color: "#9AA0A6" }}>
          {email} で参加します
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
          表示名（あとから変えられます）
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={email.split("@")[0]}
          className="w-full px-4 py-3.5 text-base bg-white outline-none"
          style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
        />
      </label>

      {error && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <OrganicButton size="lg" className="w-full" onClick={join} disabled={pending}>
          {pending ? "参加しています…" : "参加する"}
        </OrganicButton>
        <Link href="/auth/workspace" className="block">
          <button type="button" className="w-full text-xs font-bold py-2" style={{ color: "#9AA0A6" }}>
            やめておく
          </button>
        </Link>
      </div>
    </div>
  );
}
