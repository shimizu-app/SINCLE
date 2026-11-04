"use client";

import { useEffect } from "react";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** 何が足りないかを、日本語の一言にする */
function messageFor(el: Field): string {
  const v = el.validity;
  if (v.valueMissing) return el instanceof HTMLSelectElement ? "選んでください" : "入力してください";
  if (v.typeMismatch && el.type === "email") return "メールアドレスの形で入力してください";
  if (v.typeMismatch && el.type === "url") return "URLの形で入力してください";
  if (v.badInput) return "数字で入力してください";
  if (v.rangeUnderflow || v.rangeOverflow) return "範囲の中の数を入力してください";
  if (v.tooShort) return "もう少し長く入力してください";
  if (v.tooLong) return "もう少し短く入力してください";
  return "入力の内容を確かめてください";
}

/**
 * 入力欄の検査メッセージを日本語にする。
 *
 * 必須の欄を空のまま送ると、ブラウザが自分の言葉で吹き出しを出す。
 * 端末が英語なら "Please fill out this field" になり、
 * 日本語のアプリの中でそこだけ英語が出てしまう。
 *
 * 個々のフォームに手を入れずに済むよう、document に一度だけ仕掛ける
 * （PressFeedback と同じやり方）。検査そのものはブラウザに任せたまま、
 * 文言だけを差し替える。打ち直したら元に戻す。
 */
export function JapaneseValidity() {
  useEffect(() => {
    const isField = (t: EventTarget | null): t is Field =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLSelectElement ||
      t instanceof HTMLTextAreaElement;

    const onInvalid = (e: Event) => {
      if (!isField(e.target)) return;
      const el = e.target;
      // 前回の差し替えが残っていると、本当の状態が読めないので一度消す
      el.setCustomValidity("");
      if (!el.validity.valid) el.setCustomValidity(messageFor(el));
    };

    // 差し替えたままだと、直しても「不正」のまま送れなくなる
    const onEdit = (e: Event) => {
      if (isField(e.target)) e.target.setCustomValidity("");
    };

    // invalid は伝わってこない（バブリングしない）ので、捕捉で拾う
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);

  return null;
}
