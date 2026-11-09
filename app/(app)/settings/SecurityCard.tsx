"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import {
  LOCK_CHANGED_EVENT,
  LOCK_NOW_EVENT,
  lockSupported,
  readLock,
  registerLock,
  writeLock,
} from "@/lib/device-lock";

const card = { borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` } as const;

/**
 * 設定の「セキュリティ」（SCREENS 11）。
 * Face ID でのロック（既定オン）／ロック画面の確認。設定は端末ごと。
 */
export function SecurityCard({ userId, email, name }: { userId: string; email: string; name: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "ng"; text: string } | null>(null);

  useEffect(() => {
    lockSupported().then(setSupported);
    setOn(Boolean(readLock(userId)?.enabled));
  }, [userId]);

  async function toggle() {
    setMessage(null);
    if (on) {
      writeLock(userId, { enabled: false, asked: true });
      setOn(false);
      window.dispatchEvent(new Event(LOCK_CHANGED_EVENT));
      setMessage({ tone: "ok", text: "この端末のロックを外しました。" });
      return;
    }
    setBusy(true);
    try {
      const id = await registerLock({ id: userId, email, name });
      writeLock(userId, { enabled: true, credentialId: id });
      try {
        sessionStorage.setItem("syncle.lock.unlocked", userId);
      } catch {}
      setOn(true);
      window.dispatchEvent(new Event(LOCK_CHANGED_EVENT));
      setMessage({ tone: "ok", text: "オンにしました。次に開くときから Face ID で開きます。" });
    } catch {
      setMessage({ tone: "ng", text: "登録できませんでした。端末の Face ID（または指紋）が設定されているか確かめてください。" });
    }
    setBusy(false);
  }

  return (
    <div className="bg-white p-4 space-y-3" style={card}>
      {supported === false ? (
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
          この端末・ブラウザでは Face ID（指紋）でのロックが使えません。
          iPhone の Safari や、指紋・顔認証のある端末で開くと使えます。
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={toggle}
            disabled={busy || supported === null}
            className="w-full flex items-center gap-3 text-left disabled:opacity-60"
            aria-pressed={on}
          >
            <Fingerprint size={28} strokeWidth={2.4} style={{ color: on ? C.purple : "#C8C2B6" }} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-extrabold">Face ID でのロック</span>
              <span className="block text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
                アプリを開くとき・5分以上離れて戻ったときに、Face ID（または指紋）で開きます
              </span>
            </span>
            <span
              className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
              style={{ background: on ? C.purple : "#E3DDD2" }}
              aria-hidden="true"
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: on ? 22 : 2 }}
              />
            </span>
          </button>

          {on && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(LOCK_NOW_EVENT))}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-extrabold py-2.5"
              style={{ color: C.purple, background: SOFT.purple, borderRadius: "14px 7px 14px 7px" }}
            >
              <Lock size={13} strokeWidth={3} />
              ロック画面を試す
            </button>
          )}
        </>
      )}

      {message && (
        <p
          className="text-xs font-bold px-3 py-2.5"
          style={{
            background: message.tone === "ok" ? SOFT.green : SOFT.red,
            color: message.tone === "ok" ? C.green : C.red,
            borderRadius: "14px 7px 14px 7px",
          }}
          role="status"
        >
          {message.text}
        </p>
      )}

      <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
        設定は端末ごとです。顔や指紋のデータは端末の外に出ず、SYNCLE にも届きません。
        開けないときは「ログインし直す」から、メールのコードで入り直せます。
      </p>
    </div>
  );
}
