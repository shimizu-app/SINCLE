import { PREFECTURES } from "@/lib/design";

/**
 * 名刺のOCR結果を、登録フォームの各欄に振り分ける（SCREENS 6）。
 *
 * 完璧には当たらない。当たらないことを前提に、
 * 「どの欄にどれを入れたか」を画面で見せて直させる作りにしている。
 * だから、ここは確実なものだけを入れて、迷ったら空にする。
 *
 * 外部の呼び出しは無いので、サーバー・ブラウザどちらからでも使える。
 */

export type CardFields = {
  companyName: string;
  contactName: string;
  dept: string;
  title: string;
  email: string;
  phone: string;
  web: string;
  address: string;
};

export const EMPTY_CARD: CardFields = {
  companyName: "",
  contactName: "",
  dept: "",
  title: "",
  email: "",
  phone: "",
  web: "",
  address: "",
};

/* ── 手がかり ───────────────────────────────────────────── */

const CORP = /(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|医療法人|学校法人|\(株\)|（株）|\(有\)|（有）|Inc\.|Corp\.|Co\.,?\s*Ltd|Company|LLC)/i;

// design.ts の RANK_RULES と同じ言葉に、名刺で見かける肩書きを足したもの。
// ここを広げすぎると氏名を役職と間違えるので、役職語だけに絞る。
const TITLE =
  /(代表取締役|取締役|代表|社長|会長|副社長|専務|常務|執行役員|役員|監査役|本部長|事業部長|支店長|工場長|部長|次長|課長|係長|室長|主任|主幹|マネージャー|マネジャー|リーダー|チーフ|顧問|参与|理事|CEO|COO|CFO|CTO|CMO|President|Director|Manager|Chief)/;

