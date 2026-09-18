"use client";

import { useEffect } from "react";

/**
 * すべてのボタンに共通の押し心地を与える（SPEC 5章）。
 *   沈む → 跳ねて戻る → 押した位置から色が広がる
 * 個々のボタンに手を入れずに済むよう、document に一度だけ仕掛ける。
 * prefers-reduced-motion のときは何もしない。
 */
export function PressFeedback() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let held: HTMLButtonElement | null = null;

    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.disabled) return;

      held = button;
      button.classList.remove("is-release");
      button.classList.add("is-press");

      const cs = window.getComputedStyle(button);
      const bg = cs.backgroundColor;
      const isSolid = Boolean(bg) && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);

      const dot = document.createElement("span");
      dot.className = "bloom";
      const size = Math.max(button.offsetWidth, button.offsetHeight) * 2.1;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.style.background = isSolid ? bg : cs.color;
      document.body.appendChild(dot);
      window.setTimeout(() => dot.remove(), 560);
    };

    const up = () => {
      if (!held) return;
      const button = held;
      held = null;
      button.classList.remove("is-press");
      button.classList.add("is-release");
      window.setTimeout(() => button.classList.remove("is-release"), 440);
    };

    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
  }, []);

  return null;
}
