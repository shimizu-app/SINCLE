import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCard } from "../lib/card";

/**
 * 名刺のOCR結果の振り分け（lib/card.ts）。
 *
 *   npm run test:card
 *
 * Vision が返す文字列は行ごとに改行が入る。実物に近い並びで書いてある。
 */

test("ごく普通の名刺", () => {
  const got = parseCard(
    [
      "株式会社ミライ精機",
      "営業本部 第一営業部",
      "部長",
      "佐藤 花子",
      "〒460-0008",
      "愛知県名古屋市中区栄3-1-1",
      "TEL 052-123-4567",
      "FAX 052-123-4568",
      "hanako.sato@mirai-seiki.co.jp",
      "https://www.mirai-seiki.co.jp",
    ].join("\n")
  );

  assert.equal(got.companyName, "株式会社ミライ精機");
  assert.equal(got.contactName, "佐藤 花子");
  assert.equal(got.title, "部長");
  assert.equal(got.email, "hanako.sato@mirai-seiki.co.jp");
  assert.equal(got.phone, "052-123-4567", "FAX を電話に入れてはいけない");
  assert.equal(got.web, "https://www.mirai-seiki.co.jp");
  assert.match(got.address, /愛知県名古屋市中区栄/);
  assert.match(got.dept, /営業/);
});

test("役職と部署が1行に並ぶ", () => {
  const got = parseCard(
    ["有限会社あおぞら商会", "総務部 課長", "鈴木 一郎", "ichiro@aozora.jp"].join("\n")
  );
  assert.equal(got.companyName, "有限会社あおぞら商会");
  assert.equal(got.contactName, "鈴木 一郎");
  assert.match(got.title, /課長/);
  assert.match(got.dept, /総務/);
});

test("代表取締役（ティア判定に効く役職）", () => {
  const got = parseCard(
    ["アルテック株式会社", "代表取締役社長", "田中 太郎", "090-1234-5678"].join("\n")
  );
  assert.equal(got.companyName, "アルテック株式会社");
  assert.equal(got.title, "代表取締役社長");
  assert.equal(got.contactName, "田中 太郎");
  assert.equal(got.phone, "090-1234-5678");
});

test("英語の名刺", () => {
  const got = parseCard(
    [
      "ORINAMI Inc.",
      "Sales Division",
      "Director",
      "Haru Shimizu",
      "shimizu@nico-inc.net",
      "www.orinami.jp",
    ].join("\n")
  );
  assert.equal(got.companyName, "ORINAMI Inc.");
  assert.equal(got.contactName, "Haru Shimizu");
  assert.equal(got.title, "Director");
  assert.equal(got.web, "www.orinami.jp");
});

test("電話が括弧つき・全角", () => {
  const got = parseCard(["株式会社テスト", "電話（０３）１２３４-５６７８"].join("\n"));
  assert.equal(got.phone, "03-1234-5678");
});

test("メールのドメインを Web に入れない", () => {
  const got = parseCard(["株式会社テスト", "taro@example.co.jp"].join("\n"));
  assert.equal(got.email, "taro@example.co.jp");
  assert.equal(got.web, "");
});

test("〒だけの行は次の行とつなぐ", () => {
  const got = parseCard(["株式会社テスト", "〒150-0001", "東京都渋谷区神宮前1-2-3"].join("\n"));
  assert.match(got.address, /150-0001/);
  assert.match(got.address, /東京都渋谷区神宮前/);
});

test("読めなかったときは空で返す（null や undefined にしない）", () => {
  const got = parseCard("");
  assert.equal(got.companyName, "");
  assert.equal(got.contactName, "");
  assert.equal(got.phone, "");
});

test("会社名が無くても他は拾う", () => {
  const got = parseCard(["山田 次郎", "jiro@example.com", "03-0000-0000"].join("\n"));
  assert.equal(got.contactName, "山田 次郎");
  assert.equal(got.email, "jiro@example.com");
});

test("カタカナの役職も拾う（ディレクターなど）", () => {
  const got = parseCard(["株式会社サンプル", "クリエイティブ部", "アートディレクター", "山田 太郎", "taro@sample.co.jp"].join("\n"));
  assert.equal(got.title, "アートディレクター");
  assert.equal(got.dept, "クリエイティブ部");
  assert.equal(got.contactName, "山田 太郎");

  const pm = parseCard(["株式会社サンプル", "シニアプロデューサー 佐藤 花子", "hanako@sample.co.jp"].join("\n"));
  assert.match(pm.title ?? "", /プロデューサー/);
});

test("英語の役職は単語の切れ目で見る", () => {
  const got = parseCard(["Leading Edge Inc.", "Head of Sales", "John Smith", "john@leading.example"].join("\n"));
  assert.equal(got.title, "Head of Sales");
});
