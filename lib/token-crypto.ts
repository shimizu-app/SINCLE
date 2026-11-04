import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 外部連携のトークンを、データベースに入れる前に暗号化する。
 *
 * integrations は RLS で誰も select できないようにしてあるが（009）、
 * データベースの中身そのもの（バックアップやダッシュボード）には平文で残ってしまう。
 * 鍵はサーバーの環境変数（TOKEN_ENCRYPTION_KEY）にだけ置き、
 * データベースには暗号文しか入れない。
 *
 * AES-256-GCM。改ざんされていれば復号の時点で弾かれる。
 * 形式：v1.<iv>.<tag>.<本文>（それぞれ base64url）
 *
 * 鍵は引数で受け取る。環境変数を読むのは呼び出し側（lib/google.ts）。
 * こうしておくと、テストで捨て鍵を渡して確かめられる。
 */

const VERSION = "v1";

/** 32バイトの鍵を base64 から戻す。長さが違えば null */
export function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  return key.length === 32 ? key : null;
}

export function encryptWith(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptWith(key: Buffer, packed: string): string {
  const [version, iv, tag, body] = packed.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) {
    throw new Error("暗号文の形が違います");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
