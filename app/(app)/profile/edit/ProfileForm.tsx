"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Sparkles } from "lucide-react";
import { C, SHAPES, SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import { MemberDot, OrganicButton, ShapeIcon } from "@/components/ui";
import { photoToDataUrl } from "@/lib/image-data-url";
import type { Avatar } from "@/types/db";
import { updateProfile, type ProfileResult } from "../actions";
import { ProfileCover } from "../ProfileCover";

const COLORS = Object.keys(SOFT) as ColorKey[];
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

const field = {
  borderRadius: "16px 8px 16px 8px",
  border: `2px solid ${C.line}`,
} as const;

export function ProfileForm({
  memberId,
  initial,
}: {
  memberId: string;
  initial: { name: string; role: string; note: string; avatar: Avatar; cover: Avatar | null };
}) {
  const [state, action, pending] = useActionState<ProfileResult, FormData>(updateProfile, undefined);
  const [name, setName] = useState(initial.name);
  const [avatar, setAvatar] = useState<Avatar>(initial.avatar);
  const [cover, setCover] = useState<Avatar | null>(initial.cover);
  const [problem, setProblem] = useState<string | null>(null);
  const iconFile = useRef<HTMLInputElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);

  const shape = avatar.kind === "shape" ? avatar : { kind: "shape" as const, shape: "flower", color: "purple" };

  async function pick(file: File | undefined, kind: "icon" | "cover") {
    if (!file) return;
    setProblem(null);
    try {
      const src =
        kind === "icon" ? await photoToDataUrl(file, 256, 256, 0.85) : await photoToDataUrl(file, 900, 340, 0.78);
      if (kind === "icon") setAvatar({ kind: "photo", src });
      else setCover({ kind: "photo", src });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "写真を読めませんでした。");
    }
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="avatar" value={JSON.stringify(avatar)} />
      <input type="hidden" name="cover" value={cover ? JSON.stringify(cover) : ""} />

      {/* ── 見た目の確認 ── */}
      <div className="relative bg-white overflow-hidden" style={{ ...field, borderRadius: "26px 13px 26px 13px" }}>
        <ProfileCover cover={cover} seedText={memberId} height={110} />
        <div className="flex items-end gap-3 px-4 -mt-9 pb-3">
          <MemberDot name={name || "？"} avatar={avatar} size={72} />
          <div className="pb-1 text-base font-extrabold truncate">{name || "表示名"}</div>
        </div>
      </div>

      {/* ── アイコン ── */}
      <section className="space-y-2">
        <Label>アイコン</Label>
        <div className="flex gap-2">
          <OrganicButton
            type="button"
            size="sm"
            variant={avatar.kind === "shape" ? "solid" : "outline"}
            color="purple"
            onClick={() => setAvatar(shape)}
          >
            <Sparkles size={13} strokeWidth={3} />
            シンボル
          </OrganicButton>
          <OrganicButton
            type="button"
            size="sm"
            variant={avatar.kind === "photo" ? "solid" : "outline"}
            color="purple"
            onClick={() => iconFile.current?.click()}
          >
            <Camera size={13} strokeWidth={3} />
            写真にする
          </OrganicButton>
          <input
            ref={iconFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0], "icon");
              e.target.value = "";
            }}
          />
        </div>

        {avatar.kind === "shape" && (
          <div className="bg-white p-3 space-y-3" style={field}>
            <div className="grid grid-cols-6 gap-2">
              {SHAPE_KEYS.map((s) => {
                const on = avatar.shape === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-label={s}
                    aria-pressed={on}
                    onClick={() => setAvatar({ kind: "shape", shape: s, color: avatar.color })}
                    className="aspect-square flex items-center justify-center"
                    style={{
                      background: on ? SOFT[avatar.color as keyof typeof SOFT] : "#FAF7F1",
                      border: `2px solid ${on ? C[avatar.color as ColorKey] : "transparent"}`,
                      borderRadius: 12,
                    }}
                  >
                    <ShapeIcon shape={s} color={avatar.color} size={28} />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((col) => {
                const on = avatar.color === col;
                return (
                  <button
                    key={col}
                    type="button"
                    aria-label={col}
                    aria-pressed={on}
                    onClick={() => setAvatar({ kind: "shape", shape: avatar.shape, color: col })}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: C[col], boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${C[col]}` : undefined }}
                  >
                    {on && <Check size={14} strokeWidth={3.4} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── カバー ── */}
      <section className="space-y-2">
        <Label>カバー</Label>
        <div className="flex gap-2">
          <OrganicButton
            type="button"
            size="sm"
            variant={cover ? "outline" : "solid"}
            color="green"
            onClick={() => setCover(null)}
          >
            <Sparkles size={13} strokeWidth={3} />
            シェイプの柄
          </OrganicButton>
          <OrganicButton
            type="button"
            size="sm"
            variant={cover ? "solid" : "outline"}
            color="green"
            onClick={() => coverFile.current?.click()}
          >
            <ImageIcon size={13} strokeWidth={3} />
            写真にする
          </OrganicButton>
          <input
            ref={coverFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0], "cover");
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {/* ── 文字 ── */}
      <section className="space-y-3">
        <label className="block space-y-1.5">
          <Label>表示名</Label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            className="w-full bg-white px-3.5 py-3 text-base font-bold outline-none"
            style={field}
          />
        </label>
        <label className="block space-y-1.5">
          <Label>役割</Label>
          <input
            name="role"
            defaultValue={initial.role}
            maxLength={40}
            placeholder="営業 / 経営 / 開発 など"
            className="w-full bg-white px-3.5 py-3 text-base font-bold outline-none"
            style={field}
          />
        </label>
        <label className="block space-y-1.5">
          <Label>ひとこと</Label>
          <textarea
            name="note"
            defaultValue={initial.note}
            maxLength={200}
            rows={3}
            placeholder="担当している業界や、話しかけてほしいことなど"
            className="w-full bg-white px-3.5 py-3 text-sm font-bold outline-none resize-none"
            style={field}
          />
        </label>
      </section>

      {(problem || (state && "error" in state)) && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {problem ?? (state && "error" in state ? state.error : "")}
        </p>
      )}
      {state && "ok" in state && (
        <p className="text-xs font-bold px-1" style={{ color: C.green }} role="status">
          保存しました。
        </p>
      )}

      <OrganicButton type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "保存しています…" : "保存する"}
      </OrganicButton>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold px-1" style={{ color: "#8A8A8A" }}>
      {children}
    </span>
  );
}
