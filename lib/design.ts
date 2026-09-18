/**
 * SYNCLE デザイントークン
 * lib/design.ts としてそのまま使えます。
 */

/* ══════════════ 色 ══════════════ */

export const C = {
  purple: "#8851D8",
  blue:   "#3E86ED",
  green:  "#2A9D67",
  red:    "#EA392B",
  pink:   "#F58BB4",
  yellow: "#F9C22E",
  orange: "#F2811D",
  lime:   "#A5D99E",
  ink:    "#141414",
  bg:     "#FDFAF4",
  line:   "#EDE7DC",
} as const;

/** 淡い版（背景に使う） */
export const SOFT = {
  purple: "#EFE6FC",
  blue:   "#E2EDFD",
  green:  "#DDF0E6",
  red:    "#FCE3E0",
  pink:   "#FDE8F1",
  yellow: "#FEF3D6",
  orange: "#FDEADB",
  lime:   "#EDF7EA",
} as const;

export type ColorKey = keyof typeof C;

/* ══════════════ 形（viewBox 0 0 100 100） ══════════════ */

export const SHAPES = {
  flower: "M50 4c8 0 13 7 13 15 6-5 15-5 20 1s5 15-1 20c8 0 15 5 15 13s-7 13-15 13c6 5 6 14 1 20s-14 6-20 1c0 8-5 15-13 15s-13-7-13-15c-5 5-14 5-20-1s-6-14-1-20C8 66 1 61 1 53s7-13 15-13c-6-5-6-14 0-20s15-6 20-1c0-8 6-15 14-15z",
  clover: "M50 12c9-11 27-8 30 5s-8 22-19 22c11 0 22 9 20 21s-19 17-27 8c3 11-5 22-17 22s-20-11-17-22c-8 9-25 4-27-8s9-21 20-21C2 39-8 24 0 13S26 1 35 12c4-5 11-5 15 0z",
  sun:    "M50 0l9 12 14-7 3 15 15 1-6 14 12 10-12 10 6 14-15 1-3 15-14-7-9 12-9-12-14 7-3-15-15-1 6-14L0 45l12-10-6-14 15-1 3-15 14 7z",
  blob:   "M78 12c12 9 20 26 17 41s-17 27-32 32S31 89 20 78 2 50 6 35 24 8 40 5s26-2 38 7z",
  hex:    "M50 3c4 0 39 18 42 22s3 46 0 50-38 22-42 22-39-18-42-22-3-46 0-50S46 3 50 3z",
  burst:  "M50 2l8 16 17-9-4 19 19 3-13 14 15 12-19 6 6 19-19-3-3 19-14-13-14 13-3-19-19 3 6-19-19-6 15-12L-4 31l19-3-4-19 17 9z",
  stamp:  "M50 3l11 8 13-3 5 13 13 6-3 13 8 11-8 11 3 13-13 6-5 13-13-3-11 8-11-8-13 3-5-13-13-6 3-13-8-11 8-11-3-13 13-6 5-13 13 3z",
  drop:   "M50 2c14 20 34 32 34 52 0 21-15 36-34 36S16 75 16 54C16 34 36 22 50 2z",
  cloud:  "M28 78C13 78 2 68 2 55s11-23 25-23c3-15 16-26 32-26 17 0 31 12 33 28 6 3 10 10 10 18 0 15-11 26-26 26z",
  wave:   "M10 22c14-9 24 6 40 0s26-11 40 0v52c-14 11-24-4-40 2s-26 7-40 0z",
  arch:   "M50 4c26 0 46 20 46 46v34c0 7-5 12-12 12H16c-7 0-12-5-12-12V50C4 24 24 4 50 4z",
  square: "M22 6h56c9 0 16 7 16 16v56c0 9-7 16-16 16H22c-9 0-16-7-16-16V22C6 13 13 6 22 6z",
} as const;

export type ShapeKey = keyof typeof SHAPES;

/* ══════════════ 角丸 ══════════════ */