const DEPT = /(事業部|本部|支社|支店|営業所|研究所|工場|センター|統括部|部門|[^\s]{1,8}部(?!長)|[^\s]{1,8}課(?!長)|[^\s]{1,8}室(?!長)|[^\s]{1,8}グループ|[^\s]{1,8}チーム|Division|Department)/;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL_RE = /((https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}[\w./?#%=&-]*)/i;
const ZIP = /〒?\s*\d{3}\s*-\s*\d{4}/;

// 0 から始まる日本の番号、+81、内線や括弧つきも拾う
const PHONE = /(\+81[\d\s()-]{8,}|0\d{1,4}[\s()-]*\d{1,4}[\s()-]*\d{3,4})/;
const FAX = /(FAX|Fax|ファックス|ファクシミリ|ＦＡＸ)/;
const TEL_LABEL = /(TEL|Tel|電話|携帯|携|Mobile|MOBILE|M)/;

/** 氏名らしさ：漢字・ひらがな・カタカナだけ、または欧字2語 */
const JP_NAME = /^[一-鿿぀-ゟ゠-ヿ々ヶ\s　]{2,12}$/;
const EN_NAME = /^[A-Z][a-z]+\s+[A-Z][a-zA-Z'-]+$/;

/* ── 本体 ───────────────────────────────────────────────── */

export function parseCard(text: string): CardFields {
  const lines = text
    .split(/\r?\n/)
    .map((line) => toHalfWidth(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: CardFields = { ...EMPTY_CARD };
  const used = new Set<number>();

  // ── メール ──
  lines.forEach((line, i) => {
    if (out.email) return;
    const hit = line.match(EMAIL);
    if (hit) {
      out.email = hit[0];
      used.add(i);
    }
  });

  // ── Web ──
  // メールのドメインを拾ってしまわないよう、@ のある行は見ない
  lines.forEach((line, i) => {
    if (out.web || line.includes("@")) return;
    const hit = line.match(URL_RE);
    if (hit) {
      out.web = hit[0].replace(/[.,、。]$/, "");
      used.add(i);
    }
  });

  // ── 電話 ──
  // FAX は電話に入れない。TEL と書いてある行を先に見て、無ければ素の番号。
  const labelled = lines.find((line) => TEL_LABEL.test(line) && !FAX.test(line) && PHONE.test(line));
  const bare = lines.find((line) => !FAX.test(line) && PHONE.test(line));
  const phoneLine = labelled ?? bare;
  if (phoneLine) {
    const hit = phoneLine.match(PHONE);
    if (hit) out.phone = tidyPhone(hit[0]);
  }

  // ── 会社名 ──
  lines.forEach((line, i) => {
    if (out.companyName) return;
    if (CORP.test(line)) {
      out.companyName = line.replace(/^(社名|会社名)[:：]?\s*/, "").trim();
      used.add(i);
    }
  });

  // ── 住所 ──
  // 〒 の行、または都道府県から始まる行。〒 だけの行なら次の行とつなげる。
  const zipAt = lines.findIndex((line) => ZIP.test(line));
  const prefAt = lines.findIndex((line) => PREFECTURES.some((pref) => line.includes(pref)));

  if (zipAt >= 0) {
    const zipLine = lines[zipAt];
    const onlyZip = zipLine.replace(ZIP, "").replace(/[〒\s]/g, "") === "";
    out.address = onlyZip ? [zipLine, lines[zipAt + 1] ?? ""].join(" ").trim() : zipLine;
    used.add(zipAt);
    if (onlyZip) used.add(zipAt + 1);
    // 〒 の行に町名まで入っていないことがある。都道府県の行が別にあれば足す。
    if (prefAt >= 0 && prefAt !== zipAt && !out.address.includes(lines[prefAt])) {
      out.address = `${out.address} ${lines[prefAt]}`.trim();
      used.add(prefAt);
    }
  } else if (prefAt >= 0) {
    out.address = lines[prefAt];
    used.add(prefAt);
  }

  // ── 役職と部署 ──
  // 1行に「営業部 部長」と並ぶことも、別の行に分かれることもある。
  lines.forEach((line, i) => {
    if (used.has(i) || CORP.test(line)) return;

    const title = line.match(TITLE);
    if (title && !out.title) {
      out.title = line.length <= 24 ? line : title[0];
      used.add(i);
      // 同じ行に部署も入っていれば切り出す
      const rest = line.replace(TITLE, " ").replace(/\s+/g, " ").trim();
      if (!out.dept && rest && DEPT.test(rest)) out.dept = rest;
      return;
    }

    if (!out.dept && DEPT.test(line) && line.length <= 24) {
      out.dept = line;
      used.add(i);
    }
  });

  // ── 氏名 ──
  // 残った行のうち、氏名らしい形のものを上から。
  // 役職の行の次に名前が来る名刺が多いので、そこを先に見る。
  const titleAt = lines.findIndex((line) => line === out.title);
  const order = [
    ...(titleAt >= 0 ? [titleAt + 1] : []),
    ...lines.map((_, i) => i),
  ];

  for (const i of order) {
    if (i < 0 || i >= lines.length || used.has(i) || out.contactName) continue;
    const line = lines[i];
    if (CORP.test(line) || TITLE.test(line) || DEPT.test(line)) continue;
    if (line.includes("@") || PHONE.test(line) || ZIP.test(line)) continue;
    if (JP_NAME.test(line) || EN_NAME.test(line)) {
      out.contactName = line.replace(/\s+/g, " ").trim();
      used.add(i);
    }
  }

  return out;
}

/**
 * 全角の英数字と記号を半角にする。
 *
 * 先に通しておかないと「（０３）１２３４-５６７８」が電話として引っかからない。
 * 漢字・ひらがな・カタカナはそのまま。氏名が壊れないようにする。
 */
function toHalfWidth(line: string): string {
  return line
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/** 括弧を落として、090-1234-5678 の形に寄せる */
function tidyPhone(raw: string): string {
  return raw
    .replace(/[()]/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
