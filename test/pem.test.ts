import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { EXPECTED_PEM_BODY, normalizePem } from "../lib/pem";

/**
 * 秘密鍵の組み直し（lib/pem.ts）。
 *
 * 本番で実際に出た error:1E08010C:DECODER routines::unsupported は、
 * 貼る途中で秘密鍵の改行が崩れたときに出る。
 * 崩れ方ごとに、組み直せば署名できることを確かめる。
 * 鍵はその場で作る捨て鍵。
 */

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function signs(pem: string): boolean {
  try {
    createSign("RSA-SHA256").update("x").sign(pem);
    return true;
  } catch {
    return false;
  }
}

const broken: Record<string, string> = {
  "改行が空白になった": privateKey.replace(/\n/g, " "),
  "改行が消えた": privateKey.replace(/\n/g, ""),
  "改行が文字の \\n のまま": privateKey.replace(/\n/g, "\\n"),
  "CRLF": privateKey.replace(/\n/g, "\r\n"),
};

test("崩れた鍵は、そのままでは署名できない（再現の確認）", () => {
  assert.equal(signs(broken["改行が空白になった"]), false);
  assert.equal(signs(broken["改行が消えた"]), false);
  assert.equal(signs(broken["改行が文字の \\n のまま"]), false);
});

for (const [label, raw] of Object.entries(broken)) {
  test(`組み直せば署名できる：${label}`, () => {
    const got = normalizePem(raw);
    assert.equal(got.ok, true);
    if (got.ok) {
      assert.equal(signs(got.pem), true);
      assert.ok(Math.abs(got.bodyLength - EXPECTED_PEM_BODY) < 20, `本体 ${got.bodyLength}文字`);
    }
  });
}

test("正常な鍵は壊さない", () => {
  const got = normalizePem(privateKey);
  assert.equal(got.ok, true);
  if (got.ok) assert.equal(signs(got.pem), true);
});

test("結びが無い（途中で切れた）鍵は、理由つきで弾く", () => {
  const got = normalizePem(privateKey.slice(0, 900));
  assert.equal(got.ok, false);
  if (!got.ok) assert.match(got.reason, /切れています/);
});

test("見出しも無いものは、理由つきで弾く", () => {
  const got = normalizePem("これは鍵ではない");
  assert.equal(got.ok, false);
  if (!got.ok) assert.match(got.reason, /見つかりません/);
});
