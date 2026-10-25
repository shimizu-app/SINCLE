import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorText, isOffline } from "../lib/auth-errors";

test("繋がらないとき（iOS Safari の Load failed）", () => {
  const t = authErrorText({ message: "Load failed" });
  assert.match(t, /繋がりませんでした/);
  assert.match(t, /一時停止/);
  assert.equal(isOffline({ message: "Load failed" }), true);
});

test("繋がらないとき（Chrome の Failed to fetch）", () => {
  assert.match(authErrorText({ message: "Failed to fetch" }), /繋がりませんでした/);
});

test("回数制限", () => {
  assert.match(authErrorText({ message: "Email rate limit exceeded", status: 429 }), /回数制限/);
  assert.match(authErrorText({ message: "whatever", status: 429 }), /回数制限/);
});

test("メールを送れなかった", () => {
  assert.match(authErrorText({ message: "Error sending magic link email" }), /メールを送れませんでした/);
});

test("コードが違う", () => {
  assert.match(authErrorText({ message: "Token has expired or is invalid" }), /コードが違う/);
  assert.equal(isOffline({ message: "Token has expired or is invalid" }), false);
});

test("知らないエラーは元の文も見せる", () => {
  const t = authErrorText({ message: "Something very unexpected" });
  assert.match(t, /Something very unexpected/);
});

test("error が無くても落ちない", () => {
  assert.match(authErrorText(null), /もう一度/);
  assert.equal(isOffline(undefined), false);
});
