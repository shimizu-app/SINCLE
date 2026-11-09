/**
 * Face ID（端末の生体認証）でのロック（SCREENS 2「ロック」・11「セキュリティ」）。
 *
 * WebAuthn の「この端末の認証器」（iPhone なら Face ID、Mac なら Touch ID、
 * Android なら指紋）を使う。パスワードの代わりではなく、ログイン済みのアプリを
 * 開くときの鍵。ログインそのものは今までどおりメールの6桁コード。
 *
 * 覚えておくのは「どの認証器で開けるか」（認証器のID）だけで、この端末の中に置く。
 * 顔や指紋のデータはアプリにも Supabase にも来ない（端末の外に出ない仕組み）。
 *
 * 認証器を通らないと開かない。開けないときは「ログインし直す」＝サインアウトして、
 * メールのコードで入り直してもらう。ロックを外す裏道は作らない。
 */

export const LOCK_AFTER_MS = 5 * 60_000;

export type LockSetting =
  | { enabled: true; credentialId: string }
  | { enabled: false; asked: boolean };

const key = (userId: string) => `syncle.lock.${userId}`;

/** 端末の生体認証が使えるか */
export async function lockSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function readLock(userId: string): LockSetting | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as LockSetting;
    if (v.enabled && typeof v.credentialId === "string" && v.credentialId) return v;
    if (!v.enabled) return { enabled: false, asked: Boolean((v as { asked?: boolean }).asked) };
    return null;
  } catch {
    return null;
  }
}

export function writeLock(userId: string, value: LockSetting) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(value));
  } catch {
    // 保存できない（プライベートブラウズ等）。ロックは掛からないまま
  }
}

const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function challenge(): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(out);
  return out;
}

/** 認証器を登録する（設定でオンにしたとき）。押した操作の中で呼ぶこと（ブラウザの決まり） */
export async function registerLock(user: { id: string; email: string; name: string }): Promise<string> {
  const id = new TextEncoder().encode(user.id).slice(0, 64);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "SYNCLE", id: location.hostname },
      user: { id, name: user.email, displayName: user.name || user.email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("登録できませんでした。");
  return toB64(cred.rawId);
}

/** 生体認証を通す。通れば true。取り消し・失敗は false */
export async function unlockWith(credentialId: string): Promise<boolean> {
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64(credentialId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return Boolean(got);
  } catch {
    return false;
  }
}

/** 設定画面の「ロック画面を試す」から、いま開いているロックを掛ける */
export const LOCK_NOW_EVENT = "syncle:lock-now";
/** 設定でオン・オフを変えたことを、ロックの見張り役に知らせる */
export const LOCK_CHANGED_EVENT = "syncle:lock-changed";
