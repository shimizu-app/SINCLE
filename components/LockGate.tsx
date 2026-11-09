"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, LogOut } from "lucide-react";
import { C } from "@/lib/design";
import { OrganicButton, SyncleMark } from "@/components/ui";
import { signOut } from "@/app/auth/actions";
import {
  LOCK_AFTER_MS,
  LOCK_CHANGED_EVENT,
  LOCK_NOW_EVENT,
  lockSupported,
  readLock,
  registerLock,
  unlockWith,
  writeLock,
} from "@/lib/device-lock";

const HIDDEN_AT = "syncle.lock.hiddenAt";
const UNLOCKED = "syncle.lock.unlocked";

/**
 * アプリを開いたとき・しばらく離れて戻ってきたときに、Face ID で鍵を掛ける。
 * ロックがオンの端末だけ。オフなら何もしない。
 *
 * 既定はオン（SCREENS 11）。ただし Face ID の登録はブラウザの決まりで
 * 「押した操作」からしかできないので、初めて開いたときに一度だけ尋ねる。
 */
export function LockGate({ userId, email, name }: { userId: string; email: string; name: string }) {
  const [locked, setLocked] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const credentialId = useCallback(() => {
    const s = readLock(userId);
    return s?.enabled ? s.credentialId : null;
  }, [userId]);

  // 開いたとき：このタブでまだ開けていなければロック
  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = await lockSupported();
      if (!alive || !supported) return;
      const setting = readLock(userId);
      if (setting?.enabled) {
        let unlocked = false;
        try {
          unlocked = sessionStorage.getItem(UNLOCKED) === userId;
        } catch {}
        if (!unlocked) setLocked(true);
      } else if (!setting) {
        // まだ決めていない端末。少し待ってから一度だけ尋ねる
        setTimeout(() => alive && setAsk(true), 1500);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // しばらく離れて戻ってきたらロック
  useEffect(() => {
    const onVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          sessionStorage.setItem(HIDDEN_AT, String(Date.now()));
          return;
        }
        const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT) ?? 0);
        if (hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS && credentialId()) {
          sessionStorage.removeItem(UNLOCKED);
          setLocked(true);
        }
      } catch {}
    };
    const lockNow = () => {
      if (!credentialId()) return;
      try {
        sessionStorage.removeItem(UNLOCKED);
      } catch {}
      setLocked(true);
    };
    const changed = () => setAsk(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(LOCK_NOW_EVENT, lockNow);
    window.addEventListener(LOCK_CHANGED_EVENT, changed);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(LOCK_NOW_EVENT, lockNow);
      window.removeEventListener(LOCK_CHANGED_EVENT, changed);
    };
  }, [credentialId]);

  // ロック中は後ろの画面を触れない・読み上げさせない
  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".anim-screen");
    if (!main) return;
    if (locked) main.setAttribute("inert", "");
    else main.removeAttribute("inert");
  }, [locked]);

  async function unlock() {
    const id = credentialId();
    if (!id) return setLocked(false);
    setBusy(true);
    setProblem(null);
    const ok = await unlockWith(id);
    setBusy(false);
    if (ok) {
      try {
        sessionStorage.setItem(UNLOCKED, userId);
        sessionStorage.removeItem(HIDDEN_AT);
      } catch {}
      setLocked(false);
    } else {
      setProblem("開けませんでした。もう一度お試しください。");
    }
  }

  async function turnOn() {
    setBusy(true);
    setProblem(null);
    try {
      const id = await registerLock({ id: userId, email, name });
      writeLock(userId, { enabled: true, credentialId: id });
      try {
        sessionStorage.setItem(UNLOCKED, userId);
      } catch {}
      setAsk(false);
    } catch {
      setProblem("登録できませんでした。設定の「セキュリティ」からもう一度お試しください。");
    }
    setBusy(false);
  }

  if (locked) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-8 text-center"
        style={{ background: C.bg }}
        role="dialog"
        aria-modal="true"
        aria-label="ロック中"
      >
        <SyncleMark size={72} />
        <div className="space-y-1.5">
          <div className="text-lg font-extrabold">ロックしています</div>
          <p className="text-xs font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
            Face ID（または指紋）で開いてください。
          </p>
        </div>
        <OrganicButton type="button" size="lg" onClick={unlock} disabled={busy} className="w-full max-w-xs" autoFocus>
          <Fingerprint size={18} strokeWidth={2.6} />
          {busy ? "確認しています…" : "Face ID で開く"}
        </OrganicButton>
        {problem && (
          <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
            {problem}
          </p>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: "#9AA0A6" }}
          >
            <LogOut size={13} strokeWidth={2.6} />
            開けないときは、ログインし直す
          </button>
        </form>
      </div>
    );
  }

  if (ask) {
    return (
      <div className="fixed inset-x-0 bottom-24 z-50 px-4 anim-item">
        <div
          className="mx-auto max-w-md bg-white p-4 space-y-3 shadow-lg"
          style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.line}` }}
          role="dialog"
          aria-label="Face ID でのロック"
        >
          <div className="flex items-start gap-3">
            <Fingerprint size={28} strokeWidth={2.4} style={{ color: C.purple }} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold">Face ID でロックしますか？</div>
              <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#9AA0A6" }}>
                この端末でアプリを開くとき、Face ID（または指紋）で開くようにします。
                顔や指紋のデータは端末の外に出ません。設定からいつでも外せます。
              </p>
            </div>
          </div>
          {problem && (
            <p className="text-[11px] font-bold" style={{ color: C.red }} role="alert">
              {problem}
            </p>
          )}
          <div className="flex gap-2">
            <OrganicButton type="button" size="sm" onClick={turnOn} disabled={busy} className="flex-1">
              {busy ? "登録しています…" : "オンにする"}
            </OrganicButton>
            <OrganicButton
              type="button"
              size="sm"
              variant="outline"
              color="purple"
              className="flex-1"
              onClick={() => {
                writeLock(userId, { enabled: false, asked: true });
                setAsk(false);
              }}
            >
              あとで
            </OrganicButton>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