/**
 * 角丸は統一しない。左右非対称を基本とし、隣り合う要素で反転させる。
 * index を渡すと交互に返る。
 */
export const radius = {
  card:   (i = 0) => (i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px"),
  item:   (i = 0) => (i % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px"),
  chip:   (i = 0) => (i % 2 ? "7px 14px 7px 14px"   : "14px 7px 14px 7px"),
  badge:  (i = 0) => (i % 2 ? "5px 10px 5px 10px"   : "10px 5px 10px 5px"),
  button: (i = 0) => (i % 2 ? "12px 24px 12px 24px" : "24px 12px 24px 12px"),
  sheet:  "32px 32px 0 0",
  header: "28px 28px 14px 28px",
  pill:   "999px",
} as const;

/* ══════════════ 業種からアイコンを決める ══════════════ */

const INDUSTRY_ART: [RegExp, ShapeKey, ColorKey][] = [
  [/SaaS|システム|IT|通信|開発/,              "hex",    "purple"],
  [/広告|マーケ|メディア|エンタメ|出版/,       "flower", "pink"],
  [/デザイン|クリエイティブ/,                  "blob",   "red"],
  [/コンサル|会計|法律|士業|金融|保険/,        "sun",    "yellow"],
  [/食品|飲料|飲食|農林/,                      "clover", "green"],
  [/製造|建設|物流|運送|卸売|商社/,            "stamp",  "blue"],
  [/医療|介護|教育|美容|旅行/,                 "drop",   "orange"],
];

export function companyArt(industry?: string, dealType?: string) {
  const key = `${industry ?? ""} ${dealType ?? ""}`;
  const hit = INDUSTRY_ART.find(([re]) => re.test(key));
  if (hit) return { shape: hit[1], color: hit[2] };
  const shapes: ShapeKey[] = ["hex", "clover", "blob", "sun", "flower"];
  const colors: ColorKey[] = ["purple", "green", "blue", "orange", "pink"];
  const i = (industry ?? "").length % 5;
  return { shape: shapes[i], color: colors[i] };
}

/* ══════════════ 機能アイコン ══════════════ */

export const FEATURE: Record<string, { shape: ShapeKey; color: ColorKey; face?: boolean; wink?: boolean }> = {
  customers: { shape: "flower", color: "purple", face: true },
  channels:  { shape: "flower", color: "pink",   face: true },
  scan:      { shape: "clover", color: "green",  face: true },
  mail:      { shape: "square", color: "blue",   face: true, wink: true },
  tasks:     { shape: "sun",    color: "yellow", face: true },
  roadmap:   { shape: "burst",  color: "orange", face: true },
  calendar:  { shape: "arch",   color: "green" },
  timeline:  { shape: "wave",   color: "blue" },
  ai:        { shape: "burst",  color: "purple" },
  company:   { shape: "hex",    color: "purple" },
  contact:   { shape: "blob",   color: "orange" },
  meeting:   { shape: "drop",   color: "purple" },
  note:      { shape: "cloud",  color: "blue" },
};

/* ══════════════ 業務上の分類 ══════════════ */

export const TIER_STYLE = {
  A: { color: "purple" as ColorKey, shape: "stamp"  as ShapeKey },
  B: { color: "blue"   as ColorKey, shape: "wave"   as ShapeKey },
  C: { color: "green"  as ColorKey, shape: "blob"   as ShapeKey },
};

export const PRIORITY_STYLE = {
  "高": { color: "red"    as ColorKey, shape: "burst"  as ShapeKey },
  "中": { color: "orange" as ColorKey, shape: "square" as ShapeKey },
  "低": { color: "blue"   as ColorKey, shape: "blob"   as ShapeKey },
};

export const DEAL_TYPE_COLOR: Record<string, ColorKey> = {
  "マーケティング":   "pink",
  "デザイン":         "red",
  "Web制作":          "blue",
  "システム開発":     "purple",
  "コンサルティング": "yellow",
  "その他":           "green",
};

export const DEAL_STATUS = {
  talking:  { label: "商談中",     color: "orange" as ColorKey, shape: "sun"    as ShapeKey, limitDays: 7 },
  proposal: { label: "提案準備中", color: "purple" as ColorKey, shape: "flower" as ShapeKey, limitDays: 5 },
  quote:    { label: "見積提出済", color: "blue"   as ColorKey, shape: "hex"    as ShapeKey, limitDays: 7 },
  working:  { label: "制作進行中", color: "green"  as ColorKey, shape: "clover" as ShapeKey, limitDays: 10 },
  review:   { label: "確認待ち",   color: "pink"   as ColorKey, shape: "drop"   as ShapeKey, limitDays: 5 },
  paused:   { label: "保留",       color: "lime"   as ColorKey, shape: "blob"   as ShapeKey, limitDays: 30 },
};

export const DOC_KIND = {
  contract: { label: "契約書",      color: "red"    as ColorKey, shape: "stamp"  as ShapeKey },
  quote:    { label: "見積書",      color: "orange" as ColorKey, shape: "square" as ShapeKey },
  proposal: { label: "提案書",      color: "purple" as ColorKey, shape: "flower" as ShapeKey },
  invoice:  { label: "請求書",      color: "green"  as ColorKey, shape: "clover" as ShapeKey },
  spec:     { label: "仕様・資料",  color: "blue"   as ColorKey, shape: "hex"    as ShapeKey },
  other:    { label: "その他",      color: "lime"   as ColorKey, shape: "blob"   as ShapeKey },
};

export const KEY_GENRE = {
  it:        { label: "IT・システム", color: "purple" as ColorKey, shape: "hex"    as ShapeKey },
  maker:     { label: "製造・建設",   color: "blue"   as ColorKey, shape: "stamp"  as ShapeKey },
  food:      { label: "食品・飲食",   color: "green"  as ColorKey, shape: "clover" as ShapeKey },
  medical:   { label: "医療・福祉",   color: "pink"   as ColorKey, shape: "drop"   as ShapeKey },
  retail:    { label: "小売・EC",     color: "orange" as ColorKey, shape: "blob"   as ShapeKey },
  ad:        { label: "広告・制作",   color: "red"    as ColorKey, shape: "flower" as ShapeKey },
  finance:   { label: "金融・士業",   color: "yellow" as ColorKey, shape: "sun"    as ShapeKey },
  logistics: { label: "物流・運送",   color: "blue"   as ColorKey, shape: "burst"  as ShapeKey },
  public:    { label: "行政・団体",   color: "green"  as ColorKey, shape: "sun"    as ShapeKey },
  other:     { label: "その他",       color: "lime"   as ColorKey, shape: "blob"   as ShapeKey },
};

export const KEY_LAYER = {
  bigexec:   { label: "大手の経営層", color: "purple" as ColorKey },
  smeexec:   { label: "中小の経営者", color: "blue"   as ColorKey },
  manager:   { label: "部長・現場長", color: "green"  as ColorKey },
  academia:  { label: "大学・研究者", color: "orange" as ColorKey },
  public:    { label: "行政・議員",   color: "red"    as ColorKey },
  finance:   { label: "金融・投資家", color: "yellow" as ColorKey },
  media:     { label: "メディア",     color: "pink"   as ColorKey },
  community: { label: "地域の集まり", color: "lime"   as ColorKey },
};

export const KEY_SCOPE = {
  national: { label: "全国", color: "purple" as ColorKey, shape: "burst"  as ShapeKey, desc: "全国区で名前が通る" },
  region:   { label: "地方", color: "blue"   as ColorKey, shape: "hex"    as ShapeKey, desc: "九州全域に顔が利く" },
  pref:     { label: "県",   color: "green"  as ColorKey, shape: "clover" as ShapeKey, desc: "県内でつながりが広い" },
};

export const AGENDA_STATE = {
  decided: { label: "決定済み",     color: "green"  as ColorKey },
  talking: { label: "話し合い中",   color: "orange" as ColorKey },
  todo:    { label: "これから話す", color: "blue"   as ColorKey },
};

export const TASK_SHARE = {
  self:     { label: "自分だけ",     calendar: "自分のカレンダー",     color: "blue"   as ColorKey, shape: "blob"   as ShapeKey },
  assignee: { label: "担当者",       calendar: "担当者のカレンダー",   color: "green"  as ColorKey, shape: "clover" as ShapeKey },
  team:     { label: "チーム全員",   calendar: "チーム共有カレンダー", color: "purple" as ColorKey, shape: "flower" as ShapeKey },
};

/* ══════════════ 業種（31種） ══════════════ */

export const INDUSTRIES = [
  "SaaS/業務システム", "ITサービス/受託開発", "Web制作/制作会社", "通信/インフラ",
  "広告/マーケティング支援", "デザイン/クリエイティブ", "エンタメ/メディア", "出版/印刷",
  "人材/派遣", "コンサルティング", "会計/法律/士業", "金融/保険",
  "不動産", "建設/工事", "製造/機械", "製造/電子部品", "製造/化学・素材",
  "食品/飲料", "小売/EC", "卸売/商社", "物流/運送",
  "医療/クリニック", "介護/福祉", "教育/スクール", "飲食/外食",
  "美容/サロン", "旅行/宿泊", "農林水産", "官公庁/自治体", "団体/NPO", "その他",
];

export const DEAL_TYPES = [
  "マーケティング", "デザイン", "Web制作", "システム開発", "コンサルティング", "その他",
];

export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

/* ══════════════ ティア判定 ══════════════ */

const RANK_RULES: [RegExp, number][] = [
  [/代表|社長|CEO|COO|CFO|CTO|役員|取締役|専務|常務/, 3],
  [/本部長|事業部長|部長/,                             2],
  [/課長|マネージャー|マネジャー|リーダー|室長|主任/,  1],
];

export function titleScore(title?: string): number {
  if (!title) return 0;
  const hit = RANK_RULES.find(([re]) => re.test(title));
  return hit ? hit[1] : 0;
}

export function sizeScore(employees?: number): number {
  const n = employees ?? 0;
  if (n >= 300) return 2;
  if (n >= 50) return 1;
  return 0;
}

export function judgeTier(title?: string, employees?: number) {
  const t = titleScore(title);
  const s = sizeScore(employees);
  const total = t + s;
  const tier = total >= 4 ? "A" : total >= 2 ? "B" : "C";
  return { tier, titleScore: t, sizeScore: s, total };
}

/* ══════════════ 放置判定 ══════════════ */

export function dealHeat(daysSinceUpdate: number, status: keyof typeof DEAL_STATUS) {
  const limit = DEAL_STATUS[status].limitDays;
  if (daysSinceUpdate >= limit * 2) return { level: "stopped" as const, color: C.red, text: "止まっています" };
  if (daysSinceUpdate >= limit)     return { level: "slow"    as const, color: C.orange, text: "動きがありません" };
  return null;
}

/* ══════════════ 会社名の正規化（重複検出用） ══════════════ */

export function normalizeCompanyName(name: string): string {
  return name
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）|\(有\)|（有）/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/* ══════════════ ワークスペースのslug ══════════════ */

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/株式会社|有限会社|合同会社/g, "")
      .replace(/[^a-z0-9ぁ-んァ-ン一-龥]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "workspace"
  );
}

/* ══════════════ モーション ══════════════ */

export const EASE = {
  /** 基本。減速して収まる */
  out: "cubic-bezier(.22,1,.36,1)",
  /** 跳ねる。ボタンや選択状態に */
  spring: "cubic-bezier(.34,1.56,.64,1)",
} as const;

export const DURATION = {
  screen: 340,
  item: 400,
  stagger: 45,
  sheet: 300,
  toast: 260,
  press: 140,
  bar: 600,
} as const;

/* ══════════════ フォント ══════════════ */

export const FONT_IMPORT =
  "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800;900&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap";

export const FONT_STACK = "'M PLUS Rounded 1c', 'Zen Maru Gothic', system-ui, sans-serif";
export const LETTER_SPACING = "0.015em";
