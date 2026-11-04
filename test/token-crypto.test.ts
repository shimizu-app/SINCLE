import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptWith, encryptWith, parseKey } from "../lib/token-crypto";

/** 連携トークンの暗号化（lib/token-crypto.ts）。鍵はその場で作る捨て鍵 */

const key = randomBytes(32);

test("暗号化したものは元に戻せる", () => {
  const token = "ya29.a0AfB_byC-example-access-token";
  const packed = encryptWith(key, token);
  assert.notEqual(packed, token);
  assert.ok(!packed.includes("ya29"), "暗号文に元の文字列が見えてはいけない");
  assert.equal(decryptWith(key, packed), token);
});

test("同じものを暗号化しても、毎回ちがう暗号文になる", () => {
  assert.notEqual(encryptWith(key, "same"), encryptWith(key, "same"));
});

test("別の鍵では開けない", () => {
  const packed = encryptWith(key, "secret");
  assert.throws(() => decryptWith(randomBytes(32), packed));
});

test("書き換えられた暗号文は弾く", () => {
  const packed = encryptWith(key, "secret");
  const parts = packed.split(".");
  const body = Buffer.from(parts[3], "base64url");
  body[0] ^= 0xff;
  parts[3] = body.toString("base64url");
  assert.throws(() => decryptWith(key, parts.join(".")));
});

test("鍵の長さが32バイトでなければ使わない", () => {
  assert.equal(parseKey(undefined), null);
  assert.equal(parseKey(""), null);
  assert.equal(parseKey(randomBytes(16).toString("base64")), null);
  assert.ok(parseKey(randomBytes(32).toString("base64")));
});
