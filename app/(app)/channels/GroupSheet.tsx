"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { C, SOFT, SHAPES, type ColorKey, type ShapeKey } from "@/lib/design";
import { MemberDot, OrganicButton, Sheet, ShapeIcon } from "@/components/ui";
import { createGroup, type ChannelResult } from "./actions";
import type { Avatar } from "@/types/db";

const COLORS: ColorKey[] = ["purple", "blue", "green", "pink", "yellow", "orange", "red", "lime"];
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

export type PickMember = { id: string; name: string; avatar: Avatar | null; is_me: boolean };

/** SCREENS 5「グループ」：絵文字は使わず、SYNCLEのシェイプで選ぶ */
export function GroupSheet({ members }: { members: PickMember[] }) {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<ShapeKey>("flower");
  const [color, setColor] = useState<ColorKey>("purple");
  const [state, action, pending] = useActionState<ChannelResult, FormData>(createGroup, undefined);

  const others = members.filter((m) => !m.is_me);

  return (
    <>
      <OrganicButton
        type="button"
        size="lg"
        color="pink"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Plus size={16} strokeWidth={3} />
        グループを作る
      </OrganicButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="グループ" subtitle="話す場所を作ります">
        <form action={action} className="space-y-3">
          <input type="hidden" name="shape" value={shape} />
          <input type="hidden" name="color" value={color} />

          <div className="flex items-center gap-3">
            <ShapeIcon shape={shape} color={color} size={46} />
            <input
              name="name"
              required
              autoFocus
              placeholder="チャンネル名"
              className="flex-1 min-w-0 px-4 py-3 text-base bg-white outline-none"
              style={{ borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` }}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-bar pb-1">
            {SHAPE_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={s}
                onClick={() => setShape(s)}
                className={`p-1.5 shrink-0 ${shape === s ? "anim-chip" : ""}`}
                style={{
                  background: shape === s ? SOFT[color as keyof typeof SOFT] : "#fff",
                  border: `2px solid ${shape === s ? C[color] : C.line}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                <ShapeIcon shape={s} color={color} size={24} />
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="w-7 h-7"
                style={{
                  background: C[c],
                  borderRadius: "999px",
                  outline: color === c ? `3px solid ${C.ink}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>

          {others.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
                誘う人
              </div>
              {others.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2.5 p-2.5 bg-white cursor-pointer"
                  style={{ borderRadius: "14px 7px 14px 7px", border: `2px solid ${C.line}` }}
                >
                  <input
                    type="checkbox"
                    name="members"
                    value={m.id}
                    className="w-4 h-4 accent-[color:var(--syncle-purple)]"
                  />
                  <MemberDot name={m.name} avatar={m.avatar} size={26} />
                  <span className="text-sm font-bold truncate">{m.name}</span>
                </label>
              ))}
            </div>
          )}

          {state?.error && (
            <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
              {state.error}
            </p>
          )}

          <OrganicButton type="submit" size="lg" color="pink" className="w-full" disabled={pending}>
            {pending ? "作っています…" : "作る"}
          </OrganicButton>
        </form>
      </Sheet>
    </>
  );
}
