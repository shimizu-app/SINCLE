"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, X } from "lucide-react";
import { C, SOFT, SHAPES, slugify, type ColorKey, type ShapeKey } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { createWorkspace, type CreateResult } from "../actions";

const COLORS: ColorKey[] = ["purple", "blue", "green", "pink", "yellow", "orange", "red", "lime"];
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

type SlugState = "idle" | "checking" | "free" | "taken";

export function NewWorkspaceForm({
  email,
  corporateDomain,
}: {
  email: string;
  corporateDomain: boolean;
}) {
  const [state, action, pending] = useActionState<CreateResult, FormData>(createWorkspace, undefined);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [color, setColor] = useState<ColorKey>("purple");
  const [shape, setShape] = useState<ShapeKey>("flower");

  const domain = email.split("@")[1] ?? "";

  // 会社名から URL 名を作る（触っていない間だけ追従する）
  useEffect(() => {
    if (slugTouched) return;
    setSlug(name ? slugify(name) : "");
  }, [name, slugTouched]);

  // 重複チェック
  useEffect(() => {
    const value = slug.trim();
    if (!value) {
      setSlugState("idle");
      return;
    }
    setSlugState("checking");
    const id = window.setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_slug_available", { p_slug: value });
      if (error) {
        setSlugState("idle");
        return;
      }
      setSlugState(data ? "free" : "taken");
    }, 400);
    return () => window.clearTimeout(id);
  }, [slug]);

  const fieldStyle = {
    borderRadius: "22px 11px 22px 11px",
    border: `2.5px solid ${C.line}`,
  } as const;

  return (
    <form action={action} className="anim-screen space-y-6">
      <Link href="/auth" className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#9AA0A6" }}>
        <ChevronLeft size={16} strokeWidth={3} />
        もどる
      </Link>

      <div className="flex items-center gap-3">
        <ShapeIcon shape={shape} color={color} size={52} />
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">ワークスペースを作る</h1>
          <p className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
            {email}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            会社名
          </span>
          <input
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="株式会社ニコ"
            className="w-full px-4 py-3.5 text-base bg-white outline-none"
            style={fieldStyle}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            URL名（あとから変えられません）
          </span>
          <div className="flex items-center gap-2 px-4 py-3.5 bg-white" style={fieldStyle}>
            <span className="text-sm font-bold shrink-0" style={{ color: "#C8C2B6" }}>
              /
            </span>
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="nico"
              className="flex-1 min-w-0 text-base bg-transparent outline-none"
            />
            {slugState === "free" && <Check size={18} strokeWidth={3} style={{ color: C.green }} />}
            {slugState === "taken" && <X size={18} strokeWidth={3} style={{ color: C.red }} />}
          </div>
          {slugState === "taken" && (
            <span className="block text-xs font-bold px-1" style={{ color: C.red }}>
              この名前はすでに使われています
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
              あなたの名前
            </span>
            <input
              name="memberName"
              placeholder={email.split("@")[0]}
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={fieldStyle}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
              役割
            </span>
            <input
              name="role"
              placeholder="代表"
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={{ borderRadius: "11px 22px 11px 22px", border: `2.5px solid ${C.line}` }}
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
            アイコン
          </span>
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="shape" value={shape} />
          <div className="flex gap-1.5 overflow-x-auto no-bar pb-1">
            {SHAPE_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShape(s)}
                aria-label={s}
                aria-pressed={shape === s}
                className={`p-1.5 shrink-0 ${shape === s ? "anim-chip" : ""}`}
                style={{
                  borderRadius: "14px 7px 14px 7px",
                  background: shape === s ? SOFT[color as keyof typeof SOFT] : "#fff",
                  border: `2px solid ${shape === s ? C[color] : C.line}`,
                }}
              >
                <ShapeIcon shape={s} color={color} size={26} />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className="w-8 h-8 shrink-0"
                style={{
                  borderRadius: "999px",
                  background: C[c],
                  outline: color === c ? `3px solid ${C.ink}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {corporateDomain && (
          <label
            className="flex items-start gap-2.5 p-3.5 bg-white cursor-pointer"
            style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
          >
            <input
              type="checkbox"
              name="useDomain"
              defaultChecked
              className="mt-0.5 w-4 h-4 shrink-0 accent-[color:var(--syncle-purple)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">
                @{domain} の人が見つけられるようにする
              </span>
              <span className="block text-xs font-bold leading-snug" style={{ color: "#9AA0A6" }}>
                同じドメインの人が参加を申請できます。承認はあなたが行います。
              </span>
            </span>
          </label>
        )}
      </div>

      {state?.error && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {state.error}
        </p>
      )}

      <OrganicButton
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !name.trim() || !slug.trim() || slugState === "taken"}
      >
        {pending ? "作成しています…" : "作成して始める"}
      </OrganicButton>
    </form>
  );
}
