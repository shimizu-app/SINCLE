"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { C, SHAPES, type ShapeKey } from "@/lib/design";
import { ShapeIcon, SyncleMark } from "@/components/ui";

/** 花 → クローバー → 太陽 → 六角 → blob → しずく → シンボル */
const SEQUENCE: ShapeKey[] = ["flower", "clover", "sun", "hex", "blob", "drop"];
const TONES = ["red", "yellow", "green", "blue", "purple", "pink"] as const;
const STEP_MS = 260;

export default function BootScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const destination = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // 行き先の判定。アニメーションとは独立に走らせる。
  useEffect(() => {
    let alive = true;
    fetch("/api/boot", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { next?: string }) => {
        if (!alive) return;
        destination.current = data.next ?? "/auth";
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        destination.current = "/auth";
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 形の切り替え。動きを減らす設定のときは回さない。
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(SEQUENCE.length);
      return;
    }
    const id = window.setInterval(() => {
      setStep((v) => (v < SEQUENCE.length ? v + 1 : v));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  // 読み込みが終わり次第、シンボルに飛ばして次へ進む（SCREENS 1）。
  // アニメーションの都合で待たせない。
  useEffect(() => {
    if (!ready || !destination.current) return;
    setStep(SEQUENCE.length);
    const id = window.setTimeout(() => router.replace(destination.current!), 420);
    return () => window.clearTimeout(id);
  }, [ready, router]);

  const done = step >= SEQUENCE.length;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6" style={{ background: C.bg }}>
      <div className="h-[126px] flex items-center justify-center">
        {done ? (
          <span className="anim-bootpop">
            <SyncleMark size={126} />
          </span>
        ) : (
          <span key={step} className="anim-bootswap">
            <ShapeIcon shape={SEQUENCE[step]} color={TONES[step % TONES.length]} size={126} />
          </span>
        )}
      </div>

      <div className="anim-bootrise text-center" style={{ animationDelay: "120ms" }}>
        <div className="text-3xl font-extrabold tracking-wide">SYNCLE</div>
        <div className="text-xs font-bold mt-1" style={{ color: "#9AA0A6" }}>
          名刺から始まる営業CRM
        </div>
      </div>

      <div className="flex gap-1.5 anim-bootrise" style={{ animationDelay: "240ms" }} aria-label="読み込み中">
        {Object.keys(SHAPES)
          .slice(0, 3)
          .map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full anim-bootblink"
              style={{ background: C[TONES[i]], animationDelay: `${i * 160}ms` }}
            />
          ))}
      </div>
    </main>
  );
}
