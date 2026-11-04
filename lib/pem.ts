/**
 * 秘密鍵（PEM）を、改行が崩れていても読める形に組み直す。
 *
 * 環境変数に貼る途中で、秘密鍵の改行が
 *   ・空白に置き換わる
 *   ・消える
 *   ・文字の \n のまま残る
 * ことがある。どれも OpenSSL は
 *   error:1E08010C:DECODER routines::unsupported
 * としか言わず、原因が分からない。
 *
 * 見出し（-----BEGIN … -----）と結び（-----END … -----）の間の
 * 本体だけを取り出し、余計な文字を落として64文字ごとに折り直す。
 * 本体さえ欠けていなければ、これで元どおりになる。
 *
 * 鍵の中身は外に出さない。診断に返すのは長さと形だけ。
 */

/** 2048bit の RSA 鍵（PKCS#8）の本体はだいたいこの長さ */
export const EXPECTED_PEM_BODY = 1624;

export type PemResult =
  | { ok: true; pem: string; bodyLength: number }
  | { ok: false; reason: string };

export function normalizePem(raw: string): PemResult {
  const unescaped = raw.replace(/\\n/g, "\n").replace(/\r/g, "");

  const match = unescaped.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) {
    const hasBegin = /-----BEGIN [A-Z ]+-----/.test(unescaped);
    return {
      ok: false,
      reason: hasBegin
        ? "秘密鍵の終わり（-----END PRIVATE KEY-----）がありません。途中で切れています。"
        : "秘密鍵の見出し（-----BEGIN PRIVATE KEY-----）が見つかりません。",
    };
  }

  const label = match[1];
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];

  return {
    ok: true,
    pem: `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`,
    bodyLength: body.length,
  };
}
