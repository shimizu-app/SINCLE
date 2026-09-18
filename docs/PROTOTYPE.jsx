import { useState, useMemo, useRef, useEffect } from "react";
import {
  Camera, Search, Check, ChevronLeft, ChevronRight, MoreHorizontal,
  Mail, CheckSquare, Users, Settings, Send, RefreshCw, X, Link2, Inbox,
  Sparkles, Image as ImageIcon, Layers, Hash, UserPlus, AtSign, Star,
  Building2, Plus, Trash2, ArrowUpDown, Wand2, PenLine,
  Calendar, Video, Clock, Copy, MapPin,
  Signal, Wifi, BatteryFull, Filter, List, StickyNote, Map, MessageSquare, ScanFace, AlertCircle, Upload, Download,
} from "lucide-react";

/* ══════════════ 判定ロジック ══════════════ */
const RANK_RULES = [
  { rank: "決裁者", score: 3, re: /代表|社長|会長|CEO|COO|CFO|CTO|CxO|取締役|執行役員|パートナー/i },
  { rank: "部門長", score: 2, re: /本部長|事業部長|部長|統括|室長|Director|VP/i },
  { rank: "管理職", score: 1, re: /課長|マネージャ|主任|係長|リーダー|Manager|Lead/i },
];
const judgeRank = (t = "") => RANK_RULES.find((r) => r.re.test(t)) || { rank: "担当者", score: 0 };
const sizeScore = (n = 0) => (n >= 300 ? 2 : n >= 50 ? 1 : 0);
function companyTier(co) {
  const best = co.contacts.reduce((m, c) => Math.max(m, judgeRank(c.title).score), 0);
  const s = sizeScore(co.employees);
  const total = best + s;
  return { tier: co.tierOverride || (total >= 4 ? "A" : total >= 2 ? "B" : "C"), rankScore: best, sizeScore: s, total };
}

const TIER_STYLE = {
  A: { chip: "bg-amber-100 text-amber-800", label: "Tier A" },
  B: { chip: "bg-indigo-100 text-indigo-800", label: "Tier B" },
  C: { chip: "bg-slate-100 text-slate-600", label: "Tier C" },
};
const DEAL_TYPES = ["マーケティング", "デザイン", "Web制作", "システム開発", "コンサルティング", "その他"];
const DEAL_STYLE = {
  "マーケティング": "bg-pink-100 text-pink-800", "デザイン": "bg-violet-100 text-violet-800",
  "Web制作": "bg-cyan-100 text-cyan-800", "システム開発": "bg-emerald-100 text-emerald-800",
  "コンサルティング": "bg-orange-100 text-orange-800", "その他": "bg-slate-100 text-slate-600",
};
const INDUSTRIES = [
  "SaaS / 業務システム", "ITサービス / 受託開発", "Web制作 / 制作会社", "通信 / インフラ",
  "広告 / マーケティング支援", "デザイン / クリエイティブ", "エンタメ / メディア", "出版 / 印刷",
  "人材 / 派遣", "コンサルティング", "会計 / 法律 / 士業", "金融 / 保険",
  "不動産", "建設 / 工事", "製造 / 機械", "製造 / 電子部品", "製造 / 化学・素材",
  "食品 / 飲料", "小売 / EC", "卸売 / 商社", "物流 / 運送",
  "医療 / クリニック", "介護 / 福祉", "教育 / スクール", "飲食 / 外食",
  "美容 / サロン", "旅行 / 宿泊", "農林水産", "官公庁 / 自治体", "団体 / NPO", "その他",
];

/* メール下書きの目的プリセット */
const PURPOSES = [
  { id: "thanks", label: "本日のお礼", hint: "商談当日のお礼と次のアクション確認" },
  { id: "meeting", label: "面談予約", hint: "次回打合せの日程調整をお願いする" },
  { id: "proposal", label: "提案書の送付", hint: "提案書を送り、確認をお願いする" },
  { id: "quote", label: "見積のご案内", hint: "見積書の送付と有効期限の案内" },
  { id: "followup", label: "フォローアップ", hint: "返信がない相手への丁寧な再連絡" },
  { id: "intro", label: "初回のご挨拶", hint: "名刺交換後の初回メール" },
];
const TONES = ["かなり丁寧", "標準", "ややカジュアル"];

const ME = "u1";
const SEED_TEAM = [
  { id: "u1", name: "清水 晴陽", role: "代表", email: "shimizu@nico-inc.net", color: "bg-blue-100 text-blue-700", status: "active", admin: true,
    av: { kind: "shape", shape: "flower", color: "purple" }, cover: { kind: "color", color: "purple" }, note: "北九州から全国へ。まずは九州で一番相談される会社に。" },
  { id: "u2", name: "佐々木 拓", role: "営業", email: "sasaki@nico-inc.net", color: "bg-emerald-100 text-emerald-700", status: "active",
    av: { kind: "shape", shape: "clover", color: "green" }, cover: { kind: "color", color: "green" }, note: "地場企業まわりが得意です" },
  { id: "u3", name: "井上 まり", role: "カスタマーサクセス", email: "inoue@nico-inc.net", color: "bg-violet-100 text-violet-700", status: "active",
    av: { kind: "shape", shape: "drop", color: "pink" }, cover: { kind: "color", color: "pink" }, note: "既存のお客さまの窓口です" },
  { id: "u4", name: "大西 亮", role: "エンジニア", email: "onishi@nico-inc.net", color: "bg-orange-100 text-orange-700", status: "active",
    av: { kind: "shape", shape: "hex", color: "blue" }, cover: { kind: "color", color: "blue" }, note: "技術まわりは何でも聞いてください" },
  { id: "u5", name: "森 千夏", role: "インサイドセールス", email: "mori@nico-inc.net", color: "bg-pink-100 text-pink-700", status: "invited",
    av: { kind: "shape", shape: "sun", color: "yellow" }, cover: { kind: "color", color: "yellow" }, note: "" },
];
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700", "bg-amber-100 text-amber-700"];
let TEAM = SEED_TEAM;
const user = (id) => TEAM.find((u) => u.id === id) || TEAM[0];
const MY_COMPANY = "株式会社ニコ";

let uid = 100;
const nid = () => `id${++uid}`;

/* ══════════════ 初期データ ══════════════ */
const seed = [
  {
    id: "c1", name: "株式会社アルテック", deal: { on: true, status: "proposal", memo: "API連携の要件を詰めている。8/7のヒアリングで先方の情シスと確認。", amount: "800万", days: 1 },
    docs: [
      { id: "f1", name: "業務委託基本契約書_締結済.pdf", kind: "contract", size: "1.8 MB", at: "2026/03/12", by: "u1", pinned: true, note: "3年更新。次回更新 2029/03" },
      { id: "f2", name: "見積書_基幹システム刷新_ver3.xlsx", kind: "quote", size: "246 KB", at: "2026/08/02", by: "u1", pinned: true, note: "" },
      { id: "f3", name: "提案書_ver2.pdf", kind: "proposal", size: "4.2 MB", at: "2026/08/02", by: "u1", pinned: false, note: "メール送信済み" },
      { id: "f4", name: "API連携_要件メモ.docx", kind: "spec", size: "88 KB", at: "2026/07/30", by: "u4", pinned: false, note: "現行バージョンの制約あり" },
    ], industry: "SaaS / 業務システム", employees: 520,
    revenue: "80億円（2025）", address: "東京都港区赤坂1-2-3", web: "artech.co.jp",
    comment: "既存システムの刷新タイミングが今期中。API連携の要件が肝。",
    dealType: "システム開発", dealNote: "基幹システムとのAPI連携を含む業務システム刷新",
    stage: 2, ownerId: "u1", primaryContactId: "p1", members: ["u1", "u2", "u4"],
    unread: 2, seq: 3, tags: ["展示会2026", "年内受注"],
    contacts: [
      { id: "p1", name: "田中 誠一", dept: "経営企画本部", title: "代表取締役CEO", email: "tanaka@artech.co.jp", phone: "03-1234-5678" },
      { id: "p2", name: "森本 亜衣", dept: "情報システム部", title: "情報システム部 課長", email: "morimoto@artech.co.jp", phone: "03-1234-5679" },
    ],
    tasks: [
      { id: "t1", title: "提案書ver.2を送付", due: "2026-08-05T16:00", assignee: "u1", contactId: "p1", pri: "高", done: false, share: "team",
        subs: [
          { id: "s1", text: "先方の要望を反映する", at: "2026-08-04T10:00", done: true },
          { id: "s2", text: "価格表を差し替える", at: "2026-08-04T15:00", done: false },
          { id: "s3", text: "上長レビューをもらう", at: "2026-08-05T11:00", done: false },
        ] },
      { id: "t2", title: "技術要件のヒアリング設定", due: "2026-08-07T10:00", assignee: "u2", contactId: "p2", pri: "中", done: false, share: "assignee" },
      { id: "t3", title: "初回訪問の御礼メール", due: "2026-07-28", assignee: "u1", contactId: "p1", pri: "低", done: true },
    ],
    messages: [
      { id: "m0", system: true, text: "佐々木 拓 さんがチャンネルに参加しました", at: "7/28" },
      { id: "m1", by: "u1", text: "窓口は田中CEO。情シスの森本課長も接点できました。", at: "7/30 18:02" },
      { id: "m2", by: "u4", text: "@清水 晴陽 API連携、現行バージョンだと工数かかります。要件詰めたい", at: "8/2 09:15" },
    ],
    mails: [
      { id: "e1", dir: "in", subject: "Re: 提案書のご送付", excerpt: "社内共有しました。見積を8月中旬までにいただけますでしょうか。", at: "8/2 11:38", replied: false, from: "tanaka@artech.co.jp" },
      { id: "e2", dir: "out", subject: "提案書のご送付", excerpt: "先日はありがとうございました。添付にてご確認ください。", at: "8/2 10:11", replied: true, from: "tanaka@artech.co.jp" },
    ],
  },
  {
    id: "c2", name: "グロースワークス株式会社", deal: { on: true, status: "quote", memo: "見積を出して以降、返答なし。先方の社内稟議が動いていない可能性。", amount: "180万", days: 12 },
    docs: [{ id: "f5", name: "見積書_リード獲得支援.xlsx", kind: "quote", size: "210 KB", at: "2026/07/22", by: "u5", pinned: false, note: "" }], industry: "広告 / マーケティング支援", employees: 180,
    revenue: "24億円（2025）", address: "東京都渋谷区神南2-1-1", web: "growthworks.jp",
    comment: "資料請求からの流入。競合比較中で温度感は高め。",
    dealType: "マーケティング", dealNote: "toB向けリード獲得施策の設計と運用代行",
    stage: 1, ownerId: "u5", primaryContactId: "p3", members: ["u1", "u5"],
    unread: 0, seq: 2, tags: ["インバウンド", "紹介あり"],
    contacts: [{ id: "p3", name: "佐藤 由美", dept: "マーケティング本部", title: "執行役員 マーケティング本部長", email: "sato@growthworks.jp", phone: "03-2222-3333" }],
    tasks: [{ id: "t4", title: "事例資料の送付", due: "2026-08-06T11:00", assignee: "u5", contactId: "p3", pri: "中", done: false, share: "assignee" }],
    messages: [{ id: "m6", by: "u5", text: "マーケ本部長が窓口です。決裁は社長まで上がる想定。", at: "8/1 16:30" }],
    mails: [{ id: "e4", dir: "in", subject: "資料請求のお礼", excerpt: "サービス概要拝見しました。導入事例をいただけますか。", at: "8/1 16:02", replied: false, from: "sato@growthworks.jp" }],
  },
  {
    id: "c3", name: "日本電装工業株式会社", deal: { on: true, status: "talking", memo: "購買部が窓口。決裁ルートの確認中。", amount: "未定", days: 4 },
    docs: [], industry: "製造 / 電子部品", employees: 1200,
    revenue: "310億円（2025）", address: "神奈川県横浜市西区1-9", web: "ndk-ind.co.jp",
    comment: "コスト重視。購買部が窓口なので決裁ルートの確認が必要。",
    dealType: "その他", dealNote: "", stage: 1, ownerId: "u2", primaryContactId: "p4",
    members: ["u1", "u2"], unread: 0, seq: 1, tags: ["コスト重視"],
    contacts: [{ id: "p4", name: "鈴木 健", dept: "購買部", title: "購買部 課長", email: "suzuki@ndk-ind.co.jp", phone: "045-777-8888" }],
    tasks: [], messages: [], events: [], bookingLink: null,
    mails: [{ id: "e5", dir: "out", subject: "ご挨拶とサービスのご案内", excerpt: "先日名刺交換させていただきました。", at: "7/27 13:44", replied: true, from: "suzuki@ndk-ind.co.jp" }],
  },
  {
    id: "c4", name: "株式会社コードベース", deal: { on: false, status: "paused", memo: "", amount: "", days: 0 },
    docs: [], industry: "ITサービス / 受託開発", employees: 32,
    revenue: "3.8億円（2025）", address: "福岡県福岡市博多区2-4", web: "codebase.dev",
    comment: "", dealType: "デザイン", dealNote: "コーポレートサイトのリニューアル",
    stage: 0, ownerId: "u1", primaryContactId: "p5", members: ["u1"], unread: 0, seq: 0, tags: [],
    contacts: [{ id: "p5", name: "山本 涼", dept: "システム開発部", title: "システム開発 主任", email: "yamamoto@codebase.dev", phone: "092-555-1212" }],
    tasks: [], messages: [], mails: [],
  },
  {
    id: "c5", name: "みなと物流株式会社", deal: { on: true, status: "working", memo: "倉庫管理システムの要件定義中。現場ヒアリングは完了。", amount: "620万", days: 2 },
    docs: [{ id: "f6", name: "現場ヒアリング_議事録.docx", kind: "spec", size: "64 KB", at: "2026/08/01", by: "u2", pinned: false, note: "" }], industry: "物流 / 運送", employees: 340,
    revenue: "62億円（2025）", address: "福岡県北九州市門司区1-8", web: "minato-log.co.jp",
    comment: "倉庫管理の効率化に関心あり。決裁は本部長まで。",
    dealType: "システム開発", dealNote: "倉庫管理システムの刷新",
    stage: 1, ownerId: "u2", primaryContactId: "p6", members: ["u1", "u2"], unread: 0, seq: 4, tags: ["紹介あり"],
    contacts: [{ id: "p6", name: "岡田 修", dept: "物流本部", title: "物流本部 部長", email: "okada@minato-log.co.jp", phone: "093-222-1111" }],
    tasks: [{ id: "t5", title: "現場ヒアリングの日程調整", due: "2026-08-11T14:00", assignee: "u2", contactId: "p6", pri: "中", done: false, share: "team", subs: [] }],
    messages: [], mails: [], events: [], bookingLink: null,
  },
  {
    id: "c6", name: "株式会社ハレルヤ製菓", deal: { on: true, status: "review", memo: "SNSプロモの企画書を提出して確認待ち。先方の社内会議が来週。", amount: "月30万", days: 9 },
    docs: [], industry: "食品 / 飲料", employees: 95,
    revenue: "14億円（2025）", address: "福岡県久留米市3-2", web: "hallelujah-s.jp",
    comment: "新商品のプロモーションを検討中。予算は秋以降。",
    dealType: "マーケティング", dealNote: "新商品のSNSプロモーション設計",
    stage: 0, ownerId: "u5", primaryContactId: "p7", members: ["u1", "u5"], unread: 0, seq: 5, tags: ["展示会2026"],
    contacts: [{ id: "p7", name: "白石 みなみ", dept: "商品企画部", title: "商品企画部 課長", email: "shiraishi@hallelujah-s.jp", phone: "0942-33-4455" }],
    tasks: [], messages: [], mails: [], events: [], bookingLink: null,
  },
  {
    id: "c7", name: "西日本メディカル株式会社", deal: { on: true, status: "proposal", memo: "セキュリティ要件を整理中。個人情報の扱いに厳しいので慎重に。", amount: "450万", days: 3 },
    docs: [{ id: "f7", name: "秘密保持契約書.pdf", kind: "contract", size: "880 KB", at: "2026/07/10", by: "u1", pinned: true, note: "" }], industry: "医療 / クリニック", employees: 210,
    revenue: "38億円（2025）", address: "広島県広島市中区2-5", web: "nishinihon-med.jp",
    comment: "予約システムの入れ替えを検討。個人情報の扱いに厳しい。",
    dealType: "Web制作", dealNote: "患者向け予約サイトの再構築",
    stage: 2, ownerId: "u1", primaryContactId: "p8", members: ["u1", "u4"], unread: 1, seq: 6, tags: ["年内受注"],
    contacts: [{ id: "p8", name: "藤原 敬三", dept: "経営企画室", title: "常務取締役", email: "fujiwara@nishinihon-med.jp", phone: "082-555-6677" }],
    tasks: [{ id: "t6", title: "セキュリティ要件の確認", due: "2026-08-09T09:30", assignee: "u4", contactId: "p8", pri: "高", done: false, share: "assignee", subs: [] }],
    messages: [{ id: "m7", by: "u1", text: "個人情報まわりの資料を先に送っておきます", at: "8/2 14:10" }],
    mails: [], events: [], bookingLink: null,
  },
  {
    id: "c8", name: "アトリエ木もれ日", deal: { on: true, status: "paused", memo: "予算確保が来期になるとのことで一旦ストップ。1月に再連絡。", amount: "120万", days: 24 },
    docs: [], industry: "デザイン / クリエイティブ", employees: 12,
    revenue: "1.2億円（2025）", address: "福岡県福岡市中央区6-1", web: "komorebi.design",
    comment: "小規模だが単価は高め。紹介が期待できる。",
    dealType: "デザイン", dealNote: "ブランドリニューアル一式",
    stage: 3, ownerId: "u3", primaryContactId: "p9", members: ["u1", "u3"], unread: 0, seq: 7, tags: [],
    contacts: [{ id: "p9", name: "近藤 彩", dept: "代表", title: "代表", email: "kondo@komorebi.design", phone: "092-777-3300" }],
    tasks: [], messages: [], mails: [], events: [], bookingLink: null,
  },
  {
    id: "c9", name: "九州建機リース株式会社", deal: { on: false, status: "talking", memo: "", amount: "", days: 0 },
    docs: [], industry: "建設 / 工事", employees: 480,
    revenue: "105億円（2025）", address: "福岡県北九州市小倉南区4-9", web: "kyushu-kenki.co.jp",
    comment: "現場からの要望で動いている。決裁ルートの確認が必要。",
    dealType: "コンサルティング", dealNote: "在庫管理業務の見直し",
    stage: 1, ownerId: "u2", primaryContactId: "p10", members: ["u1", "u2"], unread: 0, seq: 8, tags: ["コスト重視"],
    contacts: [{ id: "p10", name: "永田 隆之", dept: "管理本部", title: "管理本部 本部長", email: "nagata@kyushu-kenki.co.jp", phone: "093-451-7788" }],
    tasks: [], messages: [], mails: [], events: [], bookingLink: null,
  },
];

const scanQueue = [
  { name: "中村 隆志", company: "オーシャンロジ株式会社", dept: "営業統括本部", title: "常務取締役",
    email: "nakamura@ocean-logi.co.jp", phone: "093-321-4400", industry: "物流 / 運送",
    employees: 640, revenue: "150億円（2025）", address: "福岡県北九州市小倉北区3-1", web: "ocean-logi.co.jp" },
  { name: "森本 亜衣", company: "株式会社アルテック", dept: "情報システム部", title: "情報システム部 課長",
    email: "morimoto2@artech.co.jp", phone: "03-1234-5680", industry: "SaaS / 業務システム",
    employees: 520, revenue: "80億円（2025）", address: "東京都港区赤坂1-2-3", web: "artech.co.jp" },
  { name: "小林 早苗", company: "みらいクリニック", dept: "事務局", title: "事務長",
    email: "kobayashi@mirai-clinic.jp", phone: "092-888-2200", industry: "医療 / クリニック",
    employees: 24, revenue: "非公開", address: "福岡県福岡市中央区5-6", web: "mirai-clinic.jp" },
];

/* ══════════════ 部品 ══════════════ */
/* ══════════════════════════════════════════════
   SYNCLE Design System
   ══════════════════════════════════════════════ */

const C = {
  purple: "#8851D8", blue: "#3E86ED", green: "#2A9D67", lime: "#A5D99E",
  red: "#EA392B", pink: "#F58BB4", yellow: "#F9C22E", orange: "#F2811D",
  ink: "#141414", bg: "#FDFAF4", line: "#EDE7DC",
};
const SOFT = {
  purple: "#EFE6FC", blue: "#E2EDFD", green: "#DDF0E6", lime: "#EDF7EA",
  red: "#FCE3E0", pink: "#FDE8F1", yellow: "#FEF3D6", orange: "#FDEADB",
};

/* ── 形（viewBox 0 0 100 100） ── */
const SHAPES = {
  flower: "M50 4c8 0 13 7 13 15 6-5 15-5 20 1s5 15-1 20c8 0 15 5 15 13s-7 13-15 13c6 5 6 14 1 20s-14 6-20 1c0 8-5 15-13 15s-13-7-13-15c-5 5-14 5-20-1s-6-14-1-20C8 66 1 61 1 53s7-13 15-13c-6-5-6-14 0-20s15-6 20-1c0-8 6-15 14-15z",
  clover: "M50 12c9-11 27-8 30 5s-8 22-19 22c11 0 22 9 20 21s-19 17-27 8c3 11-5 22-17 22s-20-11-17-22c-8 9-25 4-27-8s9-21 20-21C2 39-8 24 0 13S26 1 35 12c4-5 11-5 15 0z",
  sun: "M50 0l9 12 14-7 3 15 15 1-6 14 12 10-12 10 6 14-15 1-3 15-14-7-9 12-9-12-14 7-3-15-15-1 6-14L0 45l12-10-6-14 15-1 3-15 14 7z",
  blob: "M78 12c12 9 20 26 17 41s-17 27-32 32S31 89 20 78 2 50 6 35 24 8 40 5s26-2 38 7z",
  burst: "M50 2l8 16 17-9-4 19 19 3-13 14 15 12-19 6 6 19-19-3-3 19-14-13-14 13-3-19-19 3 6-19-19-6 15-12L-4 31l19-3-4-19 17 9z",
  wave: "M10 22c14-9 24 6 40 0s26-11 40 0v52c-14 11-24-4-40 2s-26 7-40 0z",
  hex: "M50 3c4 0 39 18 42 22s3 46 0 50-38 22-42 22-39-18-42-22-3-46 0-50S46 3 50 3z",
  arch: "M50 4c26 0 46 20 46 46v34c0 7-5 12-12 12H16c-7 0-12-5-12-12V50C4 24 24 4 50 4z",
  cloud: "M28 78C13 78 2 68 2 55s11-23 25-23c3-15 16-26 32-26 17 0 31 12 33 28 6 3 10 10 10 18 0 15-11 26-26 26z",
  drop: "M50 2c14 20 34 32 34 52 0 21-15 36-34 36S16 75 16 54C16 34 36 22 50 2z",
  stamp: "M50 3l11 8 13-3 5 13 13 6-3 13 8 11-8 11 3 13-13 6-5 13-13-3-11 8-11-8-13 3-5-13-13-6 3-13-8-11 8-11-3-13 13-6 5-13 13 3z",
  square: "M22 6h56c9 0 16 7 16 16v56c0 9-7 16-16 16H22c-9 0-16-7-16-16V22C6 13 13 6 22 6z",
};

/* 顔（目＋口） */
const Face = ({ scale = 1, wink }) => (
  <g transform={`translate(50 56) scale(${scale}) translate(-50 -56)`}>
    <ellipse cx="41" cy="50" rx="4" ry="5.4" fill={C.ink} />
    {wink
      ? <path d="M54 50c2-3 6-3 8 0" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      : <ellipse cx="59" cy="50" rx="4" ry="5.4" fill={C.ink} />}
    <path d="M43 62c4 5 11 5 15 0" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
  </g>
);

/* 形＋色＋任意の顔／文字 */
const ShapeIcon = ({ shape = "blob", color = "purple", size = 44, face, wink, label, glyph, className = "", style }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 ${className}`} style={style} aria-hidden="true">
    <path d={SHAPES[shape] || SHAPES.blob} fill={C[color] || color} />
    {face && <Face scale={0.92} wink={wink} />}
    {label && (
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize="42" fontWeight="800" fill="#fff" fontFamily="M PLUS Rounded 1c, Zen Maru Gothic, sans-serif">{label}</text>
    )}
    {glyph}
  </svg>
);

/* SYNCLEブランドシンボル（6色のパーツが輪になる） */
const SyncleMark = ({ size = 32 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" aria-hidden="true">
    <circle cx="50" cy="20" r="17" fill={C.red} />
    <circle cx="76" cy="35" r="17" fill={C.yellow} />
    <circle cx="76" cy="65" r="17" fill={C.green} />
    <circle cx="50" cy="80" r="17" fill={C.blue} />
    <circle cx="24" cy="65" r="17" fill={C.purple} />
    <circle cx="24" cy="35" r="17" fill={C.pink} />
    <circle cx="50" cy="50" r="16" fill="#fff" />
  </svg>
);

/* ── 有機的なボタン ── */
const OrganicButton = ({ children, onClick, color = "purple", variant = "solid", size = "md", shape = "wave", disabled, className = "" }) => {
  const pad = size === "sm" ? "px-3.5 py-2 text-xs" : size === "lg" ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm";
  const radius = { wave: "22px 14px 22px 14px", pill: "999px", stamp: "18px 6px 18px 6px", arch: "999px 999px 14px 14px" }[shape] || "999px";
  const solid = variant === "solid";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${pad} font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 ${className}`}
      style={{
        borderRadius: radius,
        background: solid ? C[color] : "#fff",
        color: solid ? "#fff" : C[color],
        border: solid ? "none" : `2.5px solid ${C[color]}`,
        boxShadow: solid ? `0 3px 0 0 ${C[color]}44` : "none",
      }}>
      {children}
    </button>
  );
};

/* ── バッジ類 ── */
const TIER_SHAPE = { A: { c: "purple", s: "stamp" }, B: { c: "blue", s: "wave" }, C: { c: "green", s: "blob" } };
const TierChip = ({ tier, small }) => {
  const t = TIER_SHAPE[tier] || TIER_SHAPE.C;
  return (
    <span className={`inline-flex items-center font-bold shrink-0 ${small ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
      style={{ background: SOFT[t.c], color: C[t.c], borderRadius: t.s === "stamp" ? "12px 5px 12px 5px" : t.s === "wave" ? "14px 8px 14px 8px" : "999px" }}>
      {small ? tier : `Tier ${tier}`}
    </span>
  );
};

const DEAL_TONE = {
  "マーケティング": "pink", "デザイン": "red", "Web制作": "blue",
  "システム開発": "purple", "コンサルティング": "yellow", "その他": "green",
};
const DealChip = ({ type }) => {
  const c = DEAL_TONE[type] || "green";
  return (
    <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 shrink-0"
      style={{ background: SOFT[c], color: c === "yellow" ? "#9A6B00" : C[c], borderRadius: "14px 7px 14px 7px" }}>
      {type}
    </span>
  );
};

const PRI_SHAPE = { "高": { c: "red", s: "burst" }, "中": { c: "orange", s: "square" }, "低": { c: "blue", s: "blob" } };
const PriorityBadge = ({ pri, size = 34 }) => {
  const d = PRI_SHAPE[pri] || PRI_SHAPE["中"];
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <ShapeIcon shape={d.s} color={d.c} size={size} />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{pri}</span>
    </span>
  );
};

const MemberDot = ({ id, size = 26 }) => {
  const u = user(id);
  const cols = ["purple", "green", "pink", "orange", "blue", "red", "yellow"];
  const col = (u.av && u.av.color) || cols[(TEAM.findIndex((x) => x.id === id) + 7) % cols.length];

  // 写真を登録している場合
  if (u.av && u.av.kind === "photo" && u.av.src) {
    return (
      <span className="relative inline-flex shrink-0 rounded-full border-[2.5px] border-white overflow-hidden"
        style={{ width: size, height: size }} title={u.name}>
        <img src={u.av.src} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  // 形のシンボルを選んでいる場合
  if (u.av && u.av.kind === "shape") {
    return (
      <span className="relative inline-flex items-center justify-center shrink-0 rounded-full border-[2.5px] border-white overflow-hidden"
        style={{ width: size, height: size, background: SOFT[col] || "#EEE" }} title={u.name}>
        <ShapeIcon shape={u.av.shape} color={col} size={Math.round(size * 0.72)} />
      </span>
    );
  }
  return (
    <span className="relative inline-flex items-center justify-center shrink-0 rounded-full border-[2.5px] border-white"
      style={{ width: size, height: size, background: C[col] }} title={u.name}>
      <span className="font-bold text-white" style={{ fontSize: size * 0.42 }}>{u.name.charAt(0)}</span>
    </span>
  );
};

/* 会社アバター：業種で形と色が変わる */
const INDUSTRY_ART = [
  [/SaaS|システム|IT|通信|開発/, "hex", "purple"],
  [/広告|マーケ|メディア|エンタメ|出版/, "flower", "pink"],
  [/デザイン|クリエイティブ/, "blob", "red"],
  [/コンサル|会計|法律|士業|金融|保険/, "sun", "yellow"],
  [/食品|飲料|飲食|農林/, "clover", "green"],
  [/製造|建設|物流|運送|卸売|商社/, "stamp", "blue"],
  [/医療|介護|教育|美容|旅行/, "drop", "orange"],
];
const companyArt = (co) => {
  const key = `${co.industry || ""} ${co.dealType || ""}`;
  const hit = INDUSTRY_ART.find(([re]) => re.test(key));
  if (hit) return { shape: hit[1], color: hit[2] };
  const cols = ["purple", "green", "blue", "orange", "pink"];
  const shapes = ["hex", "clover", "blob", "sun", "flower"];
  const i = (co.name || "").length % 5;
  return { shape: shapes[i], color: cols[i] };
};
const CompanyAvatar = ({ co, size = 52 }) => {
  const a = companyArt(co);
  const initial = (co.name || "").replace(/株式会社|有限会社|合同会社/g, "").trim().charAt(0);
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <ShapeIcon shape={a.shape} color={a.color} size={size} />
      <span className="absolute font-bold text-white" style={{ fontSize: size * 0.36 }}>{initial}</span>
    </span>
  );
};

/* 機能アイコン（ナビ・アクション共通） */
const FEATURE = {
  customers: { shape: "flower", color: "purple", face: true },
  channels: { shape: "flower", color: "pink", face: true, glyph: "#" },
  scan: { shape: "clover", color: "green", face: true },
  mail: { shape: "square", color: "blue", face: true, wink: true },
  tasks: { shape: "sun", color: "yellow", face: true },
  roadmap: { shape: "burst", color: "orange", face: true },
  calendar: { shape: "arch", color: "green" },
  timeline: { shape: "wave", color: "blue" },
  ai: { shape: "burst", color: "purple" },
  company: { shape: "hex", color: "purple" },
  contact: { shape: "blob", color: "orange" },
  meeting: { shape: "drop", color: "purple" },
  note: { shape: "cloud", color: "blue" },
};
const FeatureIcon = ({ name, size = 44, plain }) => {
  const f = FEATURE[name] || FEATURE.company;
  return <ShapeIcon shape={f.shape} color={f.color} size={size} face={!plain && f.face} wink={f.wink} />;
};

const QuickInfo = ({ shape, color, label, value }) => (
  <div className="bg-white p-3" style={{ borderRadius: "22px 14px 22px 14px", border: `2px solid ${C.line}` }}>
    <ShapeIcon shape={shape} color={color} size={36} />
    <div className="text-sm text-slate-400 mt-2.5">{label}</div>
    <div className="text-base font-bold truncate">{value}</div>
  </div>
);

const CountUp = ({ value, duration = 750 }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start = null;
    const step = (t) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n}</>;
};

const Field = ({ label, children }) => (
  <div className="flex items-start gap-3 px-3 py-2 border-b border-slate-100">
    <span className="text-sm text-slate-500 w-20 shrink-0 pt-1.5">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DECK_STEP = 148;

const inputCls = "w-full text-sm bg-transparent outline-none focus:bg-slate-50 rounded px-1 py-1 min-w-0";

/* ══════════════ カレンダー ══════════════ */
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const BASE = new Date(2026, 7, 3);
const fmtDay = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const fmtHour = (h) => `${Math.floor(h)}:${h % 1 ? "30" : "00"}`;

const seedCalendars = [
  { id: "cal1", name: "仕事用", email: "shimizu@nico-inc.net", enabled: true, color: "bg-blue-500" },
  { id: "cal2", name: "個人用", email: "shimizu.private@gmail.com", enabled: true, color: "bg-emerald-500" },
  { id: "cal3", name: "チーム共有", email: "team@nico-inc.net", enabled: false, color: "bg-violet-500" },
];
/* [カレンダーID, 日付, 開始, 終了, 予定名] */
const BUSY = [
  ["cal1", "8/3", 10, 12, "全社定例"], ["cal1", "8/3", 15, 16.5, "アルテック様 打合せ"],
  ["cal1", "8/4", 13, 15, "採用面談"], ["cal1", "8/5", 10, 11, "1on1"],
  ["cal1", "8/6", 14, 17, "グロースワークス様 訪問"], ["cal1", "8/7", 11, 12, "経理MTG"],
  ["cal1", "8/10", 13, 14, "定例"], ["cal1", "8/12", 10, 12, "社内研修"],
  ["cal2", "8/5", 17, 19, "歯医者"], ["cal2", "8/7", 16, 18, "家族の用事"],
  ["cal2", "8/11", 10, 13, "私用"],
  ["cal3", "8/4", 10, 11, "チーム朝会"], ["cal3", "8/6", 10, 11, "チーム朝会"],
  ["cal3", "8/11", 10, 11, "チーム朝会"],
];

function buildSlots(days, duration, calendars) {
  const on = calendars.filter((c) => c.enabled).map((c) => c.id);
  const busy = BUSY.filter((b) => on.includes(b[0]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(BASE);
    d.setDate(BASE.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const label = fmtDay(d);
    const slots = [];
    const len = duration / 60;
    for (let h = 10; h + len <= 18.001; h += 0.5) {
      if (h < 13 && h + len > 12) continue;
      const clash = busy.some((b) => b[1] === label && h < b[3] && h + len > b[2]);
      if (!clash) slots.push({ key: `${label}-${h}`, day: label, iso: toISO(d), wd: WD[d.getDay()], start: h, end: h + len });
    }
    if (slots.length) out.push({ day: label, wd: WD[d.getDay()], slots });
  }
  return out;
}

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (n) => { const d = new Date(BASE); d.setDate(BASE.getDate() + n); return toISO(d); };
const dPart = (v) => (v ? String(v).split("T")[0] : "");
const tPart = (v) => (v && String(v).includes("T") ? String(v).split("T")[1].slice(0, 5) : "");
const fmtDue = (v) => {
  if (!v) return "未定";
  const d = fromISO(dPart(v));
  const t = tPart(v);
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${t ? ` ${t}` : ""}`;
};
const fmtAt = (v) => {
  if (!v) return "";
  const [dpart, tpart] = v.split("T");
  const d = fromISO(dpart);
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${tpart || ""}`.trim();
};
const atDate = (v) => dPart(v);

const AGO = (at) => {
  if (!at || at === "たった今") return "たった今";
  return at;
};

const SHARE = {
  self:     { label: "自分だけ", cal: "自分のカレンダー", color: "blue",   icon: "blob" },
  assignee: { label: "担当者",   cal: "担当者のカレンダー", color: "green", icon: "clover" },
  team:     { label: "チーム全員", cal: "チーム共有カレンダー", color: "purple", icon: "flower" },
};

/* ══════════════ ロードマップ（部署 × 月 × 議題） ══════════════ */
const DEPTS = [
  { id: "all", name: "全社", shape: "burst", color: "purple" },
  { id: "sales", name: "営業", shape: "flower", color: "red" },
  { id: "is", name: "インサイドセールス", shape: "sun", color: "yellow" },
  { id: "cs", name: "カスタマーサクセス", shape: "clover", color: "green" },
  { id: "dev", name: "開発", shape: "hex", color: "blue" },
];
const RM_MONTHS = ["7月", "8月", "9月", "10月", "11月", "12月"];
const RM_CURRENT = 1;
const mk = (i) => 7 + i;
const AGENDA_STATE = {
  decided: { label: "決定済み", color: "green" },
  talking: { label: "話し合い中", color: "orange" },
  todo:    { label: "これから話す", color: "blue" },
};

/* 登録した相手以外から届いたメール（取り込まれない例） */
const OUTSIDERS = [
  { id: "x1", from: "news@marketing-weekly.jp", subject: "【PR】今週の営業DXセミナーのご案内", at: "8/2 09:14" },
  { id: "x2", from: "no-reply@cloud-invoice.com", subject: "請求書が発行されました", at: "8/1 18:02" },
  { id: "x3", from: "info@expo-kyushu.jp", subject: "出展社募集のお知らせ", at: "8/1 10:30" },
];

/* ワークスペース（アドレスごとに所属が決まる） */
const WORKSPACES = [
  { id: "w1", name: "株式会社ニコ", slug: "nico", color: "purple", shape: "flower", members: 5,
    domain: "nico-inc.net", openJoin: true,
    emails: ["shimizu@nico-inc.net", "sasaki@nico-inc.net", "inoue@nico-inc.net", "onishi@nico-inc.net", "mori@nico-inc.net"] },
  { id: "w2", name: "ニコ・パートナーズ", slug: "nico-partners", color: "green", shape: "clover", members: 2,
    domain: "nico-inc.net", openJoin: false,
    emails: ["shimizu@nico-inc.net"] },
];
const slugify = (v) => (v || "").trim().toLowerCase()
  .replace(/株式会社|有限会社|合同会社/g, "").replace(/[^a-z0-9ぁ-んァ-ン一-龥]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 20) || "workspace";

const seedAgenda = {
  sales: {
    7: [{ id: "s71", title: "北九州エリアをどう攻めるか", state: "decided", who: ["u1", "u2"],
      decision: "商工会議所の名簿を起点に、まず20社に接触する", when: "7/3 に決定",
      next: [{ t: "名簿を整理する", who: "u1", done: true }, { t: "20社へ初回接触", who: "u2", done: true }] }],
    8: [
      { id: "s81", title: "紹介をどう仕組みにするか", state: "decided", who: ["u1", "u2", "u3"],
        decision: "定例のタイミングで既存客に必ず一言聞く。特典は次回で詰める", when: "8/1 に決定",
        next: [{ t: "依頼フローを文章にする", who: "u1", done: true }, { t: "CS定例に組み込む", who: "u3", done: false }] },
      { id: "s82", title: "紹介特典をどうするか", state: "talking", who: ["u1", "u2"],
        decision: "", when: "8/12（火）14:00 に話す",
        next: [{ t: "他社事例を3つ調べる", who: "u2", done: false }] },
      { id: "s83", title: "Tier A への提案順序", state: "todo", who: ["u2"], decision: "", when: "日程未定", next: [] },
    ],
    9: [{ id: "s91", title: "失注理由をどう振り返るか", state: "todo", who: ["u1", "u2"], decision: "", when: "9月上旬", next: [] }],
    10: [], 11: [], 12: [],
  },
  is: {
    7: [{ id: "i71", title: "問い合わせ対応の型を決める", state: "decided", who: ["u5", "u1"],
      decision: "24時間以内の一次返信をルールにする", when: "7/10 に決定",
      next: [{ t: "テンプレを3種作る", who: "u5", done: true }] }],
    8: [
      { id: "i81", title: "架電スクリプトを見直すか", state: "decided", who: ["u5", "u2"],
        decision: "冒頭30秒を用件先出しに変える", when: "8/4 に決定",
        next: [{ t: "新スクリプトで1週間試す", who: "u5", done: true }, { t: "結果を共有", who: "u5", done: false }] },
      { id: "i82", title: "展示会リードの分担", state: "talking", who: ["u5", "u2", "u1"], decision: "", when: "8/14（木）11:00 に話す", next: [] },
    ],
    9: [], 10: [], 11: [], 12: [],
  },
  cs: {
    7: [{ id: "c71", title: "既存客の状況をどう共有するか", state: "decided", who: ["u3", "u1"],
      decision: "月初にCSから一覧を出して営業と共有する", when: "7/5 に決定", next: [] }],
    8: [{ id: "c81", title: "解約リスク3社への対応", state: "talking", who: ["u3", "u1", "u2"],
      decision: "", when: "8/8（金）16:00 に話す",
      next: [{ t: "3社の利用状況をまとめる", who: "u3", done: true }] }],
    9: [], 10: [], 11: [], 12: [],
  },
  dev: {
    7: [{ id: "d71", title: "見積作成をどこまで自動化するか", state: "decided", who: ["u4", "u1"],
      decision: "テンプレ自動生成まで。単価判断は人が行う", when: "7/18 に決定", next: [] }],
    8: [{ id: "d81", title: "API連携の要件をどこまで受けるか", state: "talking", who: ["u4", "u1", "u2"],
      decision: "", when: "8/7（木）14:00 に話す",
      next: [{ t: "現行バージョンの制約を調べる", who: "u4", done: true }] }],
    9: [], 10: [], 11: [], 12: [],
  },
};

/* 案件の状況（日数のしきい値つき） */
const DEAL_STATUS = {
  talking:  { label: "商談中",     color: "orange", shape: "sun",    limit: 7 },
  proposal: { label: "提案準備中", color: "purple", shape: "flower", limit: 5 },
  quote:    { label: "見積提出済", color: "blue",   shape: "hex",    limit: 7 },
  working:  { label: "制作進行中", color: "green",  shape: "clover", limit: 10 },
  review:   { label: "確認待ち",   color: "pink",   shape: "drop",   limit: 5 },
  paused:   { label: "保留",       color: "lime",   shape: "blob",   limit: 30 },
};
const dealHeat = (d, st) => {
  const lim = (DEAL_STATUS[st] || DEAL_STATUS.talking).limit;
  if (d >= lim * 2) return { c: "#EA392B", t: "止まっています" };
  if (d >= lim) return { c: "#F2811D", t: "動きがありません" };
  return null;
};

/* 書類の種類 */
const DOC_KINDS = {
  contract: { label: "契約書", color: "red", shape: "stamp" },
  quote:    { label: "見積書", color: "orange", shape: "square" },
  proposal: { label: "提案書", color: "purple", shape: "flower" },
  invoice:  { label: "請求書", color: "green", shape: "clover" },
  spec:     { label: "仕様・資料", color: "blue", shape: "hex" },
  other:    { label: "その他", color: "lime", shape: "blob" },
};
const EXT_COLOR = { pdf: "red", xlsx: "green", docx: "blue", pptx: "orange", png: "pink", jpg: "pink", zip: "lime" };
const fileExt = (n) => (String(n).split(".").pop() || "").toLowerCase();

const PRI_DOT = { "高": "bg-rose-500", "中": "bg-indigo-500", "低": "bg-slate-300" };

const slotText = (s) => `${s.day}（${s.wd}）${fmtHour(s.start)}〜${fmtHour(s.end)}`;
const randLetters = (n) => Array.from({ length: n }, () => "abcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 25)]).join("");
const makeMeetLink = () => `https://meet.google.com/${randLetters(3)}-${randLetters(4)}-${randLetters(3)}`;
const makeZoomLink = () => `https://zoom.us/j/${Math.floor(10000000000 + Math.random() * 89999999999)}`;

/* ══════════════ 本体 ══════════════ */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [authStep, setAuthStep] = useState("welcome"); // welcome | signin | code | invited | setup
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState(["", "", "", "", "", ""]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [setupForm, setSetupForm] = useState({ company: "", slug: "", name: "", role: "代表", avShape: "flower", avColor: "purple" });
  const [authMode, setAuthMode] = useState("signin");   // signin | create
  const [workspace, setWorkspace] = useState(WORKSPACES[0]);
  const [foundWs, setFoundWs] = useState([]);
  const [sameDomainWs, setSameDomainWs] = useState([]);
  const [requested, setRequested] = useState([]);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [bioLock, setBioLock] = useState(true);
  const [locked, setLocked] = useState(false);
  const [companies, setCompanies] = useState(seed);
  const [stages, setStages] = useState(["初回接触", "ヒアリング", "提案", "見積", "受注"]);
  const [taskScope, setTaskScope] = useState("company");
  const [screen, setScreen] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("info");
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [dealFilter, setDealFilter] = useState("all");
  const [sortBy, setSortBy] = useState("new");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [custView, setCustView] = useState("companies");  // companies | deals
  const [dealFilterS, setDealFilterS] = useState("all");
  const [dealSort, setDealSort] = useState("stalled");
  const [dealSheet, setDealSheet] = useState(null);
  const [docSheet, setDocSheet] = useState(null);
  const [docFilter, setDocFilter] = useState("all");
  const [deckP, setDeckP] = useState(0);
  const deckRef = useRef(null);
  const [scanPhase, setScanPhase] = useState("ready");
  const [draft, setDraft] = useState(null);
  const [step, setStep] = useState(1);
  const [gmail, setGmail] = useState({ connected: false, address: "", lastSync: null, syncing: false });
  const [toast, setToast] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [queueIdx, setQueueIdx] = useState(0);
  const [inviteFor, setInviteFor] = useState(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [seqCounter, setSeqCounter] = useState(10);
  const [mail, setMail] = useState(null);
  const [gcal, setGcal] = useState({ connected: false, syncing: false });
  const [calendars, setCalendars] = useState(seedCalendars);
  const [meet, setMeet] = useState(null);
  const [taskView, setTaskView] = useState("list");
  const [taskForm, setTaskForm] = useState(null);
  const [calCursor, setCalCursor] = useState({ y: 2026, m: 7 });
  const [calPick, setCalPick] = useState(toISO(BASE));
  const [calScope, setCalScope] = useState("all");
  const [personal, setPersonal] = useState([
    { id: "pt1", title: "経費精算を出す", due: addDays(2), assignee: ME, pri: "低", done: false, subs: [] },
    { id: "pt2", title: "展示会の名刺をまとめて登録", due: addDays(5), assignee: ME, pri: "中", done: false,
      subs: [{ id: "ps1", text: "写真を撮る", at: "2026-08-06T09:00", done: false },
             { id: "ps2", text: "重複を確認する", at: "", done: false }] },
  ]);
  const [team, setTeam] = useState(SEED_TEAM);
  const [groups, setGroups] = useState([
    { id: "g1", name: "営業チーム", shape: "burst", color: "red", members: ["u1", "u2", "u5"], unread: 1,
      messages: [
        { id: "gm1", system: true, text: "チャンネルを作成しました", at: "7/25" },
        { id: "gm2", by: "u2", text: "今週の商談まとめ、金曜までに共有します", at: "8/1 09:12" },
        { id: "gm3", by: "u1", text: "@佐々木 拓 助かります。Tier Aだけでいいよ", at: "8/1 09:30" },
      ] },
    { id: "g2", name: "雑談", shape: "cloud", color: "blue", members: ["u1", "u3", "u4"], unread: 0,
      messages: [{ id: "gm4", by: "u4", text: "近くに新しいコーヒー屋できてました", at: "7/31 12:40" }] },
  ]);
  const [dms, setDms] = useState([
    { id: "d1", with: "u2", unread: 2, messages: [
      { id: "dm1", by: "u2", text: "アルテックの件、明日の打合せ資料できました", at: "8/2 17:40" },
      { id: "dm2", by: "u1", text: "ありがとう。あとで見ます", at: "8/2 18:02" },
      { id: "dm3", by: "u2", text: "あと紹介特典の他社事例、3つ調べたので月曜に共有しますね", at: "8/2 18:15" },
    ] },
    { id: "d2", with: "u4", unread: 0, messages: [
      { id: "dm4", by: "u4", text: "API連携の調査、現行だと工数2倍くらい見たほうがいいです", at: "8/2 09:20" },
      { id: "dm5", by: "u1", text: "了解。7日のヒアリングで先方に確認しよう", at: "8/2 09:44" },
    ] },
    { id: "d3", with: "u3", unread: 0, messages: [] },
  ]);
  const [activeDm, setActiveDm] = useState(null);
  const [chTab, setChTab] = useState("dm");
  const [groupForm, setGroupForm] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("営業");
  const [inviteCh, setInviteCh] = useState([]);
  const [pending, setPending] = useState([
    { id: "r1", name: "newbie", email: "newbie@nico-inc.net", at: "8/2 16:20", via: "同じドメイン" },
  ]);
  const [inviteLink, setInviteLink] = useState(null);
  const [tlFilter, setTlFilter] = useState("all");
  const [noteInput, setNoteInput] = useState("");
  const [memos, setMemos] = useState([
    { id: "n1", text: "アルテックの田中CEO、来期の予算は9月に確定するとのこと。8月中に提案を固めておく。", color: "yellow", pinned: true, at: "8/2" },
    { id: "n2", text: "展示会で配る資料、事例を3つに絞る\n・製造\n・物流\n・医療", color: "pink", pinned: false, at: "8/1" },
    { id: "n3", text: "見積テンプレの単価表、7月改定分に差し替える", color: "blue", pinned: false, at: "7/30" },
    { id: "n4", text: "紹介経由の商談は受注率が高い。既存客への紹介依頼を仕組みにできないか。", color: "green", pinned: false, at: "7/28" },
  ]);
  const [memoDraft, setMemoDraft] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [acct, setAcct] = useState({
    name: SEED_TEAM[0].name, role: SEED_TEAM[0].role, note: SEED_TEAM[0].note || "",
    av: SEED_TEAM[0].av, cover: SEED_TEAM[0].cover,
  });
  const [mailFilter, setMailFilter] = useState("all");
  const [mailScope, setMailScope] = useState("registered");
  const [mailOff, setMailOff] = useState([]);  // 取り込まない相手  // registered | domain | all
  const [agenda, setAgenda] = useState(seedAgenda);
  const [rmDept, setRmDept] = useState("all");
  const [rmMi, setRmMi] = useState(RM_CURRENT);
  const [rmView, setRmView] = useState("agenda");
  const [rmSheet, setRmSheet] = useState(null);
  const [rmForm, setRmForm] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [subInput, setSubInput] = useState({ text: "", at: "" });

  const tt = useRef(null);
  const notify = (m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2200); };
  useEffect(() => () => clearTimeout(tt.current), []);

  // 起動アニメーション（形が次々に変わってシンボルになる）
  useEffect(() => {
    if (!booting) return;
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { const t = setTimeout(() => setBooting(false), 400); return () => clearTimeout(t); }
    const step = setInterval(() => setBootStep((v) => (v < 6 ? v + 1 : v)), 260);
    const done = setTimeout(() => setBooting(false), 2500);
    return () => { clearInterval(step); clearTimeout(done); };
  }, [booting]);

  // すべてのボタンに共通の押し心地を与える
  const shellRef = useRef(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let held = null;

    const down = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      held = b;
      b.classList.remove("is-release");
      b.classList.add("is-press");

      // 押した位置から色が広がる
      const rect = shell.getBoundingClientRect();
      const cs = window.getComputedStyle(b);
      const bg = cs.backgroundColor;
      const solid = bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
      const dot = document.createElement("span");
      dot.className = "bloom";
      const size = Math.max(b.offsetWidth, b.offsetHeight) * 2.1;
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - rect.left}px`;
      dot.style.top = `${e.clientY - rect.top}px`;
      dot.style.background = solid ? bg : cs.color;
      shell.appendChild(dot);
      setTimeout(() => dot.remove(), 560);
    };

    const up = () => {
      if (!held) return;
      const b = held;
      held = null;
      b.classList.remove("is-press");
      b.classList.add("is-release");
      setTimeout(() => b.classList.remove("is-release"), 440);
    };

    shell.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      shell.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // 顧客デッキ：スクロール量をそのままカードの位置に変換する
  useEffect(() => {
    if (screen !== "list") return;
    const el = deckRef.current;
    if (!el) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; setDeckP(el.scrollTop / DECK_STEP); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    setDeckP(el.scrollTop / DECK_STEP);
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [screen]);

  // 検索・絞り込みを変えたら先頭に戻す
  useEffect(() => {
    if (deckRef.current) deckRef.current.scrollTop = 0;
    setDeckP(0);
  }, [query, tierFilter, industryFilter, dealFilter, sortBy]);

  TEAM = team;
  const active = companies.find((c) => c.id === activeId) || null;
  const withTier = useMemo(() => companies.map((c) => ({ ...c, ...companyTier(c) })), [companies]);
  const update = (id, fn) => setCompanies((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const setField = (id, k, v) => update(id, (c) => ({ ...c, [k]: v }));
  const primary = (co) => co.contacts.find((p) => p.id === co.primaryContactId) || co.contacts[0] || null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const r = withTier.filter((c) => {
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (industryFilter !== "all" && c.industry !== industryFilter) return false;
      if (dealFilter !== "all" && c.dealType !== dealFilter) return false;
      if (!q) return true;
      const names = c.contacts.map((p) => `${p.name} ${p.title} ${p.dept} ${p.email}`).join(" ");
      return [c.name, c.industry, c.dealType, c.dealNote, c.comment, names, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
    });
    const rank = { A: 0, B: 1, C: 2 };
    const sorters = {
      new: (a, b) => b.seq - a.seq, old: (a, b) => a.seq - b.seq,
      tier: (a, b) => rank[a.tier] - rank[b.tier] || b.seq - a.seq,
      stage: (a, b) => b.stage - a.stage, name: (a, b) => a.name.localeCompare(b.name, "ja"),
    };
    return [...r].sort(sorters[sortBy]);
  }, [withTier, query, tierFilter, industryFilter, dealFilter, sortBy]);

  const totalUnread = companies.reduce((n, c) => n + (c.unread || 0), 0);
  const unreadMail = (c) => (gmail.connected ? (c.mails || []).filter((m) => m.dir === "in" && !m.replied).length : 0);
  const totalUnreplied = gmail.connected ? companies.reduce((n, c) => n + unreadMail(c), 0) : 0;

  const open2 = (id, t = "info") => open(id, t);
  const open = (id, t = "info") => { setActiveId(id); setTab(t); setScreen("detail"); if (t === "chat") setField(id, "unread", 0); };
  const openChannel = (id) => { setActiveId(id); setScreen("channel"); setField(id, "unread", 0); };
  const pushSystem = (id, text) => update(id, (c) => ({ ...c, messages: [...c.messages, { id: nid(), system: true, text, at: "たった今" }] }));

  /* ── スキャン → 登録 ── */
  const startScan = () => {
    setScanPhase("scanning");
    setTimeout(() => {
      const s = scanQueue[queueIdx % scanQueue.length];
      const existing = companies.find((c) => c.name === s.company);
      setDraft({ ...s, existingId: existing?.id || null, dealType: "その他", dealNote: "", comment: "", makePrimary: !existing });
      setStep(1); setScanPhase("ready"); setScreen("result");
    }, 1300);
  };

  const startManual = () => {
    setDraft({
      manual: true, existingId: null,
      name: "", company: "", dept: "", title: "", email: "", phone: "",
      industry: INDUSTRIES[0], employees: 0, revenue: "", address: "", web: "",
      dealType: "その他", dealNote: "", comment: "", makePrimary: true,
    });
    setStep(1);
    setScreen("result");
  };

  const commitDraft = () => {
    if (!draft.company.trim()) { notify("会社名を入力してください"); return; }
    const contact = { id: nid(), name: draft.name.trim() || "担当者未登録", dept: draft.dept, title: draft.title, email: draft.email, phone: draft.phone };
    if (draft.existingId) {
      const target = draft.existingId;
      update(target, (c) => ({
        ...c, contacts: [...c.contacts, contact],
        primaryContactId: draft.makePrimary ? contact.id : c.primaryContactId,
        comment: draft.comment ? `${c.comment}\n${draft.comment}`.trim() : c.comment,
        messages: [...c.messages, { id: nid(), system: true, text: `${contact.name}（${contact.title}）を追加しました`, at: "たった今" }],
      }));
      notify("既存の会社に名刺を追加しました");
      setQueueIdx((i) => i + 1); setDraft(null); open(target, "contacts");
      return;
    }
    const id = nid();
    setCompanies((cs) => [{
      id, name: draft.company, industry: draft.industry, employees: draft.employees, revenue: draft.revenue,
      address: draft.address, web: draft.web, comment: draft.comment, dealType: draft.dealType, dealNote: draft.dealNote,
      stage: 0, ownerId: ME, primaryContactId: contact.id, members: [ME], unread: 0, seq: seqCounter, tags: [], contacts: [contact],
      tasks: [{ id: nid(), title: "初回フォローの連絡", due: addDays(3), assignee: ME, contactId: contact.id, pri: "高", done: false }],
      messages: [{ id: nid(), system: true, text: "チャンネルを作成しました", at: "たった今" }], mails: [],
    }, ...cs]);
    setSeqCounter((n) => n + 1); setQueueIdx((i) => i + 1); setDraft(null);
    notify("会社を登録しました"); open(id, "info");
  };

  /* ── Gmail ── */
  const connectGmail = () => {
    setGmail((g) => ({ ...g, syncing: true }));
    setTimeout(() => { setGmail({ connected: true, address: "shimizu@nico-inc.net", lastSync: "たった今", syncing: false }); notify("Google アカウントを連携しました"); }, 1100);
  };
  const resync = () => {
    setGmail((g) => ({ ...g, syncing: true }));
    setTimeout(() => { setGmail((g) => ({ ...g, syncing: false, lastSync: "たった今" })); notify("メールを同期しました"); }, 800);
  };

  const mutateTask = (cid, tid, fn) => {
    if (cid === "personal") setPersonal((ps) => ps.map((t) => (t.id === tid ? fn(t) : t)));
    else update(cid, (c) => ({ ...c, tasks: c.tasks.map((t) => (t.id === tid ? fn(t) : t)) }));
  };
  const toggleTask = (cid, tid) => mutateTask(cid, tid, (t) => ({ ...t, done: !t.done }));
  const toggleSub = (cid, tid, sid) => mutateTask(cid, tid, (t) => ({
    ...t, subs: (t.subs || []).map((x) => (x.id === sid ? { ...x, done: !x.done } : x)),
  }));
  const removeSub = (cid, tid, sid) => mutateTask(cid, tid, (t) => ({
    ...t, subs: (t.subs || []).filter((x) => x.id !== sid),
  }));
  const addSub = (cid, tid) => {
    if (!subInput.text.trim()) return;
    mutateTask(cid, tid, (t) => ({
      ...t,
      subs: [...(t.subs || []), { id: nid(), text: subInput.text.trim(), at: subInput.at, done: false }],
    }));
    setSubInput({ text: "", at: "" });
  };
  const setStage = (cid, i) => update(cid, (c) => ({
    ...c, stage: i, messages: [...c.messages, { id: nid(), system: true, text: `進捗が「${stages[i]}」に更新されました`, at: "たった今" }],
  }));
  const sendMessage = (cid) => {
    if (!chatInput.trim()) return;
    update(cid, (c) => ({ ...c, messages: [...c.messages, { id: nid(), by: ME, text: chatInput.trim(), at: "たった今" }] }));
    setChatInput(""); setMentionOpen(false);
  };
  const invite = (cid, u) => update(cid, (c) => ({
    ...c, members: [...c.members, u],
    messages: [...c.messages, { id: nid(), system: true, text: `${user(u).name} さんがチャンネルに参加しました`, at: "たった今" }],
  }));
  const inviteMember = (email, role) => {
    const clean = (email || "").trim();
    if (!clean.includes("@")) return;
    const nameGuess = clean.split("@")[0];
    const newId = nid();
    setTeam((ts) => [...ts, {
      id: newId, name: nameGuess, role: role || "メンバー", email: clean,
      color: AVATAR_COLORS[ts.length % AVATAR_COLORS.length], status: "invited", joinCh: inviteCh,
    }]);
    // 参加時に自動で入るチャンネルへ先に登録しておく
    if (inviteCh.length) {
      setGroups((gs) => gs.map((g) => (inviteCh.includes(g.id) ? { ...g, members: [...g.members, newId] } : g)));
      setCompanies((cs) => cs.map((c) => (inviteCh.includes(c.id) ? { ...c, members: [...c.members, newId] } : c)));
    }
    notify(inviteCh.length
      ? `${clean} を登録し、${inviteCh.length}つのチャンネルに追加しました`
      : `${clean} に招待メールを送信しました`);
    setInviteCh([]);
  };
  const resendInvite = (u) => notify(`${u.email} に招待を再送しました`);
  const removeMember = (id) => { setTeam((ts) => ts.filter((u) => u.id !== id)); notify("メンバーを削除しました"); };

  const GROUP_ICONS = [
  { shape: "flower", color: "purple" }, { shape: "sun", color: "yellow" },
  { shape: "clover", color: "green" },  { shape: "blob", color: "red" },
  { shape: "hex", color: "blue" },      { shape: "stamp", color: "orange" },
  { shape: "drop", color: "pink" },     { shape: "burst", color: "purple" },
  { shape: "cloud", color: "blue" },    { shape: "wave", color: "green" },
  { shape: "arch", color: "orange" },   { shape: "square", color: "pink" },
];
const sameIcon = (a, b) => a.shape === b.shape && a.color === b.color;

  const dmWith = (uid) => {
    const found = dms.find((d) => d.with === uid);
    if (found) { setActiveDm(found.id); setDms((v) => v.map((d) => (d.id === found.id ? { ...d, unread: 0 } : d))); return found.id; }
    const id = nid();
    setDms((v) => [{ id, with: uid, unread: 0, messages: [] }, ...v]);
    setActiveDm(id);
    return id;
  };
  const sendDm = (did) => {
    if (!chatInput.trim()) return;
    setDms((v) => v.map((d) => (d.id === did
      ? { ...d, messages: [...d.messages, { id: nid(), by: ME, text: chatInput.trim(), at: "たった今" }] } : d)));
    setChatInput(""); setMentionOpen(false);
  };
  const totalDm = () => dms.reduce((n, d) => n + d.unread, 0);

  const openGroupForm = () => setGroupForm({ name: "", shape: "flower", color: "purple", members: [ME] });
  const saveGroup = () => {
    const f = groupForm;
    if (!f.name.trim()) return;
    setGroups((gs) => [{
      id: nid(), name: f.name.trim(), shape: f.shape, color: f.color, members: f.members, unread: 0,
      messages: [{ id: nid(), system: true, text: "チャンネルを作成しました", at: "たった今" }],
    }, ...gs]);
    notify(`#${f.name.trim()} を作成しました`);
    setGroupForm(null);
  };
  const sendGroupMessage = (gid) => {
    if (!chatInput.trim()) return;
    setGroups((gs) => gs.map((g) => (g.id === gid
      ? { ...g, messages: [...g.messages, { id: nid(), by: ME, text: chatInput.trim(), at: "たった今" }] } : g)));
    setChatInput(""); setMentionOpen(false);
  };
  const inviteToGroup = (gid, uid2) => setGroups((gs) => gs.map((g) => (g.id === gid
    ? { ...g, members: [...g.members, uid2],
        messages: [...g.messages, { id: nid(), system: true, text: `${user(uid2).name} さんが参加しました`, at: "たった今" }] }
    : g)));

  const buildTimeline = (co) => {
    const items = [];
    (co.mails || []).forEach((m) => items.push({
      id: m.id, at: m.at, kind: m.dir === "in" ? "mail_in" : "mail_out",
      shape: "square", color: m.dir === "in" ? "green" : "blue",
      label: m.dir === "in" ? "メール受信" : "メール送信",
      title: m.subject, body: m.excerpt, by: m.dir === "in" ? null : ME,
    }));
    (co.events || []).forEach((e) => items.push({
      id: e.id, at: e.when, kind: "meeting", shape: "drop", color: "purple",
      label: "打合せ", title: e.title, body: `${e.format}${e.link ? ` ・ ${e.link}` : ""}`, by: co.ownerId,
    }));
    co.tasks.forEach((t) => items.push({
      id: t.id, at: fmtDue(t.due), kind: t.done ? "task_done" : "task",
      shape: "sun", color: t.done ? "green" : "yellow",
      label: t.done ? "タスク完了" : "タスク", title: t.title,
      body: `期限 ${fmtDue(t.due)} ・ ${user(t.assignee).name}`, by: t.assignee,
    }));
    co.messages.forEach((m) => {
      if (m.system) items.push({
        id: m.id, at: m.at, kind: "system", shape: "blob", color: "lime",
        label: "更新", title: m.text, body: "", by: null,
      });
      else items.push({
        id: m.id, at: m.at, kind: "note", shape: "cloud", color: "blue",
        label: "チャンネル", title: m.text, body: "", by: m.by,
      });
    });
    return items;
  };

  const TL_FILTERS = [
    ["all", "すべて"], ["mail", "メール"], ["meeting", "打合せ"],
    ["task", "タスク"], ["note", "会話"],
  ];
  const tlMatch = (kind, f) => {
    if (f === "all") return true;
    if (f === "mail") return kind.startsWith("mail");
    if (f === "task") return kind.startsWith("task");
    if (f === "note") return kind === "note" || kind === "system";
    return kind === f;
  };

  /* 取り込み対象（名刺に載っているメールアドレス） */
  const mailTargets = () =>
    companies.flatMap((co) =>
      (co.contacts || [])
        .filter((p) => p.email && p.email.includes("@"))
        .map((p) => ({ ...p, co }))
    );
  const isWatched = (id) => !mailOff.includes(id);
  const toggleWatch = (id, name) => {
    setMailOff((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
    notify(mailOff.includes(id) ? `${name} のメールを取り込みます` : `${name} のメールを取り込みません`);
  };

  const approveJoin = (r) => {
    setTeam((ts) => [...ts, {
      id: nid(), name: r.name, role: "メンバー", email: r.email,
      color: AVATAR_COLORS[ts.length % AVATAR_COLORS.length], status: "active", note: "",
      av: { kind: "shape", shape: "clover", color: "green" }, cover: { kind: "color", color: "green" },
    }]);
    setPending((v) => v.filter((x) => x.id !== r.id));
    notify(`${r.email} の参加を承認しました`);
  };
  const rejectJoin = (r) => {
    setPending((v) => v.filter((x) => x.id !== r.id));
    notify("参加申請を却下しました");
  };
  const makeLink = () => {
    const token = Math.random().toString(36).slice(2, 10);
    setInviteLink({ url: `https://${workspace.slug}.syncle.app/join/${token}`, expires: "7日後", uses: 0, limit: 10 });
    notify("招待リンクを作成しました");
  };

  const dealsOf = () => companies.filter((c) => c.deal && c.deal.on);
  const patchDeal = (cid, obj) => {
    update(cid, (c) => ({ ...c, deal: { ...c.deal, ...obj } }));
    setDealSheet((d) => (d && d.id === cid ? { ...d, deal: { ...d.deal, ...obj } } : d));
  };
  const finishDeal = (cid) => {
    const co = companies.find((c) => c.id === cid);
    update(cid, (c) => ({
      ...c, deal: { ...c.deal, on: false },
      messages: [...c.messages, { id: nid(), system: true, text: "案件を完了にしました", at: "たった今" }],
    }));
    notify(`${co.name} の案件を完了にしました`);
    setDealSheet(null);
  };
  const toggleDoc = (cid, fid) =>
    update(cid, (c) => ({ ...c, docs: (c.docs || []).map((f) => (f.id === fid ? { ...f, pinned: !f.pinned } : f)) }));
  const patchDoc = (cid, fid, obj) => {
    update(cid, (c) => ({ ...c, docs: (c.docs || []).map((f) => (f.id === fid ? { ...f, ...obj } : f)) }));
    setDocSheet((d) => (d && d.id === fid ? { ...d, ...obj } : d));
  };

  const channelName = (co) => co.name.replace(/株式会社|有限会社/g, "").trim();

  /* ══════════════ メール作成 ══════════════ */
  /* ══════════════ 日程調整 ══════════════ */
  const connectGcal = () => {
    setGcal({ connected: false, syncing: true });
    setTimeout(() => { setGcal({ connected: true, syncing: false }); notify("Google カレンダーを連携しました"); }, 1000);
  };

  const openMeet = (co) => {
    setMeet({ companyId: co.id, contactId: co.primaryContactId, duration: 60, format: "Google Meet", days: 7, selected: [] });
    setScreen("schedule");
  };

  const slotGroups = useMemo(
    () => (meet ? buildSlots(meet.days, meet.duration, calendars) : []),
    [meet && meet.days, meet && meet.duration, calendars]
  );

  const toggleSlot = (key) => setMeet((m) => ({
    ...m,
    selected: m.selected.includes(key) ? m.selected.filter((k) => k !== key)
      : m.selected.length >= 4 ? m.selected : [...m.selected, key],
  }));

  const selectedSlots = () => slotGroups.flatMap((g) => g.slots).filter((s) => meet.selected.includes(s.key));

  const slotsToMail = () => {
    const co = companies.find((c) => c.id === meet.companyId);
    const lines = selectedSlots().map((s) => `・${slotText(s)}`).join("\n");
    setMail({
      companyId: co.id, contactId: meet.contactId, purpose: "meeting", tone: "標準",
      memo: `以下の候補日時から選んでいただきたい。所要${meet.duration}分、${meet.format}で実施。\n${lines}`,
      subject: "", body: "", replyTo: null, loading: false, error: null,
    });
    setScreen("compose");
  };

  const sendCandidates = () => {
    const co = companies.find((c) => c.id === meet.companyId);
    const lines = selectedSlots().map((x) => `・${slotText(x)}`).join("\n");
    const link = co.bookingLink;
    setMail({
      companyId: co.id, contactId: meet.contactId, purpose: "meeting", tone: "標準",
      memo: `次回の打合せ日程を決めたい。所要${meet.duration}分、${meet.format}で実施。\n以下の候補から都合の良い日時を選んでいただきたい。\n${lines}` +
        (link ? `\n予約ページからも選べる: ${link}` : ""),
      subject: "", body: "", replyTo: null, loading: false, error: null,
    });
    setScreen("compose");
  };

  const issueBooking = () => {
    const co = companies.find((c) => c.id === meet.companyId);
    const link = `https://cardflow.app/b/${randLetters(8)}`;
    update(co.id, (c) => ({
      ...c, bookingLink: link,
      messages: [...c.messages, { id: nid(), system: true, text: "予約ページを発行しました", at: "たった今" }],
    }));
    notify("予約ページを発行しました");
  };

  const confirmBooking = (slot) => {
    const co = companies.find((c) => c.id === meet.companyId);
    const p = co.contacts.find((c) => c.id === meet.contactId) || co.contacts[0];
    const link = meet.format === "Google Meet" ? makeMeetLink() : meet.format === "Zoom" ? makeZoomLink() : null;
    const ev = { id: nid(), title: `${co.name} ${p.name} 様 打合せ`, when: slotText(slot), iso: slot.iso, format: meet.format, link, calendar: "仕事用" };
    update(co.id, (c) => ({
      ...c, events: [...(c.events || []), ev],
      tasks: [{ id: nid(), title: `${slot.day} 打合せの準備`, due: slot.iso, assignee: c.ownerId, contactId: p.id, pri: "高", done: false }, ...c.tasks],
      messages: [...c.messages, { id: nid(), system: true, text: `${ev.when} に打合せが確定しました（${meet.format}）`, at: "たった今" }],
    }));
    update(co.id, (c) => ({
      ...c,
      mails: [{ id: nid(), dir: "out", subject: "打合せ日程確定のご連絡",
        excerpt: `${ev.when} で確定しました。${link ? link : "詳細は追ってご連絡します。"}`,
        at: "たった今", replied: true, from: p.email }, ...(c.mails || [])],
    }));
    notify("日程が確定し、確認メールを送信しました");
    const id = co.id; setMeet(null); open(id, "info");
  };

  const scheduleScreen = () => {
    if (!meet) return null;
    const co = companies.find((c) => c.id === meet.companyId);
    if (!co) return null;
    const busyCount = BUSY.filter((b) => calendars.find((c) => c.id === b[0] && c.enabled)).length;
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => { setMeet(null); setScreen("detail"); }} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">日程を調整</div>
            <div className="text-sm text-slate-400 truncate">{co.name}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!gcal.connected ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center space-y-3">
              <Calendar size={30} className="mx-auto text-slate-300" />
              <p className="text-sm text-slate-500 leading-relaxed">Google カレンダーを連携すると、空いている時間だけを候補として出せます。</p>
              <button onClick={connectGcal} disabled={gcal.syncing}
                className="bg-slate-900 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-60">
                {gcal.syncing ? "接続中…" : "カレンダーを連携"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">
                <div>
                  <div className="text-sm text-slate-400 mb-1.5">所要時間</div>
                  <div className="flex gap-1 p-1" style={{ background: "#F1EDE4", borderRadius: 18 }}>
                    {[30, 45, 60, 90].map((d) => (
                      <button key={d} onClick={() => setMeet({ ...meet, duration: d, selected: [] })}
                        className={`flex-1 text-xs py-1.5 rounded-xl ${meet.duration === d ? "bg-slate-900 text-white font-medium" : "text-slate-600"}`}>{d}分</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1.5">実施形式</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Google Meet", "Zoom", "対面", "電話"].map((f) => (
                      <button key={f} onClick={() => setMeet({ ...meet, format: f })}
                        className={`text-xs font-bold px-3 py-2 ${meet.format === f ? "anim-chip" : ""}`}
                        style={{ background: meet.format === f ? C.purple : "#fff", color: meet.format === f ? "#fff" : "#6B6B6B", border: `2px solid ${meet.format === f ? C.purple : C.line}`, borderRadius: "16px 8px 16px 8px" }}>{f}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1.5">対象期間</div>
                  <div className="flex gap-1 p-1" style={{ background: "#F1EDE4", borderRadius: 18 }}>
                    {[[7, "1週間"], [14, "2週間"], [21, "3週間"]].map(([d, l]) => (
                      <button key={d} onClick={() => setMeet({ ...meet, days: d, selected: [] })}
                        className={`flex-1 text-xs py-1.5 rounded-xl ${meet.days === d ? "bg-white font-medium" : "text-slate-500"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1.5">空き判定に使うカレンダー</div>
                  <div className="space-y-1.5">
                    {calendars.map((c) => (
                      <button key={c.id} onClick={() => setCalendars(calendars.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)))}
                        className="w-full flex items-center gap-2 text-left">
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${c.enabled ? "bg-slate-900" : "border border-slate-300"}`}>
                          {c.enabled && <Check size={11} className="text-white" />}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.color}`} />
                        <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                        <span className="text-sm text-slate-400 truncate">{c.email}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setCalendars([...calendars, { id: nid(), name: "追加カレンダー", email: "another@gmail.com", enabled: true, color: "bg-amber-500" }])}
                    className="w-full mt-2 border border-dashed border-slate-300 rounded-xl py-1.5 text-xs text-slate-500 flex items-center justify-center gap-1">
                    <Plus size={12} />Google カレンダーを追加
                  </button>
                  <p className="text-sm text-slate-400 mt-1.5">{busyCount} 件の予定を避けて候補を出しています。</p>
                </div>
              </div>

              <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">空いている時間</span>
                  <span className="text-sm text-slate-400">{meet.selected.length} / 4 選択</span>
                </div>
                {slotGroups.length === 0 && <p className="text-sm text-slate-400 text-center py-4">この条件では空きがありません。</p>}
                {slotGroups.map((g) => (
                  <div key={g.day}>
                    <div className="text-sm text-slate-500 mb-1.5">{g.day}（{g.wd}）</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.slots.slice(0, 6).map((s, si) => {
                        const on = meet.selected.includes(s.key);
                        return (
                          <button key={s.key} onClick={() => toggleSlot(s.key)} style={{ animationDelay: `${si * 35}ms` }}
                            className={`text-sm px-3 py-1.5 rounded-xl border ${on ? "bg-slate-900 text-white border-blue-600" : "border-slate-200 text-slate-600"}`}>
                            {fmtHour(s.start)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {meet.selected.length > 0 && (
                <div className="bg-blue-50 rounded-2xl p-3 space-y-1">
                  <div className="text-sm text-slate-700 font-medium">選んだ候補</div>
                  {selectedSlots().map((s) => <div key={s.key} className="text-sm text-slate-700">・{slotText(s)}</div>)}
                </div>
              )}

              <button onClick={slotsToMail} disabled={meet.selected.length === 0}
                className="w-full bg-slate-900 text-white rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                <Wand2 size={16} />候補を入れてメールを作る
              </button>

              <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2">
                <div className="text-sm font-bold">予約ページで選んでもらう</div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  相手にURLを送ると、空き時間から相手が自分で選べます。確定するとカレンダーに入り、会議リンクが自動発行されます。
                </p>
                {!co.bookingLink ? (
                  <button onClick={issueBooking} className="w-full border border-slate-300 text-slate-900 rounded-xl py-2 text-sm">予約ページを発行</button>
                ) : (
                  <>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2.5 py-2">
                      <span className="text-sm text-slate-600 flex-1 truncate">{co.bookingLink}</span>
                      <button onClick={() => notify("URLをコピーしました")} className="text-slate-400"><Copy size={14} /></button>
                    </div>
                    <div className="text-sm text-slate-400">相手が選んだ想定で確定してみる:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSlots().length > 0 ? selectedSlots().map((s) => (
                        <button key={s.key} onClick={() => confirmBooking(s)}
                          className="text-xs bg-emerald-600 text-white rounded-xl px-2.5 py-1.5">{slotText(s)} で確定</button>
                      )) : <span className="text-sm text-slate-400">上で候補を選ぶと確定ボタンが出ます。</span>}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const openMail = (co, contactId, replyTo) => {
    setMail({
      companyId: co.id, contactId: contactId || co.primaryContactId,
      purpose: replyTo ? "followup" : "thanks", tone: "標準", memo: "",
      subject: replyTo ? `Re: ${replyTo.subject}` : "", body: "",
      replyTo: replyTo || null, loading: false, error: null,
    });
    setScreen("compose");
  };

  const callClaude = async (prompt) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const text = data.content.filter((i) => i.type === "text").map((i) => i.text).join("\n");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  };

  const buildContext = () => {
    const co = companies.find((c) => c.id === mail.companyId);
    const p = co.contacts.find((c) => c.id === mail.contactId);
    const openTasks = co.tasks.filter((t) => !t.done).map((t) => `${t.title}（期限${fmtDue(t.due)}）`).join("、") || "なし";
    return { co, p, openTasks };
  };

  const generateDraft = async () => {
    setMail((m) => ({ ...m, loading: true, error: null }));
    try {
      const { co, p, openTasks } = buildContext();
      const purpose = PURPOSES.find((x) => x.id === mail.purpose);
      const prompt = `あなたは日本のBtoB営業担当者のメール作成を手伝うアシスタントです。以下の情報をもとに、実際に送れる日本語のビジネスメールを1通作成してください。

【差出人】${MY_COMPANY} ${user(ME).name}（${user(ME).role}）
【宛先】${co.name} ${p.dept} ${p.title} ${p.name} 様
【相手の企業情報】業種:${co.industry} / 従業員:${co.employees}名
【案件】${co.dealType}${co.dealNote ? ` — ${co.dealNote}` : ""}
【現在の進捗】${stages[co.stage]}
【社内メモ】${co.comment || "なし"}
【未完了タスク】${openTasks}
【メールの目的】${purpose.label}（${purpose.hint}）
【トーン】${mail.tone}
${mail.memo ? `【必ず盛り込む内容】${mail.memo}` : ""}
${mail.replyTo ? `【返信対象のメール】件名:${mail.replyTo.subject} / 本文:${mail.replyTo.excerpt}` : ""}

条件:
- 冒頭の挨拶、本題、結びまで含めた完成した本文にすること
- 署名は「${MY_COMPANY}\n${user(ME).name}」の2行のみ
- 具体的な日付が必要な箇所は「8月7日（木）14:00」のような候補を1〜2件示す
- 誇張した表現や過剰なへりくだりは避け、読みやすい長さにする
- 事実として確認できない実績や数字は書かない

以下のJSONのみを返してください。前置きやコードブロックは不要です。
{"subject":"件名","body":"本文"}`;
      const r = await callClaude(prompt);
      setMail((m) => ({ ...m, subject: r.subject, body: r.body, loading: false }));
    } catch (e) {
      setMail((m) => ({ ...m, loading: false, error: "下書きを作れませんでした。もう一度お試しください。" }));
    }
  };

  const refineDraft = async (instruction) => {
    if (!mail.body) return;
    setMail((m) => ({ ...m, loading: true, error: null }));
    try {
      const prompt = `以下の日本語のビジネスメールを「${instruction}」という方針で書き直してください。宛先や目的は変えないこと。

件名: ${mail.subject}
本文:
${mail.body}

以下のJSONのみを返してください。前置きやコードブロックは不要です。
{"subject":"件名","body":"本文"}`;
      const r = await callClaude(prompt);
      setMail((m) => ({ ...m, subject: r.subject, body: r.body, loading: false }));
    } catch (e) {
      setMail((m) => ({ ...m, loading: false, error: "書き直しに失敗しました。もう一度お試しください。" }));
    }
  };

  const sendMail = () => {
    const { co, p } = buildContext();
    update(co.id, (c) => ({
      ...c,
      mails: [{ id: nid(), dir: "out", subject: mail.subject, excerpt: mail.body.slice(0, 60), at: "たった今", replied: true, from: p.email },
        ...c.mails.map((m) => (mail.replyTo && m.id === mail.replyTo.id ? { ...m, replied: true } : m))],
      messages: [...c.messages, { id: nid(), system: true, text: `${p.name} 様にメール「${mail.subject}」を送信しました`, at: "たった今" }],
    }));
    notify("メールを送信し、チャンネルに記録しました");
    const id = co.id; setMail(null); open(id, "mail");
  };

  const bookingScreen = () => {
    if (!meet) return null;
    const co = companies.find((c) => c.id === meet.companyId);
    if (!co) return null;
    const p = co.contacts.find((c) => c.id === meet.contactId) || co.contacts[0];
    const cands = selectedSlots();
    const byDay = cands.reduce((acc, x) => {
      (acc[x.day] = acc[x.day] || { day: x.day, wd: x.wd, slots: [] }).slots.push(x);
      return acc;
    }, {});
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => setScreen("schedule")} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
          <div className="flex-1 min-w-0">
            <div className="text-base font-extrabold">相手に見える画面</div>
            <div className="text-sm text-slate-400 truncate">{p.name} 様がこのページを開きます</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div style={{ borderRadius: 26, border: `2.5px solid ${C.line}` }} className="bg-white p-5 text-center space-y-1.5">
            <div className="text-sm text-slate-400">{MY_COMPANY}</div>
            <div className="text-lg font-extrabold">{user(ME).name} との打合せ</div>
            <div className="flex items-center justify-center gap-3 text-sm text-slate-500 pt-1">
              <span className="flex items-center gap-1"><Clock size={14} />{meet.duration}分</span>
              <span className="flex items-center gap-1">
                {meet.format === "対面" ? <MapPin size={14} /> : <Video size={14} />}{meet.format}
              </span>
            </div>
          </div>

          {cands.length === 0 ? (
            <div style={{ borderRadius: 26, border: `2.5px solid ${C.line}` }} className="bg-white p-6 text-center text-sm text-slate-400">
              候補がまだ選ばれていません。<br />前の画面で空き時間を選んでください。
            </div>
          ) : (
            <div style={{ borderRadius: 26, border: `2.5px solid ${C.line}` }} className="bg-white p-4 space-y-4">
              <div className="text-sm text-slate-500">ご都合の良い日時をお選びください</div>
              {Object.values(byDay).map((g) => (
                <div key={g.day} className="space-y-2">
                  <div className="text-sm font-bold">{g.day}（{g.wd}）</div>
                  {g.slots.map((x) => (
                    <button key={x.key} onClick={() => confirmBooking(x)}
                      className="w-full py-3.5 text-base font-bold anim-item bg-white"
                      style={{ border: `2.5px solid ${C.purple}`, color: C.purple, borderRadius: "24px 12px 24px 12px" }}>
                      {fmtHour(x.start)} 〜 {fmtHour(x.end)}
                    </button>
                  ))}
                </div>
              ))}
              <p className="text-sm text-slate-400 leading-relaxed">
                選択すると日程が確定し、{meet.format === "対面" ? "詳細が" : "会議リンクが"}メールで届きます。
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const composeScreen = () => {
    if (!mail) return null;
    const co = companies.find((c) => c.id === mail.companyId);
    if (!co) return null;
    const p = co.contacts.find((c) => c.id === mail.contactId) || co.contacts[0];
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => { setMail(null); setScreen("detail"); }} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">メールを作成</div>
            <div className="text-sm text-slate-400 truncate">{co.name}</div>
          </div>
          <button onClick={sendMail} disabled={!mail.subject || !mail.body}
            className="text-sm font-bold px-4 py-2 text-white disabled:opacity-40"
            style={{ background: C.purple, borderRadius: "16px 8px 16px 8px" }}>送信</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2.5 p-3"
            style={{ background: SOFT.blue, borderRadius: "22px 11px 22px 11px" }}>
            <ShapeIcon shape="square" color="blue" size={30} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-extrabold" style={{ color: C.blue }}>
                {gmail.connected ? `${gmail.address} から送信` : "Gmail 未連携（下書きのみ）"}
              </div>
              <div className="text-[11px] font-bold" style={{ color: "#6B6B6B" }}>
                {gmail.connected ? "送信済みは Gmail にも残ります" : "連携すると実際に送信できます"}
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
            <Field label="宛先">
              <select value={mail.contactId} onChange={(e) => setMail({ ...mail, contactId: e.target.value })} className={inputCls}>
                {co.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.title}）</option>)}
              </select>
              <div className="text-sm text-slate-400 px-1">{p.email}</div>
            </Field>
          </div>

          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-violet-600" />
              <span className="text-sm font-bold">下書きを作る</span>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1.5">用件を選ぶ</div>
              <div className="flex flex-wrap gap-1.5">
                {PURPOSES.map((x, pi) => (
                  <button key={x.id} onClick={() => setMail({ ...mail, purpose: x.id })}
                    className={`text-xs px-2.5 py-1.5 rounded-full ${mail.purpose === x.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {x.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-400 mt-1.5">{PURPOSES.find((x) => x.id === mail.purpose)?.hint}</p>
            </div>
            <button onClick={() => openMeet(co)}
              className="w-full border border-slate-300 text-slate-900 rounded-xl py-2 text-xs flex items-center justify-center gap-1.5">
              <Calendar size={14} />カレンダーから空き日程を入れる
            </button>
            <div>
              <div className="text-sm text-slate-400 mb-1.5">トーン</div>
              <div className="flex gap-1 p-1" style={{ background: "#F1EDE4", borderRadius: 18 }}>
                {TONES.map((t) => (
                  <button key={t} onClick={() => setMail({ ...mail, tone: t })}
                    className={`flex-1 text-xs py-1.5 rounded-xl ${mail.tone === t ? "bg-white font-medium" : "text-slate-500"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1.5">盛り込みたいこと（任意）</div>
              <textarea rows={2} value={mail.memo} onChange={(e) => setMail({ ...mail, memo: e.target.value })}
                placeholder="例：来週の水曜か木曜の午後で打合せをお願いしたい"
                className="w-full text-sm bg-slate-50 rounded-xl p-2 outline-none resize-none" />
            </div>
            <button onClick={generateDraft} disabled={mail.loading}
              className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <ShapeIcon shape="burst" color="yellow" size={20} />{mail.loading ? "書いています…" : mail.body ? "作り直す" : "この内容で下書きを作る"}
            </button>
            {mail.error && <p className="text-sm text-rose-600">{mail.error}</p>}
          </div>

          {mail.loading && !mail.body && (
            <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2.5">
              <div className="skel" style={{ height: 16, width: "60%" }} />
              <div className="skel" style={{ height: 12 }} />
              <div className="skel" style={{ height: 12, width: "92%" }} />
              <div className="skel" style={{ height: 12, width: "78%" }} />
              <div className="skel" style={{ height: 12, width: "88%" }} />
              <div className="skel" style={{ height: 12, width: "40%" }} />
            </div>
          )}

          {mail.body && (
            <div className="anim-fade space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {["もう少し短く", "もっと丁寧に", "もっと簡潔でカジュアルに", "日程の候補を増やす"].map((x) => (
                  <button key={x} onClick={() => refineDraft(x)} disabled={mail.loading}
                    className="text-xs font-bold px-3 py-1.5 bg-white disabled:opacity-50"
                    style={{ border: `2px solid ${C.purple}`, color: C.purple, borderRadius: "14px 7px 14px 7px" }}>{x}</button>
                ))}
              </div>
              <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <PenLine size={12} />下書き（そのまま編集できます）
                </div>
                <input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })}
                  placeholder="件名" className="w-full text-sm font-medium bg-slate-50 rounded-xl px-2 py-2 outline-none" />
                <textarea rows={14} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })}
                  className="w-full text-sm bg-slate-50 rounded-xl p-2 outline-none resize-none leading-relaxed" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed px-1">
                送信すると会社のメール履歴に残り、チャンネルにも記録が流れます。
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const MessageText = ({ text }) => {
    let parts = [text];
    TEAM.forEach((u) => {
      parts = parts.flatMap((p) => typeof p === "string"
        ? p.split(`@${u.name}`).flatMap((s, i) => (i === 0 ? [s] : [{ m: u.name }, s])) : [p]);
    });
    return <span className="text-sm leading-relaxed">{parts.map((p, i) => typeof p === "string" ? p :
      <span key={i} className="bg-blue-50 text-blue-700 rounded px-1 font-medium">@{p.m}</span>)}</span>;
  };

  /* ══════════════ 画面 ══════════════ */
  /* ══════════════ ログイン ══════════════ */
  const sendCode = () => {
    if (!authEmail.includes("@")) { setAuthErr("メールアドレスを確認してください"); return; }
    setAuthErr(""); setAuthBusy(true);
    setTimeout(() => {
      setAuthBusy(false);
      setAuthCode(["", "", "", "", "", ""]);
      setAuthStep("code");
    }, 900);
  };

  const googleSignIn = () => {
    setAuthBusy(true);
    setTimeout(() => {
      setAuthBusy(false);
      setAuthEmail("shimizu@nico-inc.net");
      afterVerify("shimizu@nico-inc.net");
    }, 1100);
  };

  const afterVerify = (mail) => {
    const em = (mail || authEmail).trim();
    if (authMode === "create") { setAuthStep("setup"); return; }
    const dom = em.split("@")[1] || "";
    // 事前にメンバー登録されていれば、そのまま参加できる
    const pre = SEED_TEAM.find((u) => u.email === em);
    const mine = WORKSPACES.filter((w) => w.emails.includes(em) || (pre && w.id === "w1"));
    const same = WORKSPACES.filter((w) => w.domain === dom && !w.emails.includes(em));
    setFoundWs(mine);
    setSameDomainWs(same);
    if (mine.length === 0 && same.length === 0) { setAuthStep("notfound"); return; }
    if (mine.length === 1 && same.length === 0) { enterWs(mine[0]); return; }
    setAuthStep("pick");
  };

  const requestJoin = (w) => {
    setRequested((r) => [...r, w.id]);
    if (w.openJoin) {
      notify(`${w.name} に参加しました`);
      setTimeout(() => enterWs(w), 700);
    } else {
      setPending((v) => [...v, { id: nid(), name: authEmail.split("@")[0],
        email: authEmail, at: "たった今", via: "参加を申請" }]);
      notify(`${w.name} に参加を申請しました。承認をお待ちください`);
    }
  };

  const enterWs = (w) => {
    setWorkspace(w);
    setAuthed(true);
    setLocked(false);
    notify(`${w.name} に入りました`);
  };

  const verifyCode = (arr) => {
    const v = (arr || authCode).join("");
    if (v.length < 6) return;
    setAuthBusy(true); setAuthErr("");
    setTimeout(() => { setAuthBusy(false); afterVerify(); }, 800);
  };

  const finishSetup = () => {
    if (!setupForm.company.trim() || !setupForm.name.trim()) return;
    const w = { id: nid(), name: setupForm.company.trim(),
      slug: setupForm.slug || slugify(setupForm.company), color: "purple", shape: "flower", members: 1, emails: [authEmail] };
    setTeam((ts) => [{ id: ME, name: setupForm.name.trim(), role: setupForm.role, email: authEmail.trim(),
      color: "bg-blue-100 text-blue-700", status: "active", admin: true, note: "",
      av: { kind: "shape", shape: setupForm.avShape, color: setupForm.avColor } }, ...ts.filter((u) => u.id !== ME)]);
    setWorkspace(w);
    setAuthed(true);
    notify("ワークスペースを作成しました");
  };

  const codeBox = () => (
    <div className="flex gap-2 justify-center">
      {authCode.map((v, i) => (
        <input key={i} value={v} inputMode="numeric" maxLength={1} id={`code-${i}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(0, 1);
            const next = authCode.map((x, j) => (j === i ? ch : x));
            setAuthCode(next);
            if (ch && i < 5) { const el = document.getElementById(`code-${i + 1}`); if (el) el.focus(); }
            if (next.every((x) => x)) verifyCode(next);
          }}
          className="text-center text-xl font-extrabold outline-none"
          style={{ width: 46, height: 56, background: "#fff", borderRadius: i % 2 ? "18px 9px 18px 9px" : "9px 18px 9px 18px",
            border: `2.5px solid ${v ? C.purple : C.line}` }} />
      ))}
    </div>
  );

  const googleButton = () => (
    <button onClick={googleSignIn} disabled={authBusy}
      className="w-full py-3.5 text-sm font-bold bg-white flex items-center justify-center gap-2.5 disabled:opacity-50"
      style={{ borderRadius: "24px 12px 24px 12px", border: `2.5px solid ${C.ink}` }}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.7 5.2C42.2 35.3 45 30.1 45 24z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.3 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.9l7.1-5.5z" />
        <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8 5.7 4.4 14.1l7.1 5.5C13.3 13.3 18.2 9.5 24 9.5z" />
      </svg>
      {authBusy ? "接続中…" : "Google で続ける"}
    </button>
  );

  const BOOT_SEQ = [
    ["flower", "purple"], ["clover", "green"], ["sun", "yellow"],
    ["hex", "blue"], ["blob", "red"], ["drop", "pink"],
  ];

  const bootScreen = () => {
    const done = bootStep >= BOOT_SEQ.length;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-7">
        <div className="flex items-center justify-center" style={{ width: 132, height: 132 }}>
          {done ? (
            <span className="anim-bootpop"><SyncleMark size={126} /></span>
          ) : (
            <span key={bootStep} className="anim-bootswap">
              <ShapeIcon shape={BOOT_SEQ[bootStep][0]} color={BOOT_SEQ[bootStep][1]} size={116} />
            </span>
          )}
        </div>

        <div className="anim-bootrise" style={{ animationDelay: "1650ms" }}>
          <div className="text-3xl font-extrabold" style={{ letterSpacing: "0.2em" }}>SYNCLE</div>
        </div>

        <div className="flex gap-1.5 mt-6 anim-bootrise" style={{ animationDelay: "1900ms" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full anim-bootblink"
              style={{ background: C.purple, animationDelay: `${i * 180}ms` }} />
          ))}
        </div>
      </div>
    );
  };

  const lockScreen = () => (
    <div className="h-full flex flex-col items-center justify-center gap-7 px-8 pane">
      <SyncleMark size={88} />
      <div className="text-center">
        <div className="text-xl font-extrabold">{workspace.name}</div>
        <p className="text-[11px] font-bold mt-1" style={{ color: "#8A8A8A" }}>
          {user(ME).name} としてログイン中
        </p>
      </div>
      <button onClick={() => { setLocked(false); notify("ロックを解除しました"); }}
        className="flex flex-col items-center gap-3">
        <span className="w-20 h-20 flex items-center justify-center anim-ring"
          style={{ background: SOFT.purple, borderRadius: "32px 16px 32px 16px" }}>
          <ScanFace size={38} strokeWidth={1.9} style={{ color: C.purple }} />
        </span>
        <span className="text-sm font-bold" style={{ color: C.purple }}>Face ID でロック解除</span>
      </button>
      <button onClick={() => { setAuthed(false); setLocked(false); setAuthStep("welcome"); }}
        className="text-[11px] font-bold" style={{ color: "#9A9A9A" }}>
        別のアカウントでログイン
      </button>
    </div>
  );

  const authScreen = () => (
    <div className="h-full flex flex-col px-6 overflow-y-auto">

      {/* ── はじめの画面 ── */}
      {authStep === "welcome" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-7 pane py-8">
          <div className="flex flex-col items-center gap-4">
            <SyncleMark size={100} />
            <div className="text-center">
              <div className="text-3xl font-extrabold tracking-widest">SYNCLE</div>
              <p className="text-sm font-bold mt-2 leading-relaxed" style={{ color: "#8A8A8A" }}>
                名刺から、チームの動きまで。<br />ひとつにつながる営業の場所。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {["customers", "channels", "scan", "tasks", "roadmap"].map((k, i) => (
              <span key={k} className="anim-item" style={{ animationDelay: `${i * 70}ms` }}>
                <FeatureIcon name={k} size={32} />
              </span>
            ))}
          </div>

          <div className="w-full space-y-2.5">
            <button onClick={() => { setAuthMode("signin"); setAuthStep("signin"); }}
              className="w-full text-white py-4 text-base font-bold"
              style={{ background: C.purple, borderRadius: "26px 13px 26px 13px" }}>
              ワークスペースにログイン
            </button>
            <button onClick={() => { setAuthMode("create"); setAuthStep("signin"); }}
              className="w-full py-4 text-base font-bold bg-white"
              style={{ borderRadius: "13px 26px 13px 26px", border: `2.5px solid ${C.ink}` }}>
              新しくワークスペースを作る
            </button>
            <p className="text-[11px] font-bold text-center leading-relaxed pt-1" style={{ color: "#9A9A9A" }}>
              招待を受け取った方は「ログイン」からどうぞ。
            </p>
          </div>
        </div>
      )}

      {/* ── メール入力 ── */}
      {authStep === "signin" && (
        <div className="flex-1 flex flex-col justify-center gap-4 pane py-8">
          <button onClick={() => setAuthStep("welcome")} className="self-start p-1 -ml-1" aria-label="戻る">
            <ChevronLeft size={24} strokeWidth={2.6} />
          </button>
          <div className="flex items-center gap-3">
            <ShapeIcon shape={authMode === "create" ? "burst" : "square"} color={authMode === "create" ? "orange" : "blue"} size={44} face wink={authMode !== "create"} />
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-tight">
                {authMode === "create" ? "ワークスペースを作る" : "ログイン"}
              </div>
              <p className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                {authMode === "create" ? "まずはあなたのメールアドレスから" : "所属しているワークスペースを探します"}
              </p>
            </div>
          </div>

          {googleButton()}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
            <span className="text-[11px] font-bold" style={{ color: "#B0AA9E" }}>または</span>
            <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
          </div>

          <input value={authEmail} type="email"
            onChange={(e) => { setAuthEmail(e.target.value); setAuthErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && sendCode()}
            placeholder="you@company.co.jp"
            className="w-full text-base font-medium px-4 py-4 outline-none"
            style={{ background: "#fff", borderRadius: 20, border: `2.5px solid ${authErr ? C.red : C.line}` }} />
          {authErr && <p className="text-[11px] font-bold" style={{ color: C.red }}>{authErr}</p>}

          <button onClick={sendCode} disabled={authBusy || !authEmail}
            className="w-full text-white py-4 text-base font-bold disabled:opacity-40"
            style={{ background: C.purple, borderRadius: "26px 13px 26px 13px" }}>
            {authBusy ? "送信中…" : "確認コードを送る"}
          </button>

          <button onClick={() => setKeepSignedIn((v) => !v)}
            className="flex items-center gap-2.5 text-left py-1">
            <span className="w-5 h-5 flex items-center justify-center shrink-0"
              style={{ borderRadius: 7, background: keepSignedIn ? C.purple : "#fff",
                border: `2.5px solid ${keepSignedIn ? C.purple : "#D6D0C4"}` }}>
              {keepSignedIn && <Check size={12} className="text-white anim-check" strokeWidth={3} />}
            </span>
            <span className="text-[11px] font-bold" style={{ color: "#6B6B6B" }}>
              ログイン状態を保持する（次回からコード不要）
            </span>
          </button>

          <p className="text-[11px] font-bold text-center leading-relaxed" style={{ color: "#B0AA9E" }}>
            パスワードは使いません。<br />
            例：shimizu@nico-inc.net（2つ所属）／ newbie@nico-inc.net（未招待）
          </p>
        </div>
      )}

      {/* ── コード入力 ── */}
      {authStep === "code" && (
        <div className="flex-1 flex flex-col justify-center gap-5 pane py-8">
          <button onClick={() => setAuthStep("signin")} className="self-start p-1 -ml-1" aria-label="戻る">
            <ChevronLeft size={24} strokeWidth={2.6} />
          </button>
          <div className="flex items-center gap-3">
            <ShapeIcon shape="burst" color="yellow" size={44} />
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-tight">コードを入力</div>
              <p className="text-[11px] font-bold truncate" style={{ color: "#8A8A8A" }}>{authEmail} に送りました</p>
            </div>
          </div>
          {codeBox()}
          {authBusy && <p className="text-[11px] font-bold text-center" style={{ color: C.purple }}>確認中…</p>}
          <button onClick={sendCode} className="text-sm font-bold" style={{ color: C.purple }}>コードを再送する</button>
          <p className="text-[11px] font-bold text-center" style={{ color: "#B0AA9E" }}>デモでは6桁なら何でも通ります</p>
        </div>
      )}

      {/* ── ワークスペースを選ぶ ── */}
      {authStep === "pick" && (
        <div className="flex-1 flex flex-col justify-center gap-4 pane py-8">
          <div className="flex items-center gap-3">
            <SyncleMark size={44} />
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-tight">ワークスペースを選ぶ</div>
              <p className="text-[11px] font-bold truncate" style={{ color: "#8A8A8A" }}>
                {foundWs.length > 0 ? `${authEmail} は ${foundWs.length}つに参加しています` : authEmail}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {foundWs.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm font-extrabold px-3 py-1.5"
                  style={{ background: SOFT.purple, color: C.purple, borderRadius: "16px 8px 16px 8px" }}>
                  参加中
                </span>
                <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
              </div>
            )}
            {foundWs.map((w, i) => (
              <button key={w.id} onClick={() => enterWs(w)}
                className="w-full flex items-center gap-3 p-3.5 text-left bg-white anim-item"
                style={{ animationDelay: `${i * 60}ms`,
                  borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                  border: `2.5px solid ${C.line}` }}>
                <ShapeIcon shape={w.shape} color={w.color} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-extrabold truncate">{w.name}</div>
                  <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                    {w.slug}.syncle.app ・ {w.members}人
                  </div>
                </div>
                <ChevronRight size={18} strokeWidth={2.6} style={{ color: "#C8C2B6" }} />
              </button>
            ))}
          </div>

          {sameDomainWs.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm font-extrabold px-3 py-1.5"
                  style={{ background: SOFT.orange, color: C.orange, borderRadius: "16px 8px 16px 8px" }}>
                  同じ会社にあります
                </span>
                <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
              </div>
              <p className="text-[11px] font-bold px-1 leading-relaxed" style={{ color: "#8A8A8A" }}>
                @{(authEmail.split("@")[1] || "")} のワークスペースです。
              </p>
              {sameDomainWs.map((w, i) => {
                const done = requested.includes(w.id);
                return (
                  <div key={w.id} className="flex items-center gap-3 p-3.5 bg-white anim-item"
                    style={{ borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                      border: `2.5px solid ${C.line}`, opacity: done ? 0.7 : 1 }}>
                    <ShapeIcon shape={w.shape} color={w.color} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-extrabold truncate">{w.name}</div>
                      <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                        {w.slug}.syncle.app ・ {w.members}人
                      </div>
                    </div>
                    {done ? (
                      <span className="text-[11px] font-bold px-2.5 py-1.5 shrink-0"
                        style={{ background: SOFT.green, color: C.green, borderRadius: "14px 7px 14px 7px" }}>
                        {w.openJoin ? "参加中" : "承認待ち"}
                      </span>
                    ) : (
                      <button onClick={() => requestJoin(w)}
                        className="text-[11px] font-bold px-3 py-2 text-white shrink-0"
                        style={{ background: w.openJoin ? C.green : C.orange, borderRadius: "14px 7px 14px 7px" }}>
                        {w.openJoin ? "参加する" : "参加を申請"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => { setAuthMode("create"); setAuthStep("setup"); }}
            className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-1.5"
            style={{ borderRadius: "24px 12px 24px 12px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
            <Plus size={16} strokeWidth={2.8} />新しく作る
          </button>
        </div>
      )}

      {/* ── 所属なし ── */}
      {authStep === "notfound" && (
        <div className="flex-1 flex flex-col justify-center gap-4 pane py-8">
          <div className="p-5 space-y-3" style={{ background: SOFT.orange, borderRadius: "30px 15px 30px 15px" }}>
            <ShapeIcon shape="cloud" color="orange" size={44} face />
            <div className="text-lg font-extrabold leading-tight">参加できるワークスペースがありません</div>
            <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#7A5A33" }}>
              {authEmail} 宛の招待が見つかりませんでした。社内の管理者に招待をお願いするか、新しく作ってください。
            </p>
          </div>
          <button onClick={() => { setAuthMode("create"); setAuthStep("setup"); }}
            className="w-full text-white py-4 text-base font-bold"
            style={{ background: C.purple, borderRadius: "26px 13px 26px 13px" }}>
            新しくワークスペースを作る
          </button>
          <button onClick={() => setAuthStep("signin")} className="text-sm font-bold" style={{ color: "#8A8A8A" }}>
            別のメールアドレスで試す
          </button>
        </div>
      )}

      {/* ── 新規作成 ── */}
      {authStep === "setup" && (
        <div className="flex-1 flex flex-col justify-center gap-4 pane py-8">
          <div className="flex items-center gap-3">
            <SyncleMark size={44} />
            <div>
              <div className="text-2xl font-extrabold leading-tight">ワークスペースを作る</div>
              <p className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>あとから設定で変えられます</p>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>会社名</div>
            <input value={setupForm.company}
              onChange={(e) => setSetupForm({ ...setupForm, company: e.target.value, slug: slugify(e.target.value) })}
              placeholder="株式会社ニコ"
              className="w-full text-base font-medium px-4 py-3.5 outline-none"
              style={{ background: "#fff", borderRadius: 18, border: `2.5px solid ${C.line}` }} />
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>ワークスペースのアドレス</div>
            <div className="flex items-center gap-1 px-4 py-3.5"
              style={{ background: "#fff", borderRadius: 18, border: `2.5px solid ${C.line}` }}>
              <input value={setupForm.slug}
                onChange={(e) => setSetupForm({ ...setupForm, slug: slugify(e.target.value) })}
                placeholder="nico"
                className="flex-1 text-base font-bold outline-none min-w-0" />
              <span className="text-sm font-bold shrink-0" style={{ color: "#B0AA9E" }}>.syncle.app</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>あなたの名前</div>
            <input value={setupForm.name}
              onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
              placeholder="清水 晴陽"
              className="w-full text-base font-medium px-4 py-3.5 outline-none"
              style={{ background: "#fff", borderRadius: 18, border: `2.5px solid ${C.line}` }} />
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>アイコン（あとから写真にもできます）</div>
            <div className="flex gap-1.5 flex-wrap">
              {[["flower","purple"],["clover","green"],["sun","yellow"],["hex","blue"],["blob","red"],["drop","pink"]].map(([sh, col]) => {
                const on = setupForm.avShape === sh;
                return (
                  <button key={sh} onClick={() => setSetupForm({ ...setupForm, avShape: sh, avColor: col })}
                    aria-label={sh} className="flex items-center justify-center p-2"
                    style={{ background: on ? SOFT[col] : "#fff", border: `2.5px solid ${on ? C[col] : C.line}`,
                      borderRadius: on ? "16px 8px 16px 8px" : 14 }}>
                    <ShapeIcon shape={sh} color={col} size={26} />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>役割</div>
            <div className="flex flex-wrap gap-1.5">
              {["代表", "営業", "インサイドセールス", "カスタマーサクセス", "エンジニア", "管理部"].map((r, i) => {
                const on = setupForm.role === r;
                return (
                  <button key={r} onClick={() => setSetupForm({ ...setupForm, role: r })}
                    className={`text-xs font-bold px-3 py-2 ${on ? "anim-chip" : ""}`}
                    style={{ background: on ? C.purple : "#fff", color: on ? "#fff" : "#6B6B6B",
                      border: `2px solid ${on ? C.purple : C.line}`,
                      borderRadius: i % 2 ? "16px 8px 16px 8px" : "8px 16px 8px 16px" }}>{r}</button>
                );
              })}
            </div>
          </div>

          <button onClick={finishSetup} disabled={!setupForm.company.trim() || !setupForm.name.trim()}
            className="w-full text-white py-4 text-base font-bold disabled:opacity-40"
            style={{ background: C.purple, borderRadius: "26px 13px 26px 13px" }}>
            作成してはじめる
          </button>
          <p className="text-[11px] font-bold text-center" style={{ color: "#B0AA9E" }}>
            作成後、設定からメンバーを招待できます。
          </p>
        </div>
      )}
    </div>
  );

  const dealsView = () => {
    const all = dealsOf();
    const stalled = all.filter((c) => c.deal.days >= (DEAL_STATUS[c.deal.status] || DEAL_STATUS.talking).limit).length;
    const q = query.trim().toLowerCase();
    const shown = all
      .filter((c) => (dealFilterS === "all" ? true
        : dealFilterS === "stalled" ? c.deal.days >= (DEAL_STATUS[c.deal.status] || DEAL_STATUS.talking).limit
        : c.deal.status === dealFilterS))
      .filter((c) => !q || (c.name + c.deal.memo + c.dealType).toLowerCase().includes(q))
      .sort((a, b) => dealSort === "stalled" ? b.deal.days - a.deal.days
        : dealSort === "new" ? a.deal.days - b.deal.days
        : a.name.localeCompare(b.name, "ja"));

    return (
      <>
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto shrink-0">
          {[["all", `すべて ${all.length}`, "ink"], ["stalled", `動きなし ${stalled}`, "red"]].map(([v, l, col], i) => {
            const on = dealFilterS === v;
            return (
              <button key={v} onClick={() => setDealFilterS(v)}
                className={`text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                style={{ background: on ? (col === "ink" ? C.ink : C[col]) : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2px solid ${on ? (col === "ink" ? C.ink : C[col]) : C.line}`,
                  borderRadius: i % 2 ? "8px 16px 8px 16px" : "16px 8px 16px 8px" }}>{l}</button>
            );
          })}
          {Object.entries(DEAL_STATUS).map(([k, v], i) => {
            const n = all.filter((c) => c.deal.status === k).length;
            if (!n) return null;
            const on = dealFilterS === k;
            return (
              <button key={k} onClick={() => setDealFilterS(k)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                style={{ background: on ? C[v.color] : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2px solid ${on ? C[v.color] : C.line}`,
                  borderRadius: i % 2 ? "16px 8px 16px 8px" : "8px 16px 8px 16px" }}>
                <ShapeIcon shape={v.shape} color={on ? "#ffffff" : C[v.color]} size={14} />
                {v.label} {n}
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-2 flex gap-1.5 shrink-0">
          {[["stalled", "止まっている順"], ["new", "動いている順"], ["name", "会社名順"]].map(([v, l]) => {
            const on = dealSort === v;
            return (
              <button key={v} onClick={() => setDealSort(v)}
                className="text-[11px] font-bold px-2.5 py-1.5"
                style={{ background: on ? SOFT.purple : "transparent", color: on ? C.purple : "#B0AA9E",
                  borderRadius: "12px 6px 12px 6px" }}>{l}</button>
            );
          })}
        </div>

        <div className="px-4 pb-2 space-y-2.5">
          {shown.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <ShapeIcon shape="cloud" color="lime" size={54} face className="mx-auto" />
              <p className="text-sm font-bold text-slate-400">該当する案件がありません。</p>
            </div>
          )}
          {shown.map((c, i) => {
            const st = DEAL_STATUS[c.deal.status] || DEAL_STATUS.talking;
            const h = dealHeat(c.deal.days, c.deal.status);
            return (
              <button key={c.id} onClick={() => setDealSheet(c)}
                className="w-full text-left bg-white p-3.5 anim-item"
                style={{ borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                  border: `2.5px solid ${h ? h.c : C.line}`, animationDelay: `${i * 40}ms` }}>
                <div className="flex gap-3">
                  <CompanyAvatar co={c} size={46} />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-extrabold truncate">{c.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5"
                        style={{ background: SOFT[st.color], color: C[st.color], borderRadius: "10px 5px 10px 5px" }}>
                        {st.label}
                      </span>
                      <DealChip type={c.dealType} />
                      <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{c.deal.amount}</span>
                    </div>
                  </div>
                  <MemberDot id={c.ownerId} size={28} />
                </div>

                {c.deal.memo && (
                  <p className="text-[11px] font-bold mt-2.5 leading-relaxed" style={{ color: "#5B5B5B" }}>
                    {c.deal.memo}
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: `2px dashed ${C.line}` }}>
                  {h ? (
                    <>
                      <AlertCircle size={13} strokeWidth={2.8} style={{ color: h.c }} />
                      <span className="text-[11px] font-extrabold" style={{ color: h.c }}>{c.deal.days}日 {h.t}</span>
                    </>
                  ) : (
                    <>
                      <Clock size={13} strokeWidth={2.6} style={{ color: "#B0AA9E" }} />
                      <span className="text-[11px] font-bold" style={{ color: "#B0AA9E" }}>
                        {c.deal.days === 0 ? "今日更新" : `${c.deal.days}日前に更新`}
                      </span>
                    </>
                  )}
                  <ChevronRight size={16} strokeWidth={2.6} className="ml-auto" style={{ color: "#C8C2B6" }} />
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const listScreen = () => {
    const tierA = list.filter((c) => c.tier === "A").length;
    const openTasks = companies.reduce((n, c) => n + c.tasks.filter((t) => !t.done).length, 0);
    const front = clamp(Math.round(deckP), 0, Math.max(list.length - 1, 0));

    return (
      <div className="flex flex-col h-full">
        <div className="px-4 pt-2 pb-3 flex items-center gap-3 shrink-0">
          <ShapeIcon shape="flower" color="purple" size={44} face />
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-extrabold leading-tight">顧客</div>
            <div className="text-xs font-bold" style={{ color: "#8A8A8A" }}>
              {list.length}社 / Tier A <span style={{ color: C.purple }}>{tierA}</span> / 未完了 <span style={{ color: C.red }}>{openTasks}</span>
            </div>
          </div>
          <button onClick={() => setScreen("inbox")} aria-label="メール"
            className="relative w-11 h-11 flex items-center justify-center">
            <ShapeIcon shape="square" color="blue" size={44} face wink />
            {totalUnreplied > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[11px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                style={{ background: C.red }}>{totalUnreplied}</span>
            )}
          </button>
          <button onClick={startManual} aria-label="顧客を追加"
            className="w-11 h-11 flex items-center justify-center" style={{ background: C.purple, borderRadius: "18px 8px 18px 8px" }}>
            <Plus size={22} className="text-white" strokeWidth={3} />
          </button>
          <button onClick={() => setScreen("settings")} aria-label="設定" className="relative w-11 h-11 flex items-center justify-center">
            <ShapeIcon shape="flower" color="pink" size={44} />
            <Settings size={18} className="absolute text-white" strokeWidth={2.6} />
          </button>
        </div>

        <div className="px-4 pb-3 flex gap-1.5 shrink-0">
          {[["companies", "会社"], ["deals", `進行中 ${dealsOf().length}`]].map(([v, l], i) => {
            const on = custView === v;
            return (
              <button key={v} onClick={() => setCustView(v)}
                className={`flex-1 py-2.5 text-sm font-bold ${on ? "anim-chip" : ""}`}
                style={{ background: on ? C.ink : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2.5px solid ${on ? C.ink : C.line}`,
                  borderRadius: i ? "12px 24px 12px 24px" : "24px 12px 24px 12px" }}>{l}</button>
            );
          })}
        </div>

        {custView === "companies" && (
        <div className="px-4 pb-3 flex items-center gap-2 shrink-0">
          <button onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-white"
            style={{ borderRadius: "20px 10px 20px 10px", border: `2.5px solid ${C.ink}` }}>
            <Sparkles size={15} style={{ color: C.yellow }} strokeWidth={2.6} />
            {{ new: "新しい順", old: "古い順", tier: "ティア順", stage: "進捗順", name: "会社名順" }[sortBy]}
          </button>
          <button onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: C.green, borderRadius: "20px 10px 20px 10px" }}>
            <Filter size={15} strokeWidth={2.6} />絞り込み
          </button>
        </div>
        )}

        {custView === "companies" && sortOpen && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 anim-fade shrink-0">
            {[["new", "新しい順"], ["old", "古い順"], ["tier", "ティア順"], ["stage", "進捗順"], ["name", "会社名順"]].map(([v, l]) => (
              <button key={v} onClick={() => { setSortBy(v); setSortOpen(false); }}
                className={`text-xs font-bold px-3 py-2 ${sortBy === v ? "anim-chip" : ""}`}
                style={{ background: sortBy === v ? C.purple : "#fff", color: sortBy === v ? "#fff" : C.ink,
                  borderRadius: "14px 7px 14px 7px", border: `2px solid ${sortBy === v ? C.purple : C.line}` }}>{l}</button>
            ))}
          </div>
        )}

        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-white px-4 py-3"
            style={{ borderRadius: "999px", border: `2.5px solid ${C.ink}` }}>
            <Search size={18} strokeWidth={2.6} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="会社名・担当者名・メールで検索"
              className="flex-1 bg-transparent text-sm font-medium outline-none min-w-0" />
            {query && <button onClick={() => setQuery("")}><X size={16} /></button>}
          </div>
        </div>

        {custView === "companies" && filterOpen && (
          <div className="px-4 pb-3 space-y-2.5 anim-fade shrink-0">
            <div className="flex gap-1.5">
              {["all", "A", "B", "C"].map((v) => (
                <button key={v} onClick={() => setTierFilter(v)}
                  className={`text-xs font-bold px-3.5 py-2 ${tierFilter === v ? "anim-chip" : ""}`}
                  style={{ background: tierFilter === v ? C.purple : "#fff", color: tierFilter === v ? "#fff" : C.ink,
                    borderRadius: "14px 7px 14px 7px", border: `2px solid ${tierFilter === v ? C.purple : C.line}` }}>
                  {v === "all" ? "全ティア" : `Tier ${v}`}
                </button>
              ))}
            </div>
            <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}
              className="w-full text-sm font-medium bg-white px-3 py-2.5 outline-none"
              style={{ borderRadius: 16, border: `2px solid ${C.line}` }}>
              <option value="all">すべての業種</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {["all", ...DEAL_TYPES].map((v) => (
                <button key={v} onClick={() => setDealFilter(v)}
                  className={`text-xs font-bold px-3 py-1.5 ${dealFilter === v ? "anim-chip" : ""}`}
                  style={{ background: dealFilter === v ? C.ink : "#fff", color: dealFilter === v ? "#fff" : C.ink,
                    borderRadius: "14px 7px 14px 7px", border: `2px solid ${dealFilter === v ? C.ink : C.line}` }}>
                  {v === "all" ? "全案件" : v}
                </button>
              ))}
            </div>
          </div>
        )}

        {custView === "deals" ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-24">{dealsView()}</div>
        ) : list.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
            <ShapeIcon shape="cloud" color="lime" size={60} face />
            <p className="text-sm font-bold text-slate-400">条件に合う会社がありません。</p>
            <button onClick={startManual} className="text-sm font-bold" style={{ color: C.purple }}>手入力で登録する</button>
          </div>
        ) : (
          <>
            <div ref={deckRef} className="deck flex-1 min-h-0 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
              <div style={{ height: (list.length - 1) * DECK_STEP + 560 }}>
                <div className="sticky top-0 px-4" style={{ height: 560 }}>
                  <div className="relative w-full" style={{ height: 560 }}>
                    {list.map((c, i) => {
                      const rel = deckP - i;
                      if (rel > 1.05 || rel < -7.2) return null;
                      const back = clamp(-rel, 0, 7);
                      const out = clamp(rel, 0, 1);
                      const open = clamp(1 - back * 1.15, 0, 1);
                      const HEAD = 74, BODY = 112, PEEK = 46;
                      const stackY = back <= 1
                        ? back * (HEAD + BODY * open + 14)
                        : (HEAD + BODY * open + 14) + (back - 1) * PEEK;
                      const art = companyArt(c);
                      const p2 = primary(c);
                      const evs = c.events || [];
                      const ev = evs[evs.length - 1];
                      return (
                        <button key={c.id} onClick={() => back < 0.5 && open2(c.id)}
                          className="absolute inset-x-0 overflow-hidden text-left"
                          style={{
                            top: 0,
                            transform: `translateY(${6 + stackY - out * 320}px) scale(${1 - clamp(back, 0, 7) * 0.017}) rotate(${-out * 7}deg)`,
                            transformOrigin: "50% 0%",
                            opacity: (1 - out) * (1 - clamp(back - 4, 0, 3) * 0.14),
                            zIndex: list.length - i,
                            background: "#fff",
                            borderRadius: i % 2 ? "28px 16px 28px 16px" : "16px 28px 16px 28px",
                            border: `2.5px solid ${back < 0.5 ? C[art.color] : C.line}`,
                            boxShadow: back < 0.5 ? "0 14px 30px rgba(20,20,20,.15)" : "0 -3px 14px rgba(20,20,20,.08)",
                            pointerEvents: back < 0.5 ? "auto" : "none",
                            willChange: "transform, opacity",
                          }}>
                          <div className="flex items-center gap-3 px-4" style={{ height: HEAD }}>
                            <span style={{ display: "inline-flex", transform: `scale(${1 + open * 0.08}) rotate(${open * -6}deg)` }}>
                              <CompanyAvatar co={c} size={44} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-extrabold truncate">{c.name}</div>
                              <div className="text-[11px] font-bold truncate" style={{ color: "#6B6B6B" }}>
                                {c.industry}　|　従業員 {c.employees} 名
                              </div>
                            </div>
                            {unreadMail(c) > 0 && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.red }} />}
                            <TierChip tier={c.tier} small />
                          </div>

                          <div className="px-4 pb-4 space-y-2"
                            style={{ opacity: clamp(open * 1.5 - 0.2, 0, 1), height: open * BODY, overflow: "hidden" }}>
                            <div style={{ borderTop: `2px dashed ${C.line}` }} />
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <DealChip type={c.dealType} />
                              <span className="text-[11px] font-bold px-2.5 py-1"
                                style={{ background: "#F4F1EA", color: "#6B6B6B", borderRadius: "14px 7px 14px 7px" }}>
                                {stages[c.stage]}
                              </span>
                              <span className="text-[11px] font-bold px-2.5 py-1"
                                style={{ background: "#F4F1EA", color: "#6B6B6B", borderRadius: "14px 7px 14px 7px" }}>
                                担当 {user(c.ownerId).name}
                              </span>
                            </div>
                            {p2 && (
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <Star size={13} fill={C.ink} strokeWidth={0} />窓口 {p2.name}（{p2.title}）
                              </div>
                            )}
                            {ev && (
                              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: C.green }}>
                                <Calendar size={13} strokeWidth={2.6} />{ev.when} 打合せ
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-1.5 pb-24 pt-1">
              <div className="flex gap-1.5">
                {list.slice(0, 12).map((_, i) => (
                  <button key={i} onClick={() => deckRef.current && deckRef.current.scrollTo({ top: i * DECK_STEP, behavior: "smooth" })}
                    aria-label={`${i + 1}社目`} className="rounded-full"
                    style={{ width: i === front ? 22 : 8, height: 8,
                      background: i === front ? C.purple : "#D8D2C6",
                      transition: "width .28s cubic-bezier(.22,1,.36,1), background .2s ease" }} />
                ))}
              </div>
              <p className="text-[11px] font-bold" style={{ color: "#B0AA9E" }}>
                {front + 1} / {list.length}　下にスワイプしてめくる
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  const scanScreen = () => (
    <div className="h-full flex flex-col items-center justify-center gap-9 px-8">
      <div className="text-base font-extrabold" style={{ color: scanPhase === "scanning" ? C.purple : C.ink }}>
        {scanPhase === "scanning" ? "読み取り中…" : "名刺をスキャン"}
      </div>

      <div className="relative flex items-center justify-center" style={{ width: 230, height: 230 }}>
        {scanPhase === "scanning" && ["red", "yellow", "green", "blue", "purple", "pink"].map((col, i) => (
          <span key={col} className="absolute" style={{ transform: `rotate(${i * 60}deg)` }}>
            <span className="block anim-orbit" style={{ animationDelay: `${i * 180}ms` }}>
              <ShapeIcon shape={["blob", "sun", "clover", "square", "flower", "stamp"][i]} color={col} size={26} />
            </span>
          </span>
        ))}
        <button onClick={startScan} disabled={scanPhase === "scanning"}
          className="relative flex items-center justify-center disabled:opacity-60" aria-label="撮影する">
          <SyncleMark size={132} />
          <span className="absolute flex items-center justify-center rounded-full bg-white"
            style={{ width: 54, height: 54, boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}>
            <Camera size={26} strokeWidth={2.4} />
          </span>
        </button>
      </div>

      <div className="flex items-end justify-center gap-10">
        <button onClick={startScan} disabled={scanPhase === "scanning"}
          className="flex flex-col items-center gap-2 disabled:opacity-40">
          <ShapeIcon shape="wave" color="blue" size={58} face wink />
          <span className="text-xs font-bold" style={{ color: "#6B6B6B" }}>アルバム</span>
        </button>
        <button onClick={startScan} disabled={scanPhase === "scanning"}
          className="flex flex-col items-center gap-2 disabled:opacity-40">
          <ShapeIcon shape="stamp" color="orange" size={58} face />
          <span className="text-xs font-bold" style={{ color: "#6B6B6B" }}>一括読取</span>
        </button>
      </div>

      <button onClick={startManual}
        className="flex items-center gap-2 text-sm font-bold px-6 py-3 bg-white"
        style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${C.ink}` }}>
        <PenLine size={16} strokeWidth={2.6} />手入力で登録する
      </button>
    </div>
  );

  const resultScreen = () => {
    if (!draft) return null;
    const existing = draft.existingId ? companies.find((c) => c.id === draft.existingId) : null;
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    return (
      <>
        <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => (step === 2 ? setStep(1) : (setDraft(null), setScreen("scan")))} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
          <div className="flex-1 text-base font-semibold">{step === 1 ? "読み取り結果" : "案件情報"}</div>
          <span className="text-sm text-slate-400">{step} / 2</span>
        </div>
        {step === 1 ? (
          <div className="p-4 space-y-4">
            {existing && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed">
                「{existing.name}」は登録済みです。この名刺は既存の会社に追加されます。
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={draft.makePrimary} onChange={(e) => setDraft({ ...draft, makePrimary: e.target.checked })} />
                  この人を窓口にする
                </label>
              </div>
            )}
            <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
              <Field label="会社名 *">
                <input value={draft.company} onChange={set("company")} placeholder="株式会社◯◯" className={inputCls} />
              </Field>
              <Field label="氏名"><input value={draft.name} onChange={set("name")} placeholder={draft.manual ? "後で追加も可" : ""} className={inputCls} /></Field>
              <Field label="部署"><input value={draft.dept} onChange={set("dept")} className={inputCls} /></Field>
              <Field label="役職"><input value={draft.title} onChange={set("title")} placeholder={draft.manual ? "例：営業部 部長" : ""} className={inputCls} /></Field>
              <Field label="メール">
                <input value={draft.email} onChange={set("email")} placeholder="example@company.co.jp" className={inputCls} />
                {gmail.connected && draft.email && draft.email.includes("@") && (
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <Check size={11} strokeWidth={3.4} style={{ color: C.green }} />
                    <span className="text-[11px] font-bold" style={{ color: C.green }}>
                      このアドレスとのメールが取り込まれます
                    </span>
                  </div>
                )}
              </Field>
              <Field label="電話"><input value={draft.phone} onChange={set("phone")} className={inputCls} /></Field>
              {!existing && (
                <>
                  <Field label="業種">
                    <select value={draft.industry} onChange={set("industry")} className={inputCls}>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </Field>
                  <Field label="従業員数">
                    <input type="number" value={draft.employees} onChange={(e) => setDraft({ ...draft, employees: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  {draft.manual && (
                    <>
                      <Field label="売上高"><input value={draft.revenue} onChange={set("revenue")} placeholder="例：8億円（2025）" className={inputCls} /></Field>
                      <Field label="所在地"><input value={draft.address} onChange={set("address")} className={inputCls} /></Field>
                      <Field label="Web"><input value={draft.web} onChange={set("web")} placeholder="example.co.jp" className={inputCls} /></Field>
                    </>
                  )}
                </>
              )}
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-slate-900 text-white rounded-2xl py-3 text-sm font-semibold">次へ（案件情報）</button>
            <button onClick={commitDraft} disabled={!draft.company.trim()} className="w-full text-sm text-slate-500 py-2 disabled:opacity-40">案件情報をスキップして保存</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
              <Field label="案件種別">
                <select value={draft.dealType} onChange={set("dealType")} className={inputCls}>
                  {DEAL_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="案件内容">
                <textarea rows={3} value={draft.dealNote} onChange={set("dealNote")}
                  placeholder="例：toB向けリード獲得施策の設計と運用代行" className={`${inputCls} resize-none`} />
              </Field>
              <Field label="コメント">
                <textarea rows={3} value={draft.comment} onChange={set("comment")}
                  placeholder="例：展示会で名刺交換。予算は今期中に確保済みとのこと。" className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <button onClick={commitDraft} className="w-full bg-slate-900 text-white rounded-2xl py-3 text-sm font-semibold">
              {existing ? "この会社に追加" : "会社を登録"}
            </button>
          </div>
        )}
      </>
    );
  };

  const detailScreen = () => {
    if (!active) return null;
    const t = companyTier(active);
    const p = primary(active);
    const tabs = [["info", "概要"], ["timeline", "履歴"], ["contacts", "名刺"], ["docs", "書類"], ["tasks", "タスク"], ["mail", "メール"], ["chat", "チャンネル"]];
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 pt-1 pb-3 shrink-0">
          <div className="px-4 py-4" style={{ background: C[companyArt(active).color], borderRadius: "28px 28px 14px 28px" }}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setScreen("list")} className="text-white -ml-1"><ChevronLeft size={24} strokeWidth={2.6} /></button>
              <MoreHorizontal size={22} className="text-white opacity-80" />
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-white rounded-full p-1 shrink-0"><CompanyAvatar co={active} size={46} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white text-xl font-extrabold truncate min-w-0">{active.name}</span>
                  <span className="bg-white text-xs px-2.5 py-1 font-bold shrink-0"
                    style={{ color: C[companyArt(active).color], borderRadius: "12px 6px 12px 6px" }}>Tier {t.tier}</span>
                </div>
                <div className="text-xs font-bold text-white opacity-90">{active.industry}　|　従業員 {active.employees} 名</div>
                {p && <div className="text-xs font-bold text-white opacity-90 truncate">★ {p.name}（{p.title}）</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 shrink-0">
          <div className="bg-white rounded-full p-1 flex">
            {tabs.map(([v, label]) => (
              <button key={v} onClick={() => { setTab(v); if (v === "chat") setField(active.id, "unread", 0); }}
                className={`flex-1 text-xs py-2 px-1 rounded-full relative transition-all duration-200 ${tab === v ? "bg-slate-900 text-white font-medium" : "text-slate-500"}`}>
                {label}
                {v === "mail" && unreadMail(active) > 0 && tab !== v && <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />}
                {v === "chat" && active.unread > 0 && tab !== v && <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {tab === "chat" ? (
          <div className="flex-1 min-h-0">{channelBody(active, true)}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tab === "timeline" && (() => {
              const items = buildTimeline(active).filter((x) => tlMatch(x.kind, tlFilter));
              return (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {TL_FILTERS.map(([v, l]) => (
                      <button key={v} onClick={() => setTlFilter(v)}
                        className={`text-xs font-bold px-3 py-2 ${tlFilter === v ? "anim-chip" : ""}`}
                        style={{ background: tlFilter === v ? C.ink : "#fff", color: tlFilter === v ? "#fff" : "#6B6B6B", border: `2px solid ${tlFilter === v ? C.ink : C.line}`, borderRadius: "16px 8px 16px 8px" }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 flex items-center gap-2">
                    <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && noteInput.trim()) {
                          update(active.id, (c) => ({ ...c, messages: [...c.messages, { id: nid(), by: ME, text: noteInput.trim(), at: "たった今" }] }));
                          setNoteInput(""); notify("記録を追加しました");
                        }
                      }}
                      placeholder="電話した、訪問した などを記録"
                      className="flex-1 text-sm font-medium px-3.5 py-2.5 outline-none min-w-0" style={{ background: "#F7F4ED", borderRadius: 16 }} />
                    <button onClick={() => {
                        if (!noteInput.trim()) return;
                        update(active.id, (c) => ({ ...c, messages: [...c.messages, { id: nid(), by: ME, text: noteInput.trim(), at: "たった今" }] }));
                        setNoteInput(""); notify("記録を追加しました");
                      }} disabled={!noteInput.trim()}
                      className="bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-sm font-semibold shrink-0 disabled:opacity-40">
                      記録
                    </button>
                  </div>

                  {items.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-10">この条件の履歴はありません。</p>
                  )}

                  <div className="relative">
                    {items.length > 0 && (
                      <div className="absolute left-[22px] top-3 bottom-3" style={{ width: 2, background: C.line }} />
                    )}
                    <div className="space-y-2.5">
                      {items.map((it, i) => (
                        <div key={it.id} className="flex gap-3 relative anim-item" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                          <div className="relative z-10" style={{ background: C.bg, borderRadius: 16 }}>
                            <ShapeIcon shape={it.shape} color={it.color} size={44} />
                          </div>
                          <div className="flex-1 min-w-0 bg-white p-3" style={{ borderRadius: "20px 10px 20px 10px", border: `2px solid ${C.line}` }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-slate-400">{it.label}</span>
                              {it.by && <span className="text-xs text-slate-400">・{user(it.by).name}</span>}
                              <span className="ml-auto text-xs text-slate-300 shrink-0">{AGO(it.at)}</span>
                            </div>
                            <div className={`text-sm ${it.kind === "system" ? "text-slate-500" : "font-medium"} break-words`}>
                              {it.title}
                            </div>
                            {it.body && <div className="text-sm text-slate-400 mt-0.5 break-words">{it.body}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {tab === "info" && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[["square", "blue", "メール", () => openMail(active, active.primaryContactId, null)],
                    ["arch", "green", "日程調整", () => openMeet(active)],
                    ["wave", "orange", "履歴", () => setTab("timeline")],
                    ["sun", "yellow", "タスク", () => setTab("tasks")]].map(([shape, color, label, fn]) => (
                    <button key={label} onClick={fn} className="bg-white rounded-2xl py-3 flex flex-col items-center gap-1.5">
                      <ShapeIcon shape={shape} color={color} size={40} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <QuickInfo shape="hex" color="purple" label="業種" value={active.industry} />
                  <QuickInfo shape="clover" color="green" label="従業員数" value={`${active.employees} 名`} />
                  <QuickInfo shape="stamp" color={DEAL_TONE[active.dealType]} label="案件種別" value={active.dealType} />
                  <QuickInfo shape="sun" color="yellow" label="窓口" value={p ? p.name : "未設定"} />
                </div>

                {(active.events || []).length > 0 && (
                  <div style={{ borderRadius: 22, border: `2.5px solid ${C.green}` }} className="bg-white p-3 space-y-2 anim-item">
                    <div className="text-sm text-slate-400">確定した予定</div>
                    {active.events.map((ev) => (
                      <div key={ev.id} className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock size={13} className="text-emerald-600 shrink-0" />{ev.when}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          {ev.format === "対面" ? <MapPin size={12} /> : <Video size={12} />}
                          {ev.format}<span className="text-slate-300">・</span><span>{ev.calendar}に登録済み</span>
                        </div>
                        {ev.link && (
                          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2.5 py-1.5">
                            <span className="text-sm text-violet-600 flex-1 truncate">{ev.link}</span>
                            <button onClick={() => notify("会議リンクをコピーしました")} className="text-slate-400"><Copy size={13} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
                  <Field label="進捗">
                    <select value={active.stage} onChange={(e) => setStage(active.id, Number(e.target.value))} className={inputCls}>
                      {stages.map((s, i) => <option key={s} value={i}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="案件種別">
                    <select value={active.dealType} onChange={(e) => setField(active.id, "dealType", e.target.value)} className={inputCls}>
                      {DEAL_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="案件内容">
                    <textarea rows={2} value={active.dealNote} onChange={(e) => setField(active.id, "dealNote", e.target.value)}
                      placeholder="案件の内容を入力" className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="窓口">
                    <select value={active.primaryContactId} onChange={(e) => setField(active.id, "primaryContactId", e.target.value)} className={inputCls}>
                      {active.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.title}）</option>)}
                    </select>
                  </Field>
                  <Field label="自社担当">
                    <select value={active.ownerId} onChange={(e) => setField(active.id, "ownerId", e.target.value)} className={inputCls}>
                      {TEAM.map((u) => <option key={u.id} value={u.id}>{u.name}（{u.role}）</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
                  <Field label="業種">
                    <select value={active.industry} onChange={(e) => setField(active.id, "industry", e.target.value)} className={inputCls}>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </Field>
                  <Field label="従業員数">
                    <input type="number" value={active.employees} onChange={(e) => setField(active.id, "employees", Number(e.target.value))} className={inputCls} />
                  </Field>
                  <Field label="売上高"><input value={active.revenue} onChange={(e) => setField(active.id, "revenue", e.target.value)} className={inputCls} /></Field>
                  <Field label="所在地"><input value={active.address} onChange={(e) => setField(active.id, "address", e.target.value)} className={inputCls} /></Field>
                  <Field label="Web"><input value={active.web} onChange={(e) => setField(active.id, "web", e.target.value)} className={inputCls} /></Field>
                </div>
                <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3">
                  <div className="text-sm text-slate-400 mb-1.5">コメント</div>
                  <textarea rows={4} value={active.comment} onChange={(e) => setField(active.id, "comment", e.target.value)}
                    placeholder="社内メモ。商談の温度感や注意点など。" className="w-full text-sm outline-none resize-none bg-slate-50 rounded-xl p-2" />
                </div>
                <div className="text-sm text-slate-400 px-1">ティア判定：役職 {t.rankScore}点 ＋ 規模 {t.sizeScore}点 = {t.total}点 → Tier {t.tier}</div>
              </>
            )}

            {tab === "docs" && (() => {
              const docs = active.docs || [];
              const counts = Object.keys(DOC_KINDS).reduce((a, k) => { a[k] = docs.filter((f) => f.kind === k).length; return a; }, {});
              const shown = docs
                .filter((f) => (docFilter === "all" ? true : docFilter === "pinned" ? f.pinned : f.kind === docFilter))
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.at < b.at ? 1 : -1));
              return (
                <>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {[["all", `すべて ${docs.length}`, "ink"], ["pinned", `よく使う ${docs.filter((f) => f.pinned).length}`, "yellow"]].map(([v, l, col], i) => {
                      const on = docFilter === v;
                      return (
                        <button key={v} onClick={() => setDocFilter(v)}
                          className={`text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                          style={{ background: on ? (col === "ink" ? C.ink : C[col]) : "#fff",
                            color: on ? (col === "yellow" ? C.ink : "#fff") : "#8A8A8A",
                            border: `2px solid ${on ? (col === "ink" ? C.ink : C[col]) : C.line}`,
                            borderRadius: i % 2 ? "8px 16px 8px 16px" : "16px 8px 16px 8px" }}>{l}</button>
                      );
                    })}
                    {Object.entries(DOC_KINDS).map(([k, v], i) => {
                      if (!counts[k]) return null;
                      const on = docFilter === k;
                      return (
                        <button key={k} onClick={() => setDocFilter(k)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                          style={{ background: on ? C[v.color] : "#fff", color: on ? "#fff" : "#8A8A8A",
                            border: `2px solid ${on ? C[v.color] : C.line}`,
                            borderRadius: i % 2 ? "16px 8px 16px 8px" : "8px 16px 8px 16px" }}>
                          <ShapeIcon shape={v.shape} color={on ? "#ffffff" : C[v.color]} size={14} />
                          {v.label} {counts[k]}
                        </button>
                      );
                    })}
                  </div>

                  <label className="w-full py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    style={{ borderRadius: "24px 12px 24px 12px", border: `2.5px dashed #CFC7B8` }}>
                    <Upload size={22} strokeWidth={2.2} style={{ color: "#B0AA9E" }} />
                    <span className="text-sm font-bold" style={{ color: "#8A8A8A" }}>書類をアップロード</span>
                    <span className="text-[11px] font-bold" style={{ color: "#B0AA9E" }}>
                      メールの添付やチャンネルの共有からも入ります
                    </span>
                    <input type="file" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0]; if (!f) return;
                        update(active.id, (c) => ({ ...c, docs: [{
                          id: nid(), name: f.name, kind: "other",
                          size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
                          at: "2026/08/03", by: ME, pinned: false, note: "",
                        }, ...(c.docs || [])] }));
                        notify("書類を追加しました");
                      }} />
                  </label>

                  {shown.length === 0 && (
                    <div className="text-center py-10 space-y-2">
                      <ShapeIcon shape="blob" color="lime" size={52} face className="mx-auto" />
                      <p className="text-sm font-bold text-slate-400">書類はまだありません。</p>
                    </div>
                  )}

                  {shown.map((f, i) => {
                    const k = DOC_KINDS[f.kind] || DOC_KINDS.other;
                    const e = fileExt(f.name);
                    return (
                      <div key={f.id} className="bg-white p-3.5 flex gap-3 anim-item"
                        style={{ borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                          border: `2.5px solid ${f.pinned ? C.yellow : C.line}`, animationDelay: `${i * 40}ms` }}>
                        <button onClick={() => setDocSheet({ ...f, cid: active.id })} className="relative shrink-0">
                          <ShapeIcon shape={k.shape} color={EXT_COLOR[e] || k.color} size={46} />
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-white">
                            {e.toUpperCase()}
                          </span>
                        </button>
                        <button onClick={() => setDocSheet({ ...f, cid: active.id })} className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-extrabold leading-snug break-all">{f.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5"
                              style={{ background: SOFT[k.color], color: C[k.color], borderRadius: "10px 5px 10px 5px" }}>
                              {k.label}
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{f.size}</span>
                            <span className="text-[11px] font-bold" style={{ color: "#B0AA9E" }}>{f.at}</span>
                          </div>
                          {f.note && <div className="text-[11px] font-bold mt-1 leading-snug" style={{ color: "#6B6B6B" }}>{f.note}</div>}
                        </button>
                        <button onClick={() => toggleDoc(active.id, f.id)} aria-label="よく使う" className="shrink-0 self-start">
                          <Star size={18} strokeWidth={2.4} fill={f.pinned ? C.yellow : "none"}
                            style={{ color: f.pinned ? C.yellow : "#D6D0C4" }} />
                        </button>
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {tab === "contacts" && (
              <>
                <div className="text-sm text-slate-400">この会社の名刺 {active.contacts.length} 件</div>
                {active.contacts.map((c) => {
                  const isP = c.id === active.primaryContactId;
                  return (
                    <div key={c.id} className="bg-white p-3" style={{ borderRadius: 22, border: `2.5px solid ${isP ? C.yellow : C.line}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <ShapeIcon shape={isP ? "sun" : "blob"} color={isP ? "yellow" : "green"} size={38} />
                        <span className="text-sm font-bold">{c.name}</span>
                        {isP && <span className="text-[11px] font-bold px-2 py-1 flex items-center gap-1 shrink-0" style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "12px 6px 12px 6px" }}><Star size={10} fill="#9A6B00" strokeWidth={0} />窓口</span>}
                        <span className="ml-auto text-xs text-slate-400">{judgeRank(c.title).rank}</span>
                      </div>
                      <div className="text-sm text-slate-500">{c.dept} ／ {c.title}</div>
                      <div className="text-sm text-slate-400 truncate">{c.email}</div>
                      {c.email && c.email.includes("@") && gmail.connected && (
                        <button onClick={() => toggleWatch(c.id, c.name)}
                          className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold px-2.5 py-1"
                          style={{ background: isWatched(c.id) ? SOFT.green : "#F1EDE4",
                            color: isWatched(c.id) ? C.green : "#9A9A9A", borderRadius: "12px 6px 12px 6px" }}>
                          <Mail size={11} strokeWidth={2.8} />
                          {isWatched(c.id) ? "メール取り込み中" : "取り込みオフ"}
                        </button>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => openMail(active, c.id, null)}
                          className="flex-1 text-xs bg-slate-900 text-white rounded-xl py-1.5 flex items-center justify-center gap-1">
                          <Mail size={13} />メール
                        </button>
                        {!isP && (
                          <button onClick={() => { setField(active.id, "primaryContactId", c.id); notify(`${c.name} さんを窓口にしました`); }}
                            className="flex-1 text-xs border border-slate-300 rounded-xl py-1.5">窓口にする</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setScreen("scan")}
                  className="w-full border border-dashed border-slate-300 rounded-2xl py-2.5 text-xs text-slate-500 flex items-center justify-center gap-1">
                  <Camera size={14} />名刺をスキャンして追加
                </button>
              </>
            )}

            {tab === "tasks" && (
              <>
                <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>進捗</span>
                    <span className="text-violet-600 font-medium">{Math.round(((active.stage + 1) / stages.length) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden" style={{ background: "#EFEBE2", borderRadius: 999 }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${((active.stage + 1) / stages.length) * 100}%`, background: C.purple }} />
                  </div>
                  <div className="flex gap-1 overflow-x-auto">
                    {stages.map((s, i) => (
                      <button key={s} onClick={() => setStage(active.id, i)}
                        className={`text-xs py-1 px-2 rounded whitespace-nowrap ${i === active.stage ? "text-violet-600 font-medium bg-blue-50" : i < active.stage ? "text-slate-600" : "text-slate-300"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {active.tasks.length === 0 && <p className="text-center text-sm font-bold text-slate-400 py-6">タスクはまだありません。</p>}
                {active.tasks.map((t2, ti) => {
                  const target = active.contacts.find((x) => x.id === t2.contactId);
                  return taskRow(t2, active.id, taskScope === "person" && target ? `対象 ${target.name}` : null, ti);
                })}
                <button onClick={() => openTaskForm(active.id)}
                  style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px dashed #CFC7B8` }} className="w-full py-3 text-sm font-bold text-slate-500 flex items-center justify-center gap-1.5">
                  <Plus size={16} />タスクを追加
                </button>
              </>
            )}

            {tab === "mail" && (
              <>
                <button onClick={() => openMail(active, active.primaryContactId, null)}
                  style={{ background: C.purple, borderRadius: "24px 12px 24px 12px" }} className="w-full text-white py-3 text-sm font-bold flex items-center justify-center gap-2">
                  <ShapeIcon shape="burst" color="yellow" size={20} />AIで下書きしてメールを作成
                </button>
                {!gmail.connected ? (
                  <div className="text-center py-8 space-y-3">
                    <Inbox size={30} className="mx-auto text-slate-300" />
                    <p className="text-sm text-slate-500">Gmail を連携すると受信メールも<br />ここに集まります。</p>
                    <button onClick={() => setScreen("settings")} className="text-sm text-violet-600">連携する</button>
                  </div>
                ) : (active.mails || []).length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">この会社とのメールはまだありません。</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>会社ドメインで突き合わせ</span>
                      <button onClick={resync} className="flex items-center gap-1 text-violet-600">
                        <RefreshCw size={12} className={gmail.syncing ? "animate-spin" : ""} />同期
                      </button>
                    </div>
                    {active.mails.map((m) => (
                      <div key={m.id} style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-1 shrink-0" style={{ background: m.dir === "in" ? SOFT.green : SOFT.blue, color: m.dir === "in" ? C.green : C.blue, borderRadius: "12px 6px 12px 6px" }}>
                            {m.dir === "in" ? "受信" : "送信"}
                          </span>
                          <span className="text-base font-semibold flex-1 truncate">{m.subject}</span>
                          <span className="text-sm text-slate-400 shrink-0">{m.at}</span>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">{m.excerpt}</p>
                        {m.dir === "in" && !m.replied && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => {
                              update(active.id, (c) => ({
                                ...c,
                                tasks: [{ id: nid(), title: `返信: ${m.subject}`, due: addDays(1), assignee: c.ownerId, contactId: c.primaryContactId, pri: "高", done: false }, ...c.tasks],
                                messages: [...c.messages, { id: nid(), system: true, text: "メールからタスクを作成しました", at: "たった今" }],
                              }));
                              notify("タスクを作成しました"); setTab("tasks");
                            }} className="flex-1 text-xs border border-slate-300 rounded-xl py-1.5">タスクにする</button>
                            <button onClick={() => openMail(active, active.primaryContactId, m)}
                              className="flex-1 text-xs bg-slate-900 text-white rounded-xl py-1.5 flex items-center justify-center gap-1">
                              <ShapeIcon shape="burst" color="yellow" size={15} />AIで返信
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const channelBody = (c, embedded) => (
    <div className="flex flex-col h-full">
      {!embedded && (
        <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
          <button onClick={() => setScreen("channels")} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-1 truncate"><Hash size={15} className="text-slate-400 shrink-0" />{channelName(c)}</div>
            <div className="text-sm text-slate-400 truncate">窓口 {primary(c)?.name} ／ {stages[c.stage]}</div>
          </div>
        </div>
      )}
      <div className="bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-2 shrink-0">
        <div className="flex -space-x-1.5">{c.members.map((m) => <MemberDot key={m} id={m} />)}</div>
        <span className="text-sm text-slate-400">{c.members.length}人</span>
        <button onClick={() => setInviteFor(c.id)} className="ml-auto text-xs text-violet-600 flex items-center gap-1 border border-slate-200 rounded-full px-2.5 py-1">
          <UserPlus size={13} />招待
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {c.messages.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Hash size={28} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-400">#{channelName(c)} のはじまりです。</p>
          </div>
        )}
        {c.messages.map((m, mi) => m.system ? (
          <div key={m.id} className="flex items-center gap-2 anim-item" style={{ animationDelay: `${Math.min(mi, 8) * 40}ms` }}>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-sm text-slate-400 px-1 text-center">{m.text}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        ) : (
          <div key={m.id} className="flex gap-2.5 anim-item" style={{ animationDelay: `${Math.min(mi, 8) * 40}ms` }}>
            <MemberDot id={m.by} size={30} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">{user(m.by).name}</span>
                <span className="text-sm text-slate-400">{user(m.by).role}</span>
                <span className="text-sm text-slate-300 ml-auto shrink-0">{m.at}</span>
              </div>
              <div className="text-slate-800"><MessageText text={m.text} /></div>
            </div>
          </div>
        ))}
      </div>
      {mentionOpen && (
        <div className="bg-white border-t border-slate-200 px-3 py-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {c.members.map((m) => (
              <button key={m} onClick={() => { setChatInput((v) => `${v}@${user(m).name} `); setMentionOpen(false); }}
                className="text-xs bg-slate-100 rounded-full px-2.5 py-1">{user(m).name}</button>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 shrink-0">
        <button onClick={() => setMentionOpen((v) => !v)} className="text-slate-400 p-1" aria-label="メンション"><AtSign size={18} /></button>
        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(c.id)}
          placeholder="メッセージを入力" className="flex-1 px-4 py-2.5 text-sm font-medium outline-none min-w-0" style={{ background: "#F4F1EA", borderRadius: 999 }} />
        <button onClick={() => sendMessage(c.id)} className="w-9 h-9 flex items-center justify-center shrink-0" aria-label="送信" style={{ background: C.purple, borderRadius: "14px 7px 14px 7px" }}><Send size={16} className="text-white" strokeWidth={2.6} /></button>
      </div>
    </div>
  );

  const channelsScreen = () => {
    const dmUnread = totalDm();
    const grUnread = groups.reduce((n, g) => n + g.unread, 0);
    const coUnread = companies.reduce((n, c) => n + (c.unread || 0), 0);
    const TABS = [
      ["dm", "個人", "pink", dmUnread],
      ["group", "グループ", "purple", grUnread],
      ["company", "会社", "blue", coUnread],
      ["member", "メンバー", "green", 0],
    ];

    return (
      <>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <span className="relative inline-flex items-center justify-center">
            <ShapeIcon shape="flower" color="pink" size={44} />
            <span className="absolute text-white font-extrabold text-lg">#</span>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-extrabold leading-tight">チャンネル</div>
            <div className="text-xs font-bold" style={{ color: "#8A8A8A" }}>
              未読 <span style={{ color: C.red }}>{dmUnread + grUnread + coUnread}件</span>
            </div>
          </div>
          {chTab === "group" && (
            <button onClick={openGroupForm}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: C.purple, borderRadius: "22px 10px 22px 10px" }}>
              <Plus size={17} strokeWidth={3} />作成
            </button>
          )}
        </div>

        {/* 上タブ */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {TABS.map(([v, l, col, n], i) => {
            const on = chTab === v;
            return (
              <button key={v} onClick={() => setChTab(v)}
                className={`relative flex-1 text-xs font-bold py-2.5 px-2 shrink-0 ${on ? "anim-chip" : ""}`}
                style={{ background: on ? C[col] : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2.5px solid ${on ? C[col] : C.line}`,
                  borderRadius: i % 2 ? "10px 20px 10px 20px" : "20px 10px 20px 10px" }}>
                {l}
                {n > 0 && !on && (
                  <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center
                    text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                    style={{ background: C.red }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        <div key={chTab} className="px-4 pb-2 space-y-2.5 pane">

          {/* ── 個人 ── */}
          {chTab === "dm" && (
            <>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {team.filter((u) => u.status === "active" && u.id !== ME).map((u) => {
                  const d = dms.find((x) => x.with === u.id);
                  return (
                    <button key={u.id} onClick={() => { dmWith(u.id); setScreen("dm"); }}
                      className="shrink-0 flex flex-col items-center gap-1.5" style={{ width: 62 }}>
                      <span className="relative">
                        <MemberDot id={u.id} size={48} />
                        {d && d.unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white anim-badge"
                            style={{ background: C.red }}>{d.unread}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-center leading-tight truncate w-full">{u.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>

              {dms.filter((d) => d.messages.length > 0).length === 0 && (
                <div className="text-center py-10 space-y-3">
                  <ShapeIcon shape="cloud" color="lime" size={54} face className="mx-auto" />
                  <p className="text-sm font-bold text-slate-400">上のメンバーを選んで話しかけましょう。</p>
                </div>
              )}
              {dms.filter((d) => d.messages.length > 0).map((d, i) => {
                const u = user(d.with);
                const last = d.messages[d.messages.length - 1];
                const col = (u.av && u.av.color) || "purple";
                return (
                  <button key={d.id} onClick={() => { dmWith(d.with); setScreen("dm"); }}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 anim-item"
                    style={{ background: SOFT[col], borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px" }}>
                    <MemberDot id={u.id} size={42} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold truncate">{u.name}</div>
                      <div className="text-xs font-medium truncate" style={{ color: "#6B6B6B" }}>
                        {last.by === ME ? "自分: " : ""}{last.text}
                      </div>
                    </div>
                    {d.unread > 0 && (
                      <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: C.red, borderRadius: 999 }}>{d.unread}</span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* ── グループ ── */}
          {chTab === "group" && (
            <>
              {groups.length === 0 && (
                <div className="text-center py-10 space-y-3">
                  <ShapeIcon shape="cloud" color="lime" size={54} face className="mx-auto" />
                  <p className="text-sm font-bold text-slate-400">グループはまだありません。</p>
                </div>
              )}
              {groups.map((g, i) => {
                const last = [...g.messages].reverse().find((m) => !m.system);
                const col = g.color || "purple";
                const radii = ["28px 14px 28px 14px", "14px 28px 14px 28px", "24px 24px 10px 24px", "10px 24px 24px 24px"];
                return (
                  <button key={g.id} onClick={() => { setActiveGroup(g.id); setScreen("group"); setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, unread: 0 } : x))); }}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 anim-item"
                    style={{ background: SOFT[col], borderRadius: radii[i % 4], animationDelay: `${i * 45}ms` }}>
                    <ShapeIcon shape={g.shape || "flower"} color={col} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold truncate"># {g.name}</div>
                      <div className="text-xs font-medium truncate" style={{ color: "#6B6B6B" }}>
                        {last ? `${user(last.by).name}: ${last.text}` : "まだメッセージがありません"}
                      </div>
                    </div>
                    <div className="flex -space-x-1.5 shrink-0">{g.members.slice(0, 3).map((m) => <MemberDot key={m} id={m} size={24} />)}</div>
                    {g.unread > 0 && (
                      <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: C.red, borderRadius: 999 }}>{g.unread}</span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* ── 会社 ── */}
          {chTab === "company" && withTier.map((c, i) => {
            const last = [...c.messages].reverse().find((m) => !m.system);
            const a2 = companyArt(c);
            const radii = ["28px 14px 28px 14px", "14px 28px 14px 28px", "24px 24px 10px 24px", "10px 24px 24px 24px"];
            return (
              <button key={c.id} onClick={() => openChannel(c.id)}
                className="w-full text-left flex items-center gap-3 px-3 py-3 anim-item"
                style={{ background: SOFT[a2.color] || SOFT.purple, borderRadius: radii[i % 4], animationDelay: `${i * 45}ms` }}>
                <CompanyAvatar co={c} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold truncate"># {channelName(c)}</span>
                    <TierChip tier={c.tier} small />
                  </div>
                  <div className="text-xs font-medium truncate" style={{ color: "#6B6B6B" }}>
                    {last ? `${user(last.by).name}: ${last.text}` : "まだメッセージがありません"}
                  </div>
                </div>
                <div className="flex -space-x-1.5 shrink-0">{c.members.slice(0, 3).map((m) => <MemberDot key={m} id={m} size={24} />)}</div>
                {c.unread > 0 && (
                  <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: C.red, borderRadius: 999 }}>{c.unread}</span>
                )}
              </button>
            );
          })}

          {/* ── メンバー表 ── */}
          {chTab === "member" && (
            <>
              <p className="text-[11px] font-bold px-1" style={{ color: "#8A8A8A" }}>
                タップするとプロフィールが開きます。
              </p>
              {team.map((u, i) => {
                const col = (u.av && u.av.color) || "purple";
                const openT = companies.flatMap((c) => c.tasks).filter((t) => t.assignee === u.id && !t.done).length;
                const owns = companies.filter((c) => c.ownerId === u.id).length;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-3 bg-white anim-item"
                    style={{ borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                      border: `2.5px solid ${C.line}`, animationDelay: `${i * 45}ms` }}>
                    <button onClick={() => setViewProfile(u.id)} className="shrink-0">
                      <MemberDot id={u.id} size={46} />
                    </button>
                    <button onClick={() => setViewProfile(u.id)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold truncate">{u.name}</span>
                        {u.id === ME && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                            style={{ background: "#F1EDE4", color: "#7A7A7A", borderRadius: "8px 4px 8px 4px" }}>自分</span>
                        )}
                        {u.status === "invited" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                            style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "8px 4px 8px 4px" }}>ログイン待ち</span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: C[col] }}>{u.role}</div>
                      {u.status === "active" && (
                        <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                          担当 {owns}社 ・ 未完了 {openT}件
                        </div>
                      )}
                    </button>
                    {u.id !== ME && u.status === "active" && (
                      <button onClick={() => { dmWith(u.id); setScreen("dm"); }}
                        className="w-10 h-10 flex items-center justify-center shrink-0"
                        style={{ background: SOFT[col], borderRadius: "16px 8px 16px 8px" }} aria-label="1対1で話す">
                        <MessageSquare size={17} strokeWidth={2.6} style={{ color: C[col] }} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button onClick={() => setScreen("settings")}
                className="w-full py-3 text-sm font-bold flex items-center justify-center gap-1.5"
                style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
                <UserPlus size={16} strokeWidth={2.8} />メンバーを招待する
              </button>
            </>
          )}
        </div>
      </>
    );
  };

  const dmScreen = () => {
    const d = dms.find((x) => x.id === activeDm);
    if (!d) return null;
    const u = user(d.with);
    const col = (u.av && u.av.color) || "purple";
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 pt-1 pb-2 shrink-0">
          <div className="px-4 py-3.5" style={{ background: C[col], borderRadius: "26px 26px 14px 26px" }}>
            <div className="flex items-center gap-2.5">
              <button onClick={() => setScreen("channels")} className="text-white -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
              <button onClick={() => setViewProfile(u.id)} className="shrink-0">
                <MemberDot id={u.id} size={34} />
              </button>
              <button onClick={() => setViewProfile(u.id)} className="flex-1 min-w-0 text-left">
                <div className="text-white font-extrabold text-lg truncate">{u.name}</div>
                <div className="text-[11px] font-bold text-white opacity-80 truncate">{u.role}</div>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-white shrink-0"
                style={{ color: C[col], borderRadius: "12px 6px 12px 6px" }}>1対1</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {d.messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <MemberDot id={u.id} size={60} />
              <p className="text-sm font-bold text-slate-400">
                {u.name} さんとの会話はまだありません。
              </p>
            </div>
          )}
          {d.messages.map((m, mi) => {
            const mine = m.by === ME;
            return (
              <div key={m.id} className={`flex gap-2.5 anim-item ${mine ? "flex-row-reverse" : ""}`}
                style={{ animationDelay: `${Math.min(mi, 8) * 40}ms` }}>
                {!mine && (
                  <button onClick={() => setViewProfile(m.by)} className="shrink-0 self-end">
                    <MemberDot id={m.by} size={30} />
                  </button>
                )}
                <div className={`max-w-[74%] px-3.5 py-2.5 ${mine ? "text-white" : ""}`}
                  style={{
                    background: mine ? C.purple : "#fff",
                    border: mine ? "none" : `2.5px solid ${C.line}`,
                    borderRadius: mine ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                  }}>
                  <div className="text-sm font-medium leading-relaxed break-words">
                    <MessageText text={m.text} />
                  </div>
                </div>
                <span className="text-[10px] font-bold self-end shrink-0" style={{ color: "#B0AA9E" }}>{m.at}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white border-t px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderColor: C.line }}>
          <button onClick={() => setMentionOpen((v) => !v)} className="text-slate-400 p-1" aria-label="メンション"><AtSign size={18} /></button>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendDm(d.id)}
            placeholder="メッセージを入力"
            className="flex-1 px-4 py-2.5 text-sm font-medium outline-none min-w-0"
            style={{ background: "#F4F1EA", borderRadius: 999 }} />
          <button onClick={() => sendDm(d.id)} className="w-9 h-9 flex items-center justify-center shrink-0" aria-label="送信"
            style={{ background: C.purple, borderRadius: "14px 7px 14px 7px" }}>
            <Send size={16} className="text-white" strokeWidth={2.6} />
          </button>
        </div>
      </div>
    );
  };

  const groupScreen = () => {
    const g = groups.find((x) => x.id === activeGroup);
    if (!g) return null;
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 pt-1 pb-2 shrink-0">
          <div className="px-4 py-3.5" style={{ background: C[g.color] || C.purple, borderRadius: "26px 26px 14px 26px" }}>
            <div className="flex items-center gap-2">
              <button onClick={() => setScreen("channels")} className="text-white -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
              <span className="bg-white rounded-full p-1 shrink-0">
                <ShapeIcon shape={g.shape || "flower"} color={g.color || "purple"} size={26} />
              </span>
              <span className="text-white font-extrabold text-lg truncate flex-1">{g.name}</span>
              <button onClick={() => setInviteFor(`g:${g.id}`)}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-white shrink-0"
                style={{ color: C[g.color] || C.purple, borderRadius: "999px" }}>
                <UserPlus size={13} strokeWidth={2.8} />招待
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 flex items-center gap-2 shrink-0">
          <div className="flex -space-x-1.5">
            {g.members.map((m) => (
              <button key={m} onClick={() => setViewProfile(m)} aria-label={`${user(m).name} のプロフィール`}>
                <MemberDot id={m} size={28} />
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-400">{g.members.length}人</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {g.messages.map((m, mi) => m.system ? (
            <div key={m.id} className="flex items-center gap-2 anim-item" style={{ animationDelay: `${Math.min(mi, 8) * 40}ms` }}>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-sm text-slate-400 px-1 text-center">{m.text}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5 anim-item" style={{ animationDelay: `${Math.min(mi, 8) * 40}ms` }}>
              <button onClick={() => setViewProfile(m.by)} aria-label={`${user(m.by).name} のプロフィール`}>
                <MemberDot id={m.by} size={30} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{user(m.by).name}</span>
                  <span className="text-sm text-slate-400">{user(m.by).role}</span>
                  <span className="text-sm text-slate-300 ml-auto shrink-0">{m.at}</span>
                </div>
                <div className="text-slate-800"><MessageText text={m.text} /></div>
              </div>
            </div>
          ))}
        </div>

        {mentionOpen && (
          <div className="bg-white border-t border-slate-200 px-3 py-2 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {g.members.map((m) => (
                <button key={m} onClick={() => { setChatInput((v) => `${v}@${user(m).name} `); setMentionOpen(false); }}
                  className="text-sm bg-slate-100 rounded-full px-2.5 py-1">{user(m).name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 shrink-0">
          <button onClick={() => setMentionOpen((v) => !v)} className="text-slate-400 p-1" aria-label="メンション"><AtSign size={18} /></button>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendGroupMessage(g.id)}
            placeholder="メッセージを入力" className="flex-1 px-4 py-2.5 text-sm font-medium outline-none min-w-0" style={{ background: "#F4F1EA", borderRadius: 999 }} />
          <button onClick={() => sendGroupMessage(g.id)} className="w-9 h-9 flex items-center justify-center shrink-0" aria-label="送信" style={{ background: C.purple, borderRadius: "14px 7px 14px 7px" }}><Send size={16} className="text-white" strokeWidth={2.6} /></button>
        </div>
      </div>
    );
  };

  const groupSheet = () => {
    if (!groupForm) return null;
    const EMOJI = ["💬", "📣", "☕️", "🚀", "📊", "🎯", "🛠", "🎨"];
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setGroupForm(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }} className="relative w-full bg-white p-4 space-y-3 anim-sheet max-h-full overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">チャンネルを作成</span>
            <button onClick={() => setGroupForm(null)} className="text-slate-400"><X size={20} /></button>
          </div>

          <div className="flex items-center gap-3 p-3"
            style={{ background: SOFT[groupForm.color], borderRadius: "26px 13px 26px 13px" }}>
            <ShapeIcon shape={groupForm.shape} color={groupForm.color} size={44} />
            <span className="text-base font-extrabold truncate">
              {groupForm.name.trim() ? `# ${groupForm.name}` : "# チャンネル名"}
            </span>
          </div>

          <input value={groupForm.name} autoFocus
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            placeholder="チャンネル名（例：営業チーム）"
            className="w-full text-base font-medium px-3.5 py-3 outline-none" style={{ background: "#F7F4ED", borderRadius: 18 }} />

          <div>
            <div className="text-sm text-slate-400 mb-2">アイコン</div>
            <div className="grid grid-cols-6 gap-2">
              {GROUP_ICONS.map((ic) => {
                const on = sameIcon(groupForm, ic);
                return (
                  <button key={`${ic.shape}-${ic.color}`}
                    onClick={() => setGroupForm({ ...groupForm, shape: ic.shape, color: ic.color })}
                    aria-label={ic.shape}
                    className="flex items-center justify-center py-2"
                    style={{
                      background: on ? SOFT[ic.color] : "#fff",
                      border: `2.5px solid ${on ? C[ic.color] : C.line}`,
                      borderRadius: on ? "16px 8px 16px 8px" : 14,
                      transition: "border-radius .26s cubic-bezier(.34,1.56,.64,1), background .2s ease",
                    }}>
                    <span style={{ display: "inline-flex", transform: on ? "scale(1.12)" : "scale(1)",
                      transition: "transform .26s cubic-bezier(.34,1.56,.64,1)" }}>
                      <ShapeIcon shape={ic.shape} color={ic.color} size={26} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-1.5">メンバー（{groupForm.members.length}人）</div>
            <div className="space-y-1">
              {team.filter((u) => u.status === "active").map((u) => {
                const on = groupForm.members.includes(u.id);
                return (
                  <button key={u.id} disabled={u.id === ME}
                    onClick={() => setGroupForm({ ...groupForm,
                      members: on ? groupForm.members.filter((m) => m !== u.id) : [...groupForm.members, u.id] })}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl disabled:opacity-60">
                    <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ borderRadius: 7, background: on ? C.purple : "#fff", border: `2.5px solid ${on ? C.purple : "#D6D0C4"}` }}>
                      {on && <Check size={12} className="text-white anim-check" strokeWidth={3} />}
                    </span>
                    <MemberDot id={u.id} size={32} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm truncate">{u.name}{u.id === ME && "（自分）"}</div>
                      <div className="text-sm text-slate-400 truncate">{u.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={saveGroup} disabled={!groupForm.name.trim()}
            style={{ background: C.purple, borderRadius: "24px 12px 24px 12px" }} className="w-full text-white py-3.5 text-sm font-bold disabled:opacity-40">
            作成する
          </button>
        </div>
      </div>
    );
  };

  /* ══════════════ タスク作成 ══════════════ */
  const openTaskForm = (companyId, presetDate) => {
    const co = companies.find((c) => c.id === companyId) || companies[0];
    setTaskForm({
      companyId: co.id, title: "", assignee: co.ownerId,
      due: presetDate ? `${presetDate}T10:00` : addDays(3),
      pri: "中", contactId: co.primaryContactId, pushToCal: true, share: "assignee",
    });
  };

  const saveTask = () => {
    const f = taskForm;
    if (!f.title.trim()) return;
    const sh = SHARE[f.share] || SHARE.assignee;
    if (f.companyId === "personal") {
      setPersonal((ps) => [{ id: nid(), title: f.title.trim(), due: f.due, assignee: ME, pri: f.pri, done: false, share: f.share, subs: [] }, ...ps]);
      notify(f.share === "team" ? "追加し、チーム全員のカレンダーに入れました" : "自分のTODOに追加しました");
      setTaskForm(null);
      return;
    }
    update(f.companyId, (c) => ({
      ...c,
      tasks: [{ id: nid(), title: f.title.trim(), due: f.due, assignee: f.assignee, contactId: f.contactId, pri: f.pri, done: false, share: f.share, subs: [] }, ...c.tasks],
      messages: [...c.messages, { id: nid(), system: true,
        text: `タスク「${f.title.trim()}」を追加しました（期限 ${fmtDue(f.due)} ／ ${sh.cal}）`, at: "たった今" }],
    }));
    notify(
      f.share === "team" ? "追加し、チーム全員のカレンダーに反映しました"
      : f.share === "assignee" ? `追加し、${user(f.assignee).name} さんのカレンダーに反映しました`
      : "自分のカレンダーに追加しました");
    setTaskForm(null);
  };

  const taskSheet = () => {
    if (!taskForm) return null;
    const co = companies.find((c) => c.id === taskForm.companyId) || null;
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setTaskForm(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }} className="relative w-full bg-white p-4 space-y-3 anim-sheet max-h-full overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">タスクを追加</span>
            <button onClick={() => setTaskForm(null)} className="text-slate-400"><X size={20} /></button>
          </div>

          <input value={taskForm.title} autoFocus
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            placeholder="やること（例：見積書を送付する）"
            className="w-full text-base font-medium px-3.5 py-3 outline-none" style={{ background: "#F7F4ED", borderRadius: 18 }} />

          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white">
            <Field label="会社">
              <select value={taskForm.companyId}
                onChange={(e) => {
                  if (e.target.value === "personal") { setTaskForm({ ...taskForm, companyId: "personal", assignee: ME, contactId: "" }); return; }
                  const c = companies.find((x) => x.id === e.target.value);
                  setTaskForm({ ...taskForm, companyId: c.id, assignee: c.ownerId, contactId: c.primaryContactId });
                }} className={inputCls}>
                <option value="personal">自分のTODO（会社なし）</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={taskForm.companyId === "personal" ? "担当（自分）" : "担当"}>
              <select value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })} className={inputCls}>
                {TEAM.map((u) => <option key={u.id} value={u.id}>{u.name}（{u.role}）</option>)}
              </select>
            </Field>
            {co && (
              <Field label="対象者">
                <select value={taskForm.contactId} onChange={(e) => setTaskForm({ ...taskForm, contactId: e.target.value })} className={inputCls}>
                  {co.contacts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="期限">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="date" value={dPart(taskForm.due)}
                    onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value + (tPart(taskForm.due) ? `T${tPart(taskForm.due)}` : "") })}
                    className="flex-1 text-sm font-medium bg-white px-3 py-2.5 outline-none min-w-0"
                    style={{ borderRadius: 14, border: `2px solid ${C.line}` }} />
                  <input type="time" value={tPart(taskForm.due)}
                    onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value ? `${dPart(taskForm.due)}T${e.target.value}` : dPart(taskForm.due) })}
                    className="text-sm font-medium bg-white px-3 py-2.5 outline-none shrink-0"
                    style={{ borderRadius: 14, border: `2px solid ${tPart(taskForm.due) ? C.purple : C.line}`, width: 106 }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["09:00", "10:00", "13:00", "15:00", "17:00"].map((t) => {
                    const on = tPart(taskForm.due) === t;
                    return (
                      <button key={t} onClick={() => setTaskForm({ ...taskForm, due: `${dPart(taskForm.due)}T${t}` })}
                        className={`text-xs font-bold px-2.5 py-1.5 ${on ? "anim-chip" : ""}`}
                        style={{ background: on ? C.purple : "#fff", color: on ? "#fff" : "#6B6B6B",
                          border: `2px solid ${on ? C.purple : C.line}`, borderRadius: "12px 6px 12px 6px" }}>{t}</button>
                    );
                  })}
                  {tPart(taskForm.due) && (
                    <button onClick={() => setTaskForm({ ...taskForm, due: dPart(taskForm.due) })}
                      className="text-xs font-bold px-2.5 py-1.5"
                      style={{ background: "#fff", color: "#9A9A9A", border: `2px solid ${C.line}`, borderRadius: "12px 6px 12px 6px" }}>
                      時間なし
                    </button>
                  )}
                </div>
              </div>
            </Field>
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-1.5">優先度</div>
            <div className="flex gap-1 p-1" style={{ background: "#F1EDE4", borderRadius: 20 }}>
              {["高", "中", "低"].map((v) => (
                <button key={v} onClick={() => setTaskForm({ ...taskForm, pri: v })}
                  className="flex-1 text-sm font-bold py-2.5 flex items-center justify-center gap-1.5"
                  style={{ background: taskForm.pri === v ? C[PRI_SHAPE[v].c] : "transparent", color: taskForm.pri === v ? "#fff" : "#8A8A8A", borderRadius: "16px 8px 16px 8px" }}>{v}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-1.5">カレンダーの共有先</div>
            <div className="space-y-1.5">
              {Object.entries(SHARE).map(([k, v]) => {
                const on = taskForm.share === k;
                return (
                  <button key={k} onClick={() => setTaskForm({ ...taskForm, share: k })}
                    className="w-full flex items-center gap-3 p-2.5 text-left"
                    style={{ background: on ? SOFT[v.color] : "#fff", borderRadius: "18px 9px 18px 9px",
                      border: `2.5px solid ${on ? C[v.color] : C.line}` }}>
                    <ShapeIcon shape={v.icon} color={v.color} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{v.label}</div>
                      <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                        {k === "self" && "自分のカレンダーだけに入ります"}
                        {k === "assignee" && `${user(taskForm.assignee).name} さんのカレンダーに入ります`}
                        {k === "team" && "全員のカレンダーに自動で入ります"}
                      </div>
                    </div>
                    {on && (
                      <span className="w-6 h-6 flex items-center justify-center shrink-0"
                        style={{ background: C[v.color], borderRadius: 9 }}>
                        <Check size={14} className="text-white anim-check" strokeWidth={3.4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={() => setTaskForm({ ...taskForm, pushToCal: !taskForm.pushToCal })}
            className="w-full flex items-center gap-2.5 text-left py-1">
            <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ borderRadius: 7, background: taskForm.pushToCal ? C.purple : "#fff", border: `2.5px solid ${taskForm.pushToCal ? C.purple : "#D6D0C4"}` }}>
              {taskForm.pushToCal && <Check size={13} className="text-white anim-check" strokeWidth={3} />}
            </span>
            <span className="text-sm text-slate-600">
              期限を Google カレンダーにも登録する
              {!gcal.connected && <span className="text-slate-400">（未連携）</span>}
            </span>
          </button>

          <button onClick={saveTask} disabled={!taskForm.title.trim()}
            style={{ background: C.purple, borderRadius: "24px 12px 24px 12px" }} className="w-full text-white py-3.5 text-sm font-bold disabled:opacity-40">
            追加する
          </button>
        </div>
      </div>
    );
  };

  /* ══════════════ カレンダー ══════════════ */
  const calendarView = () => {
    const { y, m } = calCursor;
    const first = new Date(y, m, 1);
    const total = new Date(y, m + 1, 0).getDate();
    const lead = first.getDay();
    const personalCo = { id: "personal", name: "自分のTODO", tier: "C" };
    const allTasks = [...withTier.flatMap((c) => c.tasks.map((t) => ({ ...t, co: c }))), ...personal.map((t) => ({ ...t, co: personalCo }))];
    const allEvents = withTier.flatMap((c) => (c.events || []).map((e) => ({ ...e, co: c })));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(toISO(new Date(y, m, d)));

    const allSubs = allTasks.flatMap((t) => (t.subs || []).map((sb) => ({ ...sb, parent: t })));
    const daySubs = (iso) => allSubs.filter((sb) => atDate(sb.at) === iso).sort((a, b) => (a.at < b.at ? -1 : 1));
    const inScope = (t) => {
      if (calScope === "all") return true;
      if (calScope === "team") return t.share === "team";
      return t.share === "team" || t.assignee === ME || (t.co && t.co.id === "personal");
    };
    const dayTasks = (iso) => allTasks.filter((t) => dPart(t.due) === iso && inScope(t))
      .sort((a, b) => (tPart(a.due) || "99:99").localeCompare(tPart(b.due) || "99:99"));
    const dayEvents = (iso) => allEvents.filter((e) => e.iso === iso && calScope !== "team");
    const pickTasks = dayTasks(calPick);
    const pickEvents = dayEvents(calPick);
    const pickSubs = daySubs(calPick);

    return (
      <div className="px-3 space-y-3">
        <div className="flex gap-1.5">
          {[["all", "全員", "purple"], ["mine", "自分", "blue"], ["team", "チーム共有", "green"]].map(([v, l, col], i) => {
            const on = calScope === v;
            return (
              <button key={v} onClick={() => setCalScope(v)}
                className={`flex-1 text-xs font-bold py-2.5 ${on ? "anim-chip" : ""}`}
                style={{ background: on ? C[col] : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2.5px solid ${on ? C[col] : C.line}`,
                  borderRadius: i % 2 ? "10px 20px 10px 20px" : "20px 10px 20px 10px" }}>{l}</button>
            );
          })}
        </div>

        <div style={{ borderRadius: 26, border: `2.5px solid ${C.line}` }} className="bg-white p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => setCalCursor(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}
              className="text-slate-400 p-1" aria-label="前の月"><ChevronLeft size={20} /></button>
            <span className="text-base font-extrabold">{y}年 {m + 1}月</span>
            <button onClick={() => setCalCursor(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}
              className="text-slate-400 p-1" aria-label="次の月"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WD.map((w, i) => (
              <div key={w} className={`text-center text-xs py-1 ${i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`b${i}`} />;
              const d = fromISO(iso);
              const ts = dayTasks(iso);
              const es = dayEvents(iso);
              const sbs = daySubs(iso);
              const on = calPick === iso;
              const today = iso === toISO(BASE);
              return (
                <button key={iso} onClick={() => setCalPick(iso)}
                  className="flex flex-col items-center gap-1 py-1.5 rounded-xl">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200
                    ${on ? "text-white font-bold" : today ? "font-bold" : "text-slate-700"}`} style={{ background: on ? C.purple : today ? SOFT.purple : "transparent", color: on ? "#fff" : today ? C.purple : undefined }}>
                    {d.getDate()}
                  </span>
                  <span className="flex gap-0.5 h-1.5">
                    {es.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {ts.slice(0, 2).map((t) => (
                      <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${t.done ? "bg-slate-200" : PRI_DOT[t.pri]}`} />
                    ))}
                    {sbs.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ borderRadius: 26, border: `2.5px solid ${C.line}` }} className="bg-white p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">{fmtDue(calPick)}</span>
            <button onClick={() => openTaskForm(companies[0].id, calPick)}
              className="text-sm font-bold flex items-center gap-1" style={{ color: C.purple }}>
              <Plus size={15} strokeWidth={3} />この日に追加
            </button>
          </div>
          {pickEvents.length === 0 && pickTasks.length === 0 && pickSubs.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">この日の予定とタスクはありません。</p>
          )}
          {pickEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-2.5 anim-item">
              <span className="w-11 shrink-0 text-right text-xs font-extrabold" style={{ color: C.purple }}>
                {(e.when.match(/(\d{1,2}:\d{2})/) || ["", ""])[1] || "終日"}
              </span>
              <ShapeIcon shape="drop" color="purple" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{e.co.name} 打合せ</div>
                <div className="text-sm text-slate-400 truncate">{e.when} ・ {e.format}</div>
              </div>
            </div>
          ))}
          {pickSubs.map((sb) => (
            <div key={sb.id} className="flex items-center gap-2.5 anim-item">
              <span className="w-11 shrink-0 text-right text-xs font-extrabold">{tPart(sb.at) || "終日"}</span>
              <button onClick={() => toggleSub(sb.parent.co.id, sb.parent.id, sb.id)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${sb.done ? "bg-emerald-500 border-emerald-500" : "border-violet-300"}`}>
                {sb.done && <Check size={12} className="text-white anim-check" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${sb.done ? "line-through text-slate-400" : "font-medium"} truncate`}>{sb.text}</div>
                <div className="text-sm text-slate-400 truncate">
                  {sb.at.split("T")[1]} ・ {sb.parent.title}
                </div>
              </div>
            </div>
          ))}
          {pickTasks.map((t) => {
            const time = tPart(t.due);
            const pd = PRI_SHAPE[t.pri] || PRI_SHAPE["中"];
            return (
              <button key={t.id}
                onClick={() => { if (t.co.id !== "personal") open(t.co.id, "tasks"); else { setScreen("tasks"); setTaskView("list"); } }}
                className="w-full flex items-stretch gap-2.5 text-left anim-item">
                <span className="w-11 shrink-0 pt-0.5 text-right text-xs font-extrabold"
                  style={{ color: time ? C.ink : "#C8C2B6" }}>{time || "終日"}</span>
                <span className="w-1 rounded-full shrink-0" style={{ background: t.done ? "#DDD8CE" : C[pd.c] }} />
                <span className="flex-1 min-w-0 pb-1">
                  <span className={`block text-sm ${t.done ? "line-through text-slate-400" : "font-bold"} truncate`}>{t.title}</span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <MemberDot id={t.assignee} size={17} />
                    <span className="text-[11px] font-bold truncate" style={{ color: "#8A8A8A" }}>{t.co.name}</span>
                    {t.share === "team" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                        style={{ background: SOFT.purple, color: C.purple, borderRadius: "8px 4px 8px 4px" }}>共有</span>
                    )}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 self-center" style={{ color: "#C8C2B6" }} strokeWidth={2.6} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const MEMO_COLORS = ["yellow", "pink", "blue", "green", "orange", "purple"];

  const saveMemo = () => {
    const d = memoDraft;
    if (!d || !d.text.trim()) { setMemoDraft(null); return; }
    if (d.id) {
      setMemos((ms) => ms.map((m) => (m.id === d.id ? { ...m, text: d.text.trim(), color: d.color } : m)));
      notify("メモを更新しました");
    } else {
      setMemos((ms) => [{ id: nid(), text: d.text.trim(), color: d.color, pinned: false, at: "たった今" }, ...ms]);
      notify("メモを追加しました");
    }
    setMemoDraft(null);
  };
  const removeMemo = (id) => { setMemos((ms) => ms.filter((m) => m.id !== id)); notify("メモを削除しました"); };
  const pinMemo = (id) => setMemos((ms) => ms.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)));
  const memoToTask = (m) => {
    setMemoDraft(null);
    const co = companies[0];
    setTaskForm({
      companyId: "personal", title: m.text.split("\n")[0].slice(0, 40),
      assignee: ME, due: `${addDays(3)}T10:00`, pri: "中", contactId: "", pushToCal: true,
    });
  };


  const taskRow = (t, cid, sub, idx = 0) => {
    const expanded = openTask === t.id;
    const subs = t.subs || [];
    const doneCount = subs.filter((x) => x.done).length;
    const pd = PRI_SHAPE[t.pri] || PRI_SHAPE["中"];
    const paper = t.done ? "#F3F1EB" : SOFT[pd.c];
    return (
      <div key={t.id} className="anim-item"
        style={{
          background: paper,
          borderRadius: idx % 2 ? "28px 11px 28px 11px" : "11px 28px 11px 28px",
          boxShadow: expanded ? "0 8px 20px rgba(20,20,20,.11)" : "0 3px 10px rgba(20,20,20,.07)",
          transition: "box-shadow .3s ease, background .3s ease",
        }}>
        <div className="p-3.5 flex items-start gap-3">
          <button onClick={() => toggleTask(cid, t.id)}
            className="w-7 h-7 mt-0.5 flex items-center justify-center shrink-0"
            style={{ borderRadius: 10, background: t.done ? C.green : "#fff",
              border: `2.5px solid ${t.done ? C.green : "#fff"}`, boxShadow: "0 1px 3px rgba(20,20,20,.1)" }}>
            {t.done && <Check size={16} className="text-white anim-check" strokeWidth={3.4} />}
          </button>

          <button onClick={() => { setOpenTask(expanded ? null : t.id); setSubInput({ text: "", at: "" }); }}
            className="flex-1 min-w-0 text-left">
            <div className={`text-base leading-snug ${t.done ? "line-through opacity-50" : "font-extrabold"}`}>
              {t.title}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold" style={{ color: "#6B6B6B" }}>
              <Clock size={11} strokeWidth={2.6} />{fmtDue(t.due)}
              <span style={{ color: "rgba(0,0,0,.2)" }}>|</span>{user(t.assignee).name}
              {t.share === "team" && (
                <span className="px-1.5 py-0.5 bg-white shrink-0"
                  style={{ color: C.purple, borderRadius: "8px 4px 8px 4px" }}>共有</span>
              )}
              {sub && <><span style={{ color: "rgba(0,0,0,.2)" }}>|</span>{sub}</>}
            </div>
          </button>

          <span className="flex flex-col items-center gap-1 shrink-0">
            <PriorityBadge pri={t.pri} size={30} />
            <ChevronRight size={14} strokeWidth={2.8}
              style={{ color: "rgba(0,0,0,.28)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .28s cubic-bezier(.22,1,.36,1)" }} />
          </span>
        </div>

        {subs.length > 0 && (
          <div className="px-3.5 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.75)", borderRadius: 999 }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(doneCount / subs.length) * 100}%`, background: C[pd.c] }} />
              </div>
              <span className="text-[11px] font-extrabold shrink-0" style={{ color: C[pd.c] }}>
                {doneCount}/{subs.length}
              </span>
            </div>
          </div>
        )}

        {expanded && (
          <div className="px-3.5 pb-3.5 space-y-2 anim-fade">
            <div style={{ borderTop: `2px dashed rgba(0,0,0,.12)` }} />
            {subs.map((sb) => (
              <div key={sb.id} className="flex items-start gap-2.5 pt-0.5">
                <button onClick={() => toggleSub(cid, t.id, sb.id)}
                  className="w-5 h-5 mt-0.5 flex items-center justify-center shrink-0"
                  style={{ borderRadius: 7, background: sb.done ? C.green : "#fff", border: `2.5px solid ${sb.done ? C.green : "#fff"}` }}>
                  {sb.done && <Check size={12} className="text-white anim-check" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${sb.done ? "line-through opacity-45" : "font-medium"}`}>{sb.text}</div>
                  {sb.at && (
                    <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5" style={{ color: "#7A7A7A" }}>
                      <Clock size={10} strokeWidth={2.6} />{fmtAt(sb.at)}
                    </div>
                  )}
                </div>
                <button onClick={() => removeSub(cid, t.id, sb.id)} className="shrink-0 mt-0.5"
                  style={{ color: "rgba(0,0,0,.25)" }}><X size={15} /></button>
              </div>
            ))}

            <div className="p-2.5 space-y-2" style={{ background: "rgba(255,255,255,.72)", borderRadius: 16 }}>
              <input value={subInput.text} onChange={(e) => setSubInput({ ...subInput, text: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addSub(cid, t.id)}
                placeholder="題名（例：価格表を差し替える）"
                className="w-full text-sm font-medium bg-white px-3 py-2.5 outline-none min-w-0"
                style={{ borderRadius: 12, border: `2px solid rgba(0,0,0,.06)` }} />
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={subInput.at}
                  onChange={(e) => setSubInput({ ...subInput, at: e.target.value })}
                  className="flex-1 text-sm font-medium bg-white px-3 py-2.5 outline-none min-w-0"
                  style={{ borderRadius: 12, border: `2px solid rgba(0,0,0,.06)` }} />
                <button onClick={() => addSub(cid, t.id)} disabled={!subInput.text.trim()}
                  className="text-white px-3.5 py-2.5 text-sm font-bold shrink-0 disabled:opacity-40"
                  style={{ background: C.ink, borderRadius: "14px 7px 14px 7px" }}>追加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const personalCard = () => {
    const openP = personal.filter((t) => !t.done);
    return (
      <div className="px-4 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-base font-extrabold">自分のTODO</span>
          <ShapeIcon shape="sun" color="yellow" size={20} />
          <span className="ml-auto text-xs font-bold text-slate-400">{openP.length} 件</span>
        </div>
        {personal.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">会社に紐づかないTODOはありません。</p>
        )}
        {personal.map((t, i) => taskRow(t, "personal", null, i))}
      </div>
    );
  };

  const memoView = () => {
    const sorted = [...memos].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return (
      <div className="px-4 pb-2 space-y-3">
        <button onClick={() => setMemoDraft({ id: null, text: "", color: "yellow" })}
          className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-1.5"
          style={{ borderRadius: "24px 12px 24px 12px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
          <Plus size={17} strokeWidth={2.8} />メモを書く
        </button>

        {sorted.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <ShapeIcon shape="cloud" color="lime" size={56} face className="mx-auto" />
            <p className="text-sm font-bold text-slate-400">メモはまだありません。</p>
          </div>
        )}

        {sorted.map((m, i) => (
          <div key={m.id} className="relative p-3.5 anim-item"
            style={{
              background: SOFT[m.color] || SOFT.yellow,
              borderRadius: i % 2 ? "26px 10px 26px 10px" : "10px 26px 10px 26px",
              boxShadow: "0 3px 10px rgba(20,20,20,.07)",
            }}>
            {m.pinned && (
              <span className="absolute" style={{ top: -10, right: 18 }}>
                <ShapeIcon shape="burst" color={m.color === "yellow" ? "red" : "yellow"} size={26} />
              </span>
            )}
            <button onClick={() => setMemoDraft({ id: m.id, text: m.text, color: m.color })}
              className="w-full text-left">
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
            </button>
            <div className="flex items-center gap-2 mt-3 pt-2.5" style={{ borderTop: `2px dashed rgba(0,0,0,.1)` }}>
              <span className="text-[11px] font-bold" style={{ color: "#7A7A7A" }}>{m.at}</span>
              <button onClick={() => pinMemo(m.id)} className="ml-auto text-[11px] font-bold px-2.5 py-1 bg-white"
                style={{ borderRadius: "12px 6px 12px 6px", color: m.pinned ? C.red : "#7A7A7A" }}>
                {m.pinned ? "固定中" : "固定"}
              </button>
              <button onClick={() => memoToTask(m)} className="text-[11px] font-bold px-2.5 py-1 bg-white"
                style={{ borderRadius: "12px 6px 12px 6px", color: C.purple }}>タスクにする</button>
              <button onClick={() => removeMemo(m.id)} className="shrink-0" style={{ color: "rgba(0,0,0,.3)" }}>
                <Trash2 size={15} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const memoSheet = () => {
    if (!memoDraft) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setMemoDraft(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div className="relative w-full p-4 space-y-3 anim-sheet"
          style={{ background: SOFT[memoDraft.color] || SOFT.yellow, borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">{memoDraft.id ? "メモを編集" : "メモを書く"}</span>
            <button onClick={() => setMemoDraft(null)} className="text-slate-500"><X size={20} /></button>
          </div>

          <textarea rows={6} autoFocus value={memoDraft.text}
            onChange={(e) => setMemoDraft({ ...memoDraft, text: e.target.value })}
            placeholder="思いついたことを書く"
            className="w-full text-base font-medium p-3.5 outline-none resize-none leading-relaxed"
            style={{ background: "rgba(255,255,255,.8)", borderRadius: 18 }} />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold shrink-0" style={{ color: "#6B6B6B" }}>色</span>
            {MEMO_COLORS.map((col) => (
              <button key={col} onClick={() => setMemoDraft({ ...memoDraft, color: col })}
                aria-label={col} className="w-8 h-8"
                style={{ background: C[col], borderRadius: memoDraft.color === col ? "14px 7px 14px 7px" : 999,
                  border: `3px solid ${memoDraft.color === col ? C.ink : "transparent"}`,
                  transition: "border-radius .24s cubic-bezier(.34,1.56,.64,1)" }} />
            ))}
          </div>

          <button onClick={saveMemo} disabled={!memoDraft.text.trim()}
            className="w-full text-white py-3.5 text-sm font-bold disabled:opacity-40"
            style={{ background: C.ink, borderRadius: "24px 12px 24px 12px" }}>
            保存する
          </button>
        </div>
      </div>
    );
  };

  const taskHeader = (count, mode) => (
    <>
      <div className="px-4 pt-2 pb-3 flex items-center gap-3">
        <ShapeIcon shape="sun" color="yellow" size={44} face />
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-extrabold leading-tight">タスク</div>
          <div className="text-xs font-bold" style={{ color: "#8A8A8A" }}>
            {taskView === "memo"
              ? <>メモ <span style={{ color: C.pink }}>{memos.length}件</span></>
              : <>{mode}・未完了 <span style={{ color: C.red }}>{count}件</span></>}
          </div>
        </div>
        <button
          onClick={() => taskView === "memo"
            ? setMemoDraft({ id: null, text: "", color: "yellow" })
            : openTaskForm(companies[0].id)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white"
          style={{ background: C.purple, borderRadius: "22px 10px 22px 10px" }}>
          <Plus size={17} strokeWidth={3} />追加
        </button>
      </div>

      <div className="px-4 pb-3 flex gap-1.5">
        {[["list", "リスト", "purple", List], ["calendar", "カレンダー", "yellow", Calendar], ["memo", "メモ", "pink", StickyNote]].map(([v, l, col, Ic], i) => {
          const on = taskView === v;
          const radii = ["24px 12px 24px 12px", "12px 24px 12px 24px", "22px 10px 22px 10px"];
          return (
            <button key={v} onClick={() => setTaskView(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold ${on ? "anim-chip" : ""}`}
              style={{
                background: on ? C[col] : "#fff",
                color: on ? (col === "yellow" ? C.ink : "#fff") : "#9AA0A6",
                border: `2.5px solid ${on ? C[col] : C.line}`,
                borderRadius: radii[i],
              }}>
              <Ic size={16} strokeWidth={2.6} />{l}
            </button>
          );
        })}
      </div>
    </>
  );

  const tasksScreen = () => {
    const all = withTier.flatMap((c) => c.tasks.map((t2) => ({ ...t2, co: c })));
    const openT = [...all, ...personal].filter((t2) => !t2.done);
    if (taskView === "calendar") {
      return (<>{taskHeader(openT.length, "カレンダー")}{calendarView()}</>);
    }
    if (taskView === "memo") {
      return (<>{taskHeader(openT.length, "メモ")}{memoView()}</>);
    }
    if (taskScope === "company") {
      const byCo = withTier.filter((c) => c.tasks.some((t2) => !t2.done));
      return (
        <>
          {taskHeader(openT.length, "会社ごと")}
          {personalCard()}
          <div className="px-4 pt-4 pb-2 space-y-3">
            <div className="flex items-center gap-2 px-1"><span className="text-base font-extrabold">会社のタスク</span><ShapeIcon shape="sun" color="yellow" size={20} /></div>
            {byCo.length === 0 && <p className="text-center text-sm text-slate-400 py-10">未完了のタスクはありません。</p>}
            {byCo.map((c) => (
              <div key={c.id} className="space-y-3 pt-1">
                <button onClick={() => open(c.id, "tasks")} className="w-full text-left flex items-center gap-2.5 px-1">
                  <CompanyAvatar co={c} size={32} />
                  <span className="text-base font-extrabold truncate flex-1">{c.name}</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 shrink-0"
                    style={{ background: SOFT[companyArt(c).color] || SOFT.purple, color: C[companyArt(c).color] || C.purple, borderRadius: "12px 6px 12px 6px" }}>
                    {c.tasks.filter((x) => !x.done).length}件
                  </span>
                  <ChevronRight size={16} strokeWidth={2.6} style={{ color: "#C8C2B6" }} />
                </button>
                {c.tasks.filter((t2) => !t2.done).map((t2, ti) => taskRow(t2, c.id, null, ti))}
              </div>
            ))}
          </div>
        </>
      );
    }
    const byMember = TEAM.filter((u) => openT.some((t2) => t2.assignee === u.id));
    return (
      <>
        {taskHeader(openT.length, "担当者ごと")}
        {personalCard()}
        <div className="px-4 pt-4 pb-2 space-y-4">
          {byMember.map((u) => (
            <div key={u.id} className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <MemberDot id={u.id} size={30} />
                <span className="text-base font-extrabold flex-1 truncate">{u.name}</span>
                <span className="text-[11px] font-bold px-2.5 py-1 shrink-0"
                  style={{ background: "#fff", color: "#6B6B6B", borderRadius: "12px 6px 12px 6px", border: `2px solid ${C.line}` }}>
                  {openT.filter((t2) => t2.assignee === u.id).length}件
                </span>
              </div>
              {openT.filter((t2) => t2.assignee === u.id).map((t2, ti) =>
                taskRow(t2, t2.co ? t2.co.id : "personal", t2.co ? t2.co.name : null, ti))}
            </div>
          ))}
        </div>
      </>
    );
  };

  const inboxScreen = () => {
    const offAddrs = companies.flatMap((c) => (c.contacts || []).filter((p) => mailOff.includes(p.id)).map((p) => p.email));
    const all = withTier.flatMap((c) => (c.mails || []).map((m) => ({ ...m, co: c })))
      .filter((m) => !offAddrs.includes(m.from));
    const unreplied = all.filter((m) => m.dir === "in" && !m.replied);
    const items = mailFilter === "unreplied" ? unreplied
      : mailFilter === "in" ? all.filter((m) => m.dir === "in")
      : mailFilter === "out" ? all.filter((m) => m.dir === "out")
      : all;

    return (
      <>
        <div className="px-4 pt-2 pb-3 flex items-center gap-2.5">
          <button onClick={() => setScreen("list")} className="p-1 -ml-1" aria-label="戻る">
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <ShapeIcon shape="square" color="blue" size={40} face wink />
          <div className="flex-1 min-w-0">
            <div className="text-xl font-extrabold leading-tight">メール</div>
            <div className="text-xs font-bold" style={{ color: "#8A8A8A" }}>
              {gmail.connected
                ? <>{all.length}件　未返信 <span style={{ color: C.red }}>{unreplied.length}件</span></>
                : "Gmail 未連携"}
            </div>
          </div>
          {gmail.connected && (
            <button onClick={resync} aria-label="同期"
              className="w-11 h-11 flex items-center justify-center"
              style={{ background: "#fff", border: `2.5px solid ${C.line}`, borderRadius: "18px 8px 18px 8px" }}>
              <RefreshCw size={18} strokeWidth={2.6} className={gmail.syncing ? "animate-spin" : ""} style={{ color: "#6B6B6B" }} />
            </button>
          )}
        </div>

        {!gmail.connected ? (
          <div className="px-4 space-y-3">
            <div className="p-4 space-y-3" style={{ background: SOFT.blue, borderRadius: "28px 14px 28px 14px" }}>
              <div className="flex items-center gap-2.5">
                <ShapeIcon shape="square" color="red" size={38} />
                <div className="text-base font-extrabold">Gmail をつなぐと</div>
              </div>
              {[
                ["登録した相手のメールだけ", "顧客リストにいる人との送受信だけを取り込みます"],
                ["広告や請求書は入らない", "登録のないアドレスは最初から対象外です"],
                ["返信をタスクにできる", "そのままタスクや AI 返信につなげられます"],
              ].map(([t, d]) => (
                <div key={t} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: C.blue, borderRadius: 7 }}>
                    <Check size={12} className="text-white" strokeWidth={3.4} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{t}</div>
                    <div className="text-[11px] font-bold" style={{ color: "#6B6B6B" }}>{d}</div>
                  </div>
                </div>
              ))}
              <button onClick={connectGmail} disabled={gmail.syncing}
                className="w-full text-white py-3.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: C.blue, borderRadius: "24px 12px 24px 12px" }}>
                <Link2 size={16} strokeWidth={2.8} />
                {gmail.syncing ? "接続中…" : "Google アカウントをつなぐ"}
              </button>
              <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
                受信箱全体は表示しません。取り込む範囲はあとから設定で変えられます。
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pb-3">
              <button onClick={() => setScreen("settings")}
                className="w-full flex items-center gap-2.5 p-3 text-left"
                style={{ background: SOFT.green, borderRadius: "22px 11px 22px 11px" }}>
                <ShapeIcon shape="clover" color="green" size={30} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-extrabold" style={{ color: C.green }}>
                    {mailScope === "registered" ? "登録した相手のメールだけ表示中"
                      : mailScope === "domain" ? "登録した会社のドメインまで表示中"
                      : "受信箱すべてを表示中"}
                  </div>
                  <div className="text-[11px] font-bold" style={{ color: "#6B6B6B" }}>
                    {mailScope === "all"
                      ? "広告や通知も混ざります"
                      : `対象 ${mailTargets().filter((t) => isWatched(t.id)).length}人 ／ 広告・通知など ${OUTSIDERS.length}件は対象外`}
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={2.6} style={{ color: "#8A8A8A" }} />
              </button>
            </div>

            <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto">
              {[["all", "すべて", all.length], ["unreplied", "未返信", unreplied.length],
                ["in", "受信", all.filter((m) => m.dir === "in").length],
                ["out", "送信", all.filter((m) => m.dir === "out").length]].map(([v, l, n], i) => {
                const on = mailFilter === v;
                const col = v === "unreplied" ? "red" : "blue";
                return (
                  <button key={v} onClick={() => setMailFilter(v)}
                    className={`text-xs font-bold px-3 py-2 shrink-0 ${on ? "anim-chip" : ""}`}
                    style={{ background: on ? C[col] : "#fff", color: on ? "#fff" : "#8A8A8A",
                      border: `2px solid ${on ? C[col] : C.line}`,
                      borderRadius: i % 2 ? "16px 8px 16px 8px" : "8px 16px 8px 16px" }}>
                    {l} {n}
                  </button>
                );
              })}
            </div>

            <div className="px-4 pb-2 space-y-2.5">
              {items.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <ShapeIcon shape="cloud" color="lime" size={56} face className="mx-auto" />
                  <p className="text-sm font-bold text-slate-400">該当するメールはありません。</p>
                </div>
              )}
              {mailScope === "all" && mailFilter === "all" && OUTSIDERS.map((o, i) => (
                <div key={o.id} className="p-3.5 flex gap-3 anim-item"
                  style={{ background: "#F4F1EA", borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                    border: `2.5px solid ${C.line}` }}>
                  <span className="w-11 h-11 flex items-center justify-center shrink-0"
                    style={{ background: "#E4DFD4", borderRadius: 16 }}>
                    <Mail size={18} strokeWidth={2.4} style={{ color: "#9A9A9A" }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                        style={{ background: "#E4DFD4", color: "#7A7A7A", borderRadius: "8px 4px 8px 4px" }}>未登録</span>
                      <span className="ml-auto text-[11px] font-bold shrink-0" style={{ color: "#9A9A9A" }}>{o.at}</span>
                    </div>
                    <div className="text-sm font-bold truncate mt-0.5" style={{ color: "#7A7A7A" }}>{o.subject}</div>
                    <div className="text-[11px] font-bold truncate" style={{ color: "#9A9A9A" }}>{o.from}</div>
                  </div>
                </div>
              ))}

              {items.map((m, i) => {
                const art = companyArt(m.co);
                const isUnreplied = m.dir === "in" && !m.replied;
                return (
                  <div key={m.id} className="bg-white p-3.5 anim-item"
                    style={{ borderRadius: i % 2 ? "26px 13px 26px 13px" : "13px 26px 13px 26px",
                      border: `2.5px solid ${isUnreplied ? C.red : C.line}` }}>
                    <button onClick={() => open(m.co.id, "mail")} className="w-full text-left flex gap-3">
                      <CompanyAvatar co={m.co} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold truncate">{m.co.name}</span>
                          <span className="ml-auto text-[11px] font-bold shrink-0" style={{ color: "#8A8A8A" }}>{m.at}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                            style={{ background: m.dir === "in" ? SOFT.green : SOFT.blue,
                              color: m.dir === "in" ? C.green : C.blue, borderRadius: "8px 4px 8px 4px" }}>
                            {m.dir === "in" ? "受信" : "送信"}
                          </span>
                          {isUnreplied && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                              style={{ background: SOFT.red, color: C.red, borderRadius: "8px 4px 8px 4px" }}>未返信</span>
                          )}
                          <span className="text-sm font-bold truncate">{m.subject}</span>
                        </div>
                        <p className="text-[11px] font-bold mt-1 leading-snug" style={{ color: "#8A8A8A" }}>{m.excerpt}</p>
                      </div>
                    </button>

                    {isUnreplied && (
                      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `2px dashed ${C.line}` }}>
                        <button onClick={() => {
                            update(m.co.id, (c) => ({ ...c,
                              tasks: [{ id: nid(), title: `返信: ${m.subject}`, due: addDays(1), assignee: c.ownerId,
                                contactId: c.primaryContactId, pri: "高", done: false, share: "assignee", subs: [] }, ...c.tasks],
                              messages: [...c.messages, { id: nid(), system: true, text: "メールからタスクを作成しました", at: "たった今" }] }));
                            notify("返信タスクを作成しました");
                          }}
                          className="flex-1 text-xs font-bold py-2.5"
                          style={{ background: "#fff", color: "#6B6B6B", border: `2px solid ${C.line}`, borderRadius: "16px 8px 16px 8px" }}>
                          タスクにする
                        </button>
                        <button onClick={() => openMail(m.co, m.co.primaryContactId, m)}
                          className="flex-1 text-xs font-bold py-2.5 text-white flex items-center justify-center gap-1.5"
                          style={{ background: C.purple, borderRadius: "8px 16px 8px 16px" }}>
                          <ShapeIcon shape="burst" color="yellow" size={14} />AIで返信
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  };

  /* ══════════════ ロードマップ ══════════════ */
  const rmItems = () => {
    const key = mk(rmMi);
    return rmDept === "all"
      ? ["sales", "is", "cs", "dev"].flatMap((k) => (agenda[k][key] || []).map((t) => ({ ...t, dept: k })))
      : (agenda[rmDept][key] || []).map((t) => ({ ...t, dept: rmDept }));
  };

  const rmToggleNext = (dk, id, ni) => {
    const key = mk(rmMi);
    setAgenda((prev) => ({ ...prev, [dk]: { ...prev[dk],
      [key]: prev[dk][key].map((t) => (t.id === id ? { ...t, next: t.next.map((n, i) => (i === ni ? { ...n, done: !n.done } : n)) } : t)) } }));
  };
  const rmToggleJoin = (dk, id, uid) => {
    const key = mk(rmMi);
    setAgenda((prev) => ({ ...prev, [dk]: { ...prev[dk],
      [key]: prev[dk][key].map((t) => (t.id === id
        ? { ...t, who: t.who.includes(uid) ? t.who.filter((w) => w !== uid) : [...t.who, uid] } : t)) } }));
  };
  const rmSaveTopic = () => {
    const f = rmForm;
    if (!f || !f.title.trim()) { setRmForm(null); return; }
    const key = mk(rmMi);
    const dk = f.dept === "all" ? "sales" : f.dept;
    setAgenda((prev) => ({ ...prev, [dk]: { ...prev[dk],
      [key]: [{ id: nid(), title: f.title.trim(), state: "todo", who: f.who, decision: "", when: f.when || "日程未定", next: [] },
        ...(prev[dk][key] || [])] } }));
    notify("議題を追加しました");
    setRmForm(null);
  };

  const rmMapView = () => {
    const gridDepts = rmDept === "all" ? ["sales", "is", "cs", "dev"] : [rmDept];
    const cellOf = (dk, i) => agenda[dk][mk(i)] || [];
    const cellState = (list) => {
      if (!list.length) return null;
      if (list.some((t) => t.state === "talking")) return "talking";
      if (list.some((t) => t.state === "todo")) return "todo";
      return "decided";
    };
    const dCol = DEPTS.find((x) => x.id === rmDept).color;
    return (
      <div className="pane space-y-3">
        <div className="flex items-center gap-1 pl-[86px] pr-1">
          {RM_MONTHS.map((m, i) => (
            <div key={m} className="flex-1 text-center text-[10px] font-extrabold"
              style={{ color: i === rmMi ? C[dCol] : i < RM_CURRENT ? "#C8C2B6" : "#8A8A8A" }}>{m}</div>
          ))}
        </div>

        {gridDepts.map((dk, ri) => {
          const dd = DEPTS.find((x) => x.id === dk);
          return (
            <div key={dk} className="bg-white p-2.5"
              style={{ borderRadius: ri % 2 ? "24px 12px 24px 12px" : "12px 24px 12px 24px", border: `2.5px solid ${C.line}` }}>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setRmDept(dk)} className="flex items-center gap-1.5 shrink-0" style={{ width: 76 }}>
                  <ShapeIcon shape={dd.shape} color={dd.color} size={24} />
                  <span className="text-[11px] font-extrabold leading-tight text-left truncate">{dd.name}</span>
                </button>
                <div className="flex-1 flex items-center gap-1">
                  {RM_MONTHS.map((m, i) => {
                    const list = cellOf(dk, i);
                    const st = cellState(list);
                    const on = rmMi === i;
                    return (
                      <button key={m} onClick={() => setRmMi(i)}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5"
                        style={{ height: 46,
                          background: st ? SOFT[AGENDA_STATE[st].color] : "#F7F5F0",
                          border: `2px solid ${on ? C[dd.color] : "transparent"}`,
                          borderRadius: i % 2 ? "12px 6px 12px 6px" : "6px 12px 6px 12px" }}>
                        {st ? (
                          <>
                            <span className="text-sm font-extrabold" style={{ color: C[AGENDA_STATE[st].color] }}>{list.length}</span>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C[AGENDA_STATE[st].color] }} />
                          </>
                        ) : <span className="text-[10px] font-bold" style={{ color: "#C8C2B6" }}>—</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-3 pt-1">
          {Object.entries(AGENDA_STATE).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: C[v.color] }} />
              <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{v.label}</span>
            </span>
          ))}
        </div>

        <div className="pt-2 space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-extrabold px-3 py-1.5"
              style={{ background: SOFT[dCol], color: C[dCol], borderRadius: "16px 8px 16px 8px" }}>
              {RM_MONTHS[rmMi]}の流れ
            </span>
            <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
          </div>
          {rmItems().length === 0 && (
            <p className="text-sm font-bold text-slate-400 text-center py-6">この月の議題はまだありません。</p>
          )}
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-3 bottom-3 w-0.5" style={{ background: C.line }} />
            {rmItems().map((t) => {
              const sc = AGENDA_STATE[t.state];
              const dd = DEPTS.find((x) => x.id === t.dept);
              return (
                <div key={t.id} className="relative mb-2.5">
                  <span className="absolute rounded-full border-[3px] border-white flex items-center justify-center"
                    style={{ left: -22, top: 16, width: 18, height: 18, background: C[sc.color] }}>
                    {t.state === "decided" && <Check size={10} className="text-white" strokeWidth={4} />}
                  </span>
                  <button onClick={() => setRmView("agenda")} className="w-full text-left bg-white p-3"
                    style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px solid ${t.state === "decided" ? C.line : C[sc.color]}` }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShapeIcon shape={dd.shape} color={dd.color} size={16} />
                      <span className="text-[11px] font-bold" style={{ color: C[sc.color] }}>{sc.label}</span>
                      <span className="ml-auto text-[11px] font-bold truncate" style={{ color: "#8A8A8A" }}>{t.when}</span>
                    </div>
                    <div className="text-sm font-extrabold leading-snug">{t.title}</div>
                    {t.decision && <div className="text-[11px] font-bold mt-1 truncate" style={{ color: "#6B6B6B" }}>→ {t.decision}</div>}
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex -space-x-1.5">{t.who.map((w) => <MemberDot key={w} id={w} size={20} />)}</div>
                      {t.next.length > 0 && (
                        <span className="text-[11px] font-bold ml-1" style={{ color: "#8A8A8A" }}>
                          やること {t.next.filter((n) => n.done).length}/{t.next.length}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const roadmapScreen = () => {
    const d = DEPTS.find((x) => x.id === rmDept);
    const items = rmItems();
    const counts = {
      decided: items.filter((t) => t.state === "decided").length,
      talking: items.filter((t) => t.state === "talking").length,
      todo: items.filter((t) => t.state === "todo").length,
    };
    return (
      <>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <ShapeIcon shape="burst" color="orange" size={44} face />
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-extrabold leading-tight">計画</div>
            <div className="text-xs font-bold" style={{ color: "#8A8A8A" }}>
              話すこと <span style={{ color: C.orange }}>{counts.talking + counts.todo}件</span>
              　決定 <span style={{ color: C.green }}>{counts.decided}件</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {DEPTS.map((x) => {
            const on = rmDept === x.id;
            return (
              <button key={x.id} onClick={() => setRmDept(x.id)}
                className="shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5"
                style={{ background: on ? SOFT[x.color] : "#fff",
                  border: `2.5px solid ${on ? C[x.color] : C.line}`,
                  borderRadius: on ? "22px 11px 22px 11px" : 16, minWidth: 76,
                  transition: "border-radius .26s cubic-bezier(.34,1.56,.64,1), background .2s ease" }}>
                <span style={{ display: "inline-flex", transform: on ? "scale(1.1)" : "scale(1)",
                  transition: "transform .26s cubic-bezier(.34,1.56,.64,1)" }}>
                  <ShapeIcon shape={x.shape} color={x.color} size={30} />
                </span>
                <span className="text-[11px] font-bold leading-tight text-center"
                  style={{ color: on ? C[x.color] : "#8A8A8A" }}>{x.name}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 p-1.5" style={{ background: "#fff", borderRadius: 22, border: `2.5px solid ${C.line}` }}>
            <button onClick={() => setRmMi(Math.max(0, rmMi - 1))} className="w-8 h-8 flex items-center justify-center shrink-0" aria-label="前の月">
              <ChevronLeft size={18} strokeWidth={2.8} style={{ color: "#8A8A8A" }} />
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto">
              {RM_MONTHS.map((m, i) => {
                const on = rmMi === i;
                return (
                  <button key={m} onClick={() => setRmMi(i)} className="flex-1 text-xs font-extrabold py-2 shrink-0"
                    style={{ minWidth: 44, background: on ? C[d.color] : "transparent",
                      color: on ? "#fff" : i < RM_CURRENT ? "#B0AA9E" : "#6B6B6B",
                      borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px" }}>{m}</button>
                );
              })}
            </div>
            <button onClick={() => setRmMi(Math.min(RM_MONTHS.length - 1, rmMi + 1))} className="w-8 h-8 flex items-center justify-center shrink-0" aria-label="次の月">
              <ChevronRight size={18} strokeWidth={2.8} style={{ color: "#8A8A8A" }} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 flex gap-1.5">
          {[["agenda", "議題", MessageSquare], ["map", "ロードマップ図", Map]].map(([v, l, Ic], i) => {
            const on = rmView === v;
            return (
              <button key={v} onClick={() => setRmView(v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold ${on ? "anim-chip" : ""}`}
                style={{ background: on ? C.ink : "#fff", color: on ? "#fff" : "#8A8A8A",
                  border: `2.5px solid ${on ? C.ink : C.line}`,
                  borderRadius: i ? "12px 24px 12px 24px" : "24px 12px 24px 12px" }}>
                <Ic size={16} strokeWidth={2.6} />{l}
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-8">
          {rmView === "map" ? rmMapView() : (
            <div key={`${rmDept}-${rmMi}`} className="pane space-y-3">
              {items.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <ShapeIcon shape="cloud" color="lime" size={56} face className="mx-auto" />
                  <p className="text-sm font-bold text-slate-400">{RM_MONTHS[rmMi]}の議題はまだありません。</p>
                </div>
              )}

              {["talking", "todo", "decided"].map((st) => {
                const group = items.filter((t) => t.state === st);
                if (!group.length) return null;
                const sc = AGENDA_STATE[st];
                return (
                  <div key={st} className="space-y-3">
                    <div className="flex items-center gap-2 px-1 pt-1">
                      <span className="text-sm font-extrabold px-3 py-1.5"
                        style={{ background: SOFT[sc.color], color: C[sc.color], borderRadius: "16px 8px 16px 8px" }}>{sc.label}</span>
                      <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{group.length}件</span>
                      <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
                    </div>

                    {group.map((t, i) => {
                      const dd = DEPTS.find((x) => x.id === t.dept);
                      return (
                        <div key={t.id} className="bg-white p-4 space-y-3 anim-item"
                          style={{ borderRadius: i % 2 ? "28px 14px 28px 14px" : "14px 28px 14px 28px",
                            border: `2.5px solid ${st === "decided" ? C.line : C[sc.color]}` }}>
                          <div className="flex items-start gap-2.5">
                            <ShapeIcon shape={dd.shape} color={dd.color} size={30} />
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-extrabold leading-snug">{t.title}</div>
                              {rmDept === "all" && <div className="text-[11px] font-bold mt-0.5" style={{ color: "#8A8A8A" }}>{dd.name}</div>}
                            </div>
                          </div>

                          {t.decision ? (
                            <div className="p-3" style={{ background: SOFT.green, borderRadius: "18px 9px 18px 9px" }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Check size={13} strokeWidth={3.4} style={{ color: C.green }} />
                                <span className="text-[11px] font-extrabold" style={{ color: C.green }}>決まったこと</span>
                                <span className="ml-auto text-[11px] font-bold" style={{ color: "#7A7A7A" }}>{t.when}</span>
                              </div>
                              <p className="text-sm font-bold leading-relaxed">{t.decision}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3" style={{ background: SOFT[sc.color], borderRadius: "18px 9px 18px 9px" }}>
                              <Calendar size={15} strokeWidth={2.6} style={{ color: C[sc.color] }} />
                              <span className="text-sm font-bold flex-1">{t.when}</span>
                              <button onClick={() => { setActiveId(companies[0].id); openMeet(companies[0]); }}
                                className="text-[11px] font-bold px-2.5 py-1 bg-white shrink-0"
                                style={{ color: C[sc.color], borderRadius: "12px 6px 12px 6px" }}>日程を決める</button>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold shrink-0" style={{ color: "#8A8A8A" }}>参加</span>
                            <div className="flex -space-x-1.5">{t.who.map((w) => <MemberDot key={w} id={w} size={28} />)}</div>
                            <button onClick={() => setRmSheet({ dept: t.dept, id: t.id, who: t.who })}
                              className="ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 shrink-0"
                              style={{ background: SOFT.purple, color: C.purple, borderRadius: "14px 7px 14px 7px" }}>
                              <UserPlus size={13} strokeWidth={2.8} />変更
                            </button>
                          </div>

                          {t.next.length > 0 && (
                            <div className="space-y-1.5 pt-1" style={{ borderTop: `2px dashed ${C.line}` }}>
                              <div className="text-[11px] font-extrabold pt-1.5" style={{ color: "#8A8A8A" }}>やること</div>
                              {t.next.map((n, ni) => (
                                <button key={ni} onClick={() => rmToggleNext(t.dept, t.id, ni)} className="w-full flex items-center gap-2.5 text-left">
                                  <span className="w-5 h-5 flex items-center justify-center shrink-0"
                                    style={{ borderRadius: 7, background: n.done ? C.green : "#fff", border: `2.5px solid ${n.done ? C.green : "#D6D0C4"}` }}>
                                    {n.done && <Check size={12} className="text-white anim-check" strokeWidth={3.4} />}
                                  </span>
                                  <span className={`flex-1 text-sm ${n.done ? "line-through text-slate-400" : "font-bold"} truncate`}>{n.t}</span>
                                  <MemberDot id={n.who} size={22} />
                                </button>
                              ))}
                            </div>
                          )}

                          <button onClick={() => setScreen("channels")}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold"
                            style={{ background: "#F4F1EA", color: "#6B6B6B", borderRadius: "18px 9px 18px 9px" }}>
                            <MessageSquare size={15} strokeWidth={2.6} />チャンネルで話す
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <button onClick={() => setRmForm({ dept: rmDept, title: "", when: "", who: [ME] })}
                className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-1.5"
                style={{ borderRadius: "24px 12px 24px 12px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
                <Plus size={17} strokeWidth={2.8} />話したいことを追加
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  const SectionHead = ({ shape, color, title, desc }) => (
    <div className="flex items-start gap-2.5 mb-2 px-1">
      <ShapeIcon shape={shape} color={color} size={30} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-base font-extrabold leading-tight">{title}</div>
        <div className="text-[11px] font-bold leading-snug mt-0.5" style={{ color: "#8A8A8A" }}>{desc}</div>
      </div>
    </div>
  );

  const settingsScreen = () => (
    <>
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2" style={{ background: C.bg, borderBottom: `2px solid ${C.line}` }}>
        <button onClick={() => setScreen("list")} className="p-1 -ml-1"><ChevronLeft size={22} strokeWidth={2.6} /></button>
        <div className="text-lg font-extrabold">設定</div>
      </div>
      <div className="p-4 space-y-5">
        <div className="p-3.5 flex items-start gap-3"
          style={{ background: SOFT.purple, borderRadius: "26px 13px 26px 13px" }}>
          <ShapeIcon shape="burst" color="purple" size={34} />
          <p className="text-[11px] font-bold leading-relaxed flex-1" style={{ color: "#5B4A75" }}>
            アプリ全体の設定です。メンバーの招待、商談の段階、Google連携、AIメールの署名をここで決めます。
          </p>
        </div>

        <div>
          <SectionHead shape="flower" color="purple" title="ワークスペース"
            desc="ここに登録した人だけが参加できます。先に登録しておけば、その人がログインした時点で入れます。" />
          <div className="mb-2 p-3 flex items-center gap-3"
            style={{ background: SOFT[workspace.color] || SOFT.purple, borderRadius: "26px 13px 26px 13px" }}>
            <ShapeIcon shape={workspace.shape || "flower"} color={workspace.color || "purple"} size={42} />
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold truncate">{workspace.name}</div>
              <div className="text-[11px] font-bold" style={{ color: "#6B6B6B" }}>
                {workspace.slug}.syncle.app ・ {team.filter((u) => u.status === "active").length}人
              </div>
            </div>
            {WORKSPACES.filter((w) => w.emails.includes(user(ME).email)).length > 1 && (
              <button onClick={() => { setAuthed(false); setAuthStep("pick");
                  setFoundWs(WORKSPACES.filter((w) => w.emails.includes(user(ME).email))); }}
                className="text-[11px] font-bold px-2.5 py-1.5 bg-white shrink-0"
                style={{ color: C.purple, borderRadius: "14px 7px 14px 7px" }}>
                切り替え
              </button>
            )}
          </div>
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">
            <p className="text-sm text-slate-500 leading-relaxed">
              招待した人だけが参加できます。参加すると顧客情報とチャンネルを共有できます。
            </p>
            <div className="flex items-center gap-2">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { inviteMember(inviteEmail, inviteRole); setInviteEmail(""); } }}
                placeholder="メールアドレスを入力"
                className="flex-1 text-sm font-medium px-3.5 py-2.5 outline-none min-w-0" style={{ background: "#F7F4ED", borderRadius: 16 }} />
              <button onClick={() => { inviteMember(inviteEmail, inviteRole); setInviteEmail(""); }}
                disabled={!inviteEmail.includes("@")}
                className="text-white px-3.5 py-2.5 text-sm font-bold shrink-0 disabled:opacity-40"
                style={{ background: C.purple, borderRadius: "16px 8px 16px 8px" }}>
                登録
              </button>
            </div>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="w-full text-sm font-medium px-3 py-2.5 outline-none"
              style={{ background: "#F7F4ED", borderRadius: 16 }}>
              {["代表", "営業", "インサイドセールス", "カスタマーサクセス", "エンジニア", "デザイナー", "管理部", "メンバー"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* 参加したときに入るチャンネル */}
            <div>
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>
                参加したときに入るチャンネル（任意）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...groups.map((g) => ({ id: g.id, name: g.name, shape: g.shape, color: g.color })),
                  ...companies.slice(0, 3).map((c) => ({ id: c.id, name: channelName(c),
                    shape: companyArt(c).shape, color: companyArt(c).color }))].map((ch) => {
                  const on = inviteCh.includes(ch.id);
                  return (
                    <button key={ch.id}
                      onClick={() => setInviteCh((v) => on ? v.filter((x) => x !== ch.id) : [...v, ch.id])}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 ${on ? "anim-chip" : ""}`}
                      style={{ background: on ? SOFT[ch.color] : "#fff", color: on ? C[ch.color] : "#6B6B6B",
                        border: `2px solid ${on ? C[ch.color] : C.line}`, borderRadius: "14px 7px 14px 7px" }}>
                      <ShapeIcon shape={ch.shape} color={ch.color} size={16} />{ch.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 参加の申請 */}
            {pending.length > 0 && (
              <div className="p-3 space-y-2.5" style={{ background: SOFT.orange, borderRadius: "24px 12px 24px 12px" }}>
                <div className="flex items-center gap-2">
                  <ShapeIcon shape="burst" color="orange" size={26} />
                  <span className="text-sm font-extrabold">参加の申請</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-white shrink-0"
                    style={{ color: C.orange, borderRadius: "10px 5px 10px 5px" }}>{pending.length}件</span>
                </div>
                {pending.map((r) => (
                  <div key={r.id} className="bg-white p-3" style={{ borderRadius: "18px 9px 18px 9px" }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 flex items-center justify-center shrink-0 rounded-full" style={{ background: C.orange }}>
                        <span className="text-white font-bold text-sm">{r.name.charAt(0).toUpperCase()}</span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{r.email}</div>
                        <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{r.via} ・ {r.at}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => rejectJoin(r)} className="flex-1 py-2 text-xs font-bold"
                        style={{ border: `2px solid ${C.line}`, color: "#8A8A8A", borderRadius: "14px 7px 14px 7px" }}>却下</button>
                      <button onClick={() => approveJoin(r)} className="flex-1 py-2 text-xs font-bold text-white"
                        style={{ background: C.green, borderRadius: "7px 14px 7px 14px" }}>承認して追加</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 招待リンク */}
            <div className="p-3 space-y-2.5" style={{ background: SOFT.blue, borderRadius: "12px 24px 12px 24px" }}>
              <div className="flex items-center gap-2">
                <ShapeIcon shape="hex" color="blue" size={26} />
                <span className="text-sm font-extrabold">招待リンク</span>
              </div>
              {inviteLink ? (
                <>
                  <div className="bg-white p-2.5 flex items-center gap-2" style={{ borderRadius: "16px 8px 16px 8px" }}>
                    <span className="flex-1 min-w-0 text-[11px] font-bold truncate">{inviteLink.url}</span>
                    <button onClick={() => notify("リンクをコピーしました")} className="shrink-0 p-1" aria-label="コピー">
                      <Copy size={15} strokeWidth={2.6} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-white" style={{ color: "#6B6B6B", borderRadius: "10px 5px 10px 5px" }}>
                      有効期限 {inviteLink.expires}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-white" style={{ color: "#6B6B6B", borderRadius: "10px 5px 10px 5px" }}>
                      使用 {inviteLink.uses}/{inviteLink.limit}回
                    </span>
                    <button onClick={() => { setInviteLink(null); notify("リンクを無効にしました"); }}
                      className="ml-auto text-[11px] font-bold" style={{ color: C.red }}>無効にする</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#3F5A7A" }}>
                    リンクを知っている人が参加できます。社外に出ないよう、期限と回数を区切って発行します。
                  </p>
                  <button onClick={makeLink} className="w-full py-2.5 text-sm font-bold text-white"
                    style={{ background: C.blue, borderRadius: "16px 8px 16px 8px" }}>
                    招待リンクを作る
                  </button>
                </>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              {team.map((u) => (
                <button key={u.id} onClick={() => setViewProfile(u.id)} className="w-full flex items-center gap-2.5 text-left">
                  <MemberDot id={u.id} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {u.name}{u.id === ME && <span className="text-sm text-slate-400 ml-1">（自分）</span>}
                      {u.admin && <span className="text-[11px] font-bold px-2 py-0.5 ml-1.5" style={{ background: SOFT.purple, color: C.purple, borderRadius: "10px 5px 10px 5px" }}>管理者</span>}
                    </div>
                    <div className="text-sm text-slate-400 truncate">{u.role} ・ {u.email}</div>
                    {u.note && <div className="text-[11px] font-bold truncate" style={{ color: "#B0AA9E" }}>{u.note}</div>}
                  </div>
                  {u.status === "invited" ? (
                    <span className="text-[11px] font-bold px-2.5 py-1 shrink-0"
                      style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "12px 6px 12px 6px" }}>ログイン待ち</span>
                  ) : (
                    <ChevronRight size={16} strokeWidth={2.6} className="shrink-0" style={{ color: "#C8C2B6" }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <SectionHead shape="sun" color="yellow" title="タスクの見せ方"
            desc="タスクはどちらでも会社に紐づきます。並べ方だけが変わります。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2">
            <div className="flex gap-1 p-1" style={{ background: "#F1EDE4", borderRadius: 18 }}>
              {[["company", "会社ごと"], ["person", "担当者ごと"]].map(([v, l]) => (
                <button key={v} onClick={() => setTaskScope(v)}
                  className={`flex-1 text-sm py-1.5 rounded-xl ${taskScope === v ? "bg-slate-900 text-white font-medium" : "text-slate-600"}`}>{l}</button>
              ))}
            </div>
            <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#8A8A8A" }}>
              「会社ごと」は取引先単位でまとめて表示、「担当者ごと」は誰が何を抱えているかで表示します。
            </p>
          </div>
        </div>
        <div>
          <SectionHead shape="hex" color="blue" title="商談の進み具合"
            desc="名刺交換から受注までを、どんな段階に分けて管理するか。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">

            {/* いまの流れを見せる */}
            <div>
              <div className="text-[11px] font-bold mb-2" style={{ color: "#8A8A8A" }}>いまの流れ</div>
              <div className="flex items-center gap-1 flex-wrap">
                {stages.map((st, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-[11px] font-bold px-2.5 py-1.5"
                      style={{ background: SOFT.blue, color: C.blue, borderRadius: i % 2 ? "12px 6px 12px 6px" : "6px 12px 6px 12px" }}>
                      {st || "未入力"}
                    </span>
                    {i < stages.length - 1 && <ChevronRight size={13} strokeWidth={3} style={{ color: "#C8C2B6" }} />}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-2" style={{ borderTop: `2px dashed ${C.line}` }}>
              <div className="text-[11px] font-bold pt-1" style={{ color: "#8A8A8A" }}>
                名前を変えたり、段階を足したり減らしたりできます
              </div>
              {stages.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center text-[11px] font-extrabold shrink-0"
                    style={{ background: SOFT.blue, color: C.blue, borderRadius: 9 }}>{i + 1}</span>
                  <input value={st} onChange={(e) => setStages(stages.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="段階の名前"
                    className="flex-1 text-sm font-medium px-3 py-2.5 outline-none min-w-0"
                    style={{ background: "#F7F4ED", borderRadius: 14 }} />
                  {stages.length > 2 && (
                    <button onClick={() => setStages(stages.filter((_, j) => j !== i))}
                      className="shrink-0 p-1" aria-label="削除" style={{ color: "#C8C2B6" }}>
                      <Trash2 size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setStages([...stages, "新しい段階"])}
                className="w-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5"
                style={{ borderRadius: "18px 9px 18px 9px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
                <Plus size={15} strokeWidth={2.8} />段階を追加
              </button>
            </div>

            <p className="text-[11px] font-bold leading-relaxed pt-1" style={{ color: "#8A8A8A" }}>
              ここで決めた段階が、会社ごとの「進捗」の選択肢と、顧客リストに出る表示になります。
            </p>
          </div>
        </div>
        <div>
          <SectionHead shape="arch" color="green" title="Google カレンダー"
            desc="連携すると、日程調整で自分の空き時間を自動で計算できます。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3">
            <div className="flex items-center gap-3">
              <ShapeIcon shape="arch" color="green" size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">Google カレンダー</div>
                <div className="text-sm text-slate-500">
                  {gcal.connected ? `${calendars.filter((c) => c.enabled).length} 件を空き判定に使用中` : "未連携"}
                </div>
              </div>
              {gcal.connected
                ? <button onClick={() => setGcal({ connected: false, syncing: false })} className="text-sm text-slate-400">解除</button>
                : <button onClick={connectGcal} disabled={gcal.syncing} className="text-xs bg-slate-900 text-white rounded-xl px-3 py-1.5">
                    {gcal.syncing ? "接続中" : "連携"}</button>}
            </div>
            {gcal.connected && (
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                {calendars.map((c) => (
                  <button key={c.id} onClick={() => setCalendars(calendars.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)))}
                    className="w-full flex items-center gap-2 text-left">
                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${c.enabled ? "bg-slate-900" : "border border-slate-300"}`}>
                      {c.enabled && <Check size={11} className="text-white" />}
                    </span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.color}`} />
                    <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                    <span className="text-sm text-slate-400 truncate">{c.email}</span>
                  </button>
                ))}
                <button onClick={() => setCalendars([...calendars, { id: nid(), name: "追加カレンダー", email: "another@gmail.com", enabled: true, color: "bg-amber-500" }])}
                  className="w-full border border-dashed border-slate-300 rounded-xl py-1.5 text-xs text-slate-500 flex items-center justify-center gap-1">
                  <Plus size={12} />Google カレンダーを追加
                </button>
                <p className="text-sm text-slate-400 leading-relaxed pt-1">
                  個人用カレンダーは予定名を読まず、空き・埋まりだけを見ます。
                </p>
                <div className="pt-2 mt-2 space-y-1.5" style={{ borderTop: `2px solid ${C.line}` }}>
                  <div className="text-sm font-bold">共有の仕組み</div>
                  {Object.entries(SHARE).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2.5">
                      <ShapeIcon shape={v.icon} color={v.color} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold">{v.label}</div>
                        <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{v.cal}</div>
                      </div>
                    </div>
                  ))}
                  <p className="text-sm text-slate-400 leading-relaxed pt-1">
                    「チーム全員」で登録すると、誰が入れても全員のカレンダーに自動で反映されます。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionHead shape="square" color="red" title="Gmail"
            desc="登録した相手とのメールだけを取り込みます。受信箱全体は表示しません。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3">
            {!gmail.connected ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <ShapeIcon shape="square" color="red" size={46} face />
                  <div><div className="text-sm font-bold">Gmail</div><div className="text-sm text-slate-500">未連携</div></div>
                </div>
                <button onClick={connectGmail} disabled={gmail.syncing}
                  className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                  <Link2 size={16} />{gmail.syncing ? "接続中…" : "Google アカウントを連携"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <ShapeIcon shape="clover" color="green" size={46} face />
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold">Gmail 連携中</div><div className="text-sm text-slate-500 truncate">{gmail.address}</div></div>
                </div>
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `2px dashed ${C.line}` }}>
                  <div className="text-[11px] font-extrabold" style={{ color: "#8A8A8A" }}>どこまで取り込むか</div>
                  {[
                    ["registered", "登録した相手だけ", "顧客リストにある人との送受信のみ。広告や通知は入りません。", "clover", "green"],
                    ["domain", "会社のドメインまで", "登録した会社のドメインから届いたメールも拾います。別担当からの返信を逃しません。", "hex", "blue"],
                    ["all", "受信箱すべて", "全部표示します。広告や請求書も混ざります。", "blob", "orange"],
                  ].map(([v, t, d, sh, col]) => {
                    const on = mailScope === v;
                    return (
                      <button key={v} onClick={() => setMailScope(v)}
                        className="w-full flex items-start gap-2.5 p-2.5 text-left"
                        style={{ background: on ? SOFT[col] : "#fff", borderRadius: "18px 9px 18px 9px",
                          border: `2.5px solid ${on ? C[col] : C.line}` }}>
                        <ShapeIcon shape={sh} color={col} size={30} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">{t}</div>
                          <div className="text-[11px] font-bold leading-snug mt-0.5" style={{ color: "#8A8A8A" }}>{d}</div>
                        </div>
                        {on && (
                          <span className="w-6 h-6 flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: C[col], borderRadius: 9 }}>
                            <Check size={14} className="text-white anim-check" strokeWidth={3.4} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `2px dashed ${C.line}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold" style={{ color: "#8A8A8A" }}>取り込む相手</span>
                    <span className="text-[11px] font-bold px-2 py-0.5"
                      style={{ background: SOFT.green, color: C.green, borderRadius: "10px 5px 10px 5px" }}>
                      {mailTargets().filter((t) => isWatched(t.id)).length}人
                    </span>
                  </div>
                  <p className="text-[11px] font-bold leading-relaxed" style={{ color: "#8A8A8A" }}>
                    名刺に登録したメールアドレスが自動で対象になります。外したい相手はここでオフにできます。
                  </p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {mailTargets().length === 0 && (
                      <p className="text-[11px] font-bold py-3 text-center" style={{ color: "#B0AA9E" }}>
                        メールアドレスが登録された名刺がまだありません。
                      </p>
                    )}
                    {mailTargets().map((t) => {
                      const on = isWatched(t.id);
                      return (
                        <button key={t.id} onClick={() => toggleWatch(t.id, t.name)}
                          className="w-full flex items-center gap-2.5 p-2.5 text-left"
                          style={{ background: on ? "#fff" : "#F4F1EA", borderRadius: "16px 8px 16px 8px",
                            border: `2px solid ${on ? C.line : "transparent"}`, opacity: on ? 1 : 0.6 }}>
                          <CompanyAvatar co={t.co} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{t.name}</div>
                            <div className="text-[11px] font-bold truncate" style={{ color: "#8A8A8A" }}>{t.email}</div>
                          </div>
                          <span className="w-10 h-6 flex items-center shrink-0 px-0.5"
                            style={{ background: on ? C.green : "#D6D0C4", borderRadius: 999,
                              transition: "background .2s ease" }}>
                            <span className="w-5 h-5 rounded-full bg-white"
                              style={{ transform: on ? "translateX(16px)" : "translateX(0)",
                                transition: "transform .24s cubic-bezier(.34,1.56,.64,1)" }} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setScreen("scan")}
                    className="w-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5"
                    style={{ borderRadius: "18px 9px 18px 9px", border: `2.5px dashed #CFC7B8`, color: "#8A8A8A" }}>
                    <Camera size={15} strokeWidth={2.6} />名刺を登録して相手を増やす
                  </button>
                </div>

                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `2px dashed ${C.line}` }}>
                  <div className="text-[11px] font-extrabold" style={{ color: "#8A8A8A" }}>こちらから送るとき</div>
                  <div className="flex items-start gap-2.5 p-2.5" style={{ background: "#F7F4ED", borderRadius: "18px 9px 18px 9px" }}>
                    <ShapeIcon shape="square" color="blue" size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{gmail.address} から送信</div>
                      <div className="text-[11px] font-bold leading-snug mt-0.5" style={{ color: "#8A8A8A" }}>
                        送信済みは Gmail にも残ります。相手からの返信は、取り込み範囲にかかわらず必ずここに届きます。
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => { setGmail({ connected: false, address: "", lastSync: null, syncing: false }); notify("連携を解除しました"); }}
                  className="w-full mt-3 py-2.5 text-sm font-bold"
                  style={{ border: `2px solid ${C.line}`, color: "#8A8A8A", borderRadius: "18px 9px 18px 9px" }}>
                  連携を解除
                </button>
              </>
            )}
          </div>
        </div>
        <div>
          <SectionHead shape="hex" color="green" title="セキュリティ"
            desc="ログイン状態は保持されます。開くときだけ本人確認を求められます。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-2.5">
            <button onClick={() => setBioLock((v) => !v)} className="w-full flex items-center gap-3 text-left">
              <ShapeIcon shape="hex" color="green" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">アプリを開くとき Face ID</div>
                <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                  顧客情報を守るため、既定でオンにしています
                </div>
              </div>
              <span className="w-10 h-6 flex items-center shrink-0 px-0.5"
                style={{ background: bioLock ? C.green : "#D6D0C4", borderRadius: 999, transition: "background .2s ease" }}>
                <span className="w-5 h-5 rounded-full bg-white"
                  style={{ transform: bioLock ? "translateX(16px)" : "translateX(0)",
                    transition: "transform .24s cubic-bezier(.34,1.56,.64,1)" }} />
              </span>
            </button>
            {bioLock && (
              <button onClick={() => { setLocked(true); setScreen("list"); }}
                className="w-full py-2.5 text-sm font-bold"
                style={{ border: `2px solid ${C.line}`, color: "#6B6B6B", borderRadius: "18px 9px 18px 9px" }}>
                ロック画面を確認する
              </button>
            )}
          </div>
        </div>

        <div>
          <SectionHead shape="blob" color="red" title="アカウント設定"
            desc="名前・アイコン・ひとことをここで変えられます。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 space-y-3.5">

            {/* プレビュー＋カバー */}
            <div className="relative overflow-hidden" style={{ borderRadius: "22px 11px 22px 11px", height: 96 }}>
              {acct.cover && acct.cover.kind === "photo" && acct.cover.src ? (
                <img src={acct.cover.src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full relative" style={{ background: C[acct.av.color] || C.purple }}>
                  {["flower", "clover", "sun", "hex", "blob"].map((sh, i) => (
                    <span key={sh} className="absolute" style={{ opacity: 0.18, left: `${6 + i * 20}%`, top: `${10 + (i % 2) * 34}%`, transform: `rotate(${i * 31}deg)` }}>
                      <ShapeIcon shape={sh} color="#ffffff" size={38 + (i % 3) * 12} />
                    </span>
                  ))}
                </div>
              )}
              <label className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center cursor-pointer"
                style={{ background: "rgba(255,255,255,.92)", borderRadius: "12px 6px 12px 6px" }} aria-label="カバー画像">
                <ImageIcon size={15} strokeWidth={2.6} />
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setAcct((a) => ({ ...a, cover: { kind: "photo", src: r.result } }));
                    r.readAsDataURL(f);
                  }} />
              </label>
              <div className="absolute left-3" style={{ bottom: -2 }}>
                <span className="inline-flex items-center justify-center rounded-full overflow-hidden border-[4px] border-white"
                  style={{ width: 62, height: 62, background: acct.av.kind === "photo" ? "#fff" : (SOFT[acct.av.color] || "#EEE") }}>
                  {acct.av.kind === "photo" && acct.av.src
                    ? <img src={acct.av.src} alt="" className="w-full h-full object-cover" />
                    : <ShapeIcon shape={acct.av.shape} color={acct.av.color} size={42} />}
                </span>
              </div>
            </div>

            {/* アイコンの種類 */}
            <div className="flex gap-1.5 pt-4">
              {[["photo", "写真", ImageIcon], ["shape", "シンボル", Sparkles]].map(([k, l, Ic], i) => {
                const on = acct.av.kind === k;
                return (
                  <button key={k} onClick={() => setAcct({ ...acct, av: { ...acct.av, kind: k } })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold ${on ? "anim-chip" : ""}`}
                    style={{ background: on ? C.ink : "#fff", color: on ? "#fff" : "#8A8A8A",
                      border: `2.5px solid ${on ? C.ink : C.line}`,
                      borderRadius: i ? "12px 24px 12px 24px" : "24px 12px 24px 12px" }}>
                    <Ic size={15} strokeWidth={2.6} />{l}
                  </button>
                );
              })}
            </div>

            {acct.av.kind === "photo" ? (
              <label className="w-full py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                style={{ borderRadius: "22px 11px 22px 11px", border: `2.5px dashed #CFC7B8` }}>
                <ImageIcon size={22} strokeWidth={2.2} style={{ color: "#B0AA9E" }} />
                <span className="text-sm font-bold" style={{ color: "#8A8A8A" }}>
                  {acct.av.src ? "別の写真を選ぶ" : "プロフィール写真を選ぶ"}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setAcct((a) => ({ ...a, av: { ...a.av, kind: "photo", src: r.result } }));
                    r.readAsDataURL(f);
                  }} />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-6 gap-2">
                  {["flower","clover","sun","hex","blob","burst","stamp","drop","cloud","wave","arch","square"].map((sh) => {
                    const on = acct.av.shape === sh;
                    return (
                      <button key={sh} onClick={() => setAcct({ ...acct, av: { ...acct.av, shape: sh } })}
                        aria-label={sh} className="flex items-center justify-center py-2"
                        style={{ background: on ? SOFT[acct.av.color] : "#fff",
                          border: `2.5px solid ${on ? C[acct.av.color] : C.line}`,
                          borderRadius: on ? "16px 8px 16px 8px" : 14,
                          transition: "border-radius .26s cubic-bezier(.34,1.56,.64,1)" }}>
                        <ShapeIcon shape={sh} color={acct.av.color} size={22} />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {["purple","blue","green","red","pink","yellow","orange"].map((col) => (
                    <button key={col} onClick={() => setAcct({ ...acct, av: { ...acct.av, color: col } })}
                      aria-label={col} className="flex-1 h-8"
                      style={{ background: C[col],
                        borderRadius: acct.av.color === col ? "12px 6px 12px 6px" : 999,
                        border: `3px solid ${acct.av.color === col ? C.ink : "transparent"}`,
                        transition: "border-radius .24s cubic-bezier(.34,1.56,.64,1)" }} />
                  ))}
                </div>
              </div>
            )}

            {/* 名前 */}
            <div>
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>表示名</div>
              <input value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })}
                placeholder="清水 晴陽"
                className="w-full text-base font-medium px-3.5 py-3 outline-none"
                style={{ background: "#F7F4ED", borderRadius: 16 }} />
            </div>

            {/* 役割 */}
            <div>
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>役割</div>
              <div className="flex flex-wrap gap-1.5">
                {["代表", "営業", "インサイドセールス", "カスタマーサクセス", "エンジニア", "デザイナー", "管理部"].map((r, i) => {
                  const on = acct.role === r;
                  return (
                    <button key={r} onClick={() => setAcct({ ...acct, role: r })}
                      className={`text-xs font-bold px-3 py-2 ${on ? "anim-chip" : ""}`}
                      style={{ background: on ? C.purple : "#fff", color: on ? "#fff" : "#6B6B6B",
                        border: `2px solid ${on ? C.purple : C.line}`,
                        borderRadius: i % 2 ? "16px 8px 16px 8px" : "8px 16px 8px 16px" }}>{r}</button>
                  );
                })}
              </div>
            </div>

            {/* ひとこと */}
            <div>
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>ひとこと</div>
              <textarea rows={2} value={acct.note} onChange={(e) => setAcct({ ...acct, note: e.target.value })}
                placeholder="チームに見える自己紹介"
                className="w-full text-sm font-medium p-3 outline-none resize-none"
                style={{ background: "#F7F4ED", borderRadius: 16 }} />
            </div>

            {/* メール（変更不可） */}
            <div className="flex items-center gap-2.5 p-2.5" style={{ background: "#F7F4ED", borderRadius: "16px 8px 16px 8px" }}>
              <ShapeIcon shape="square" color="blue" size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>ログイン中のメール</div>
                <div className="text-sm font-bold truncate">{user(ME).email}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setViewProfile(ME)}
                className="flex-1 py-2.5 text-sm font-bold"
                style={{ border: `2px solid ${C.line}`, color: "#6B6B6B", borderRadius: "18px 9px 18px 9px" }}>
                見え方を確認
              </button>
              <button onClick={() => {
                  setTeam((ts) => ts.map((u) => (u.id === ME
                    ? { ...u, name: acct.name.trim() || u.name, role: acct.role, av: acct.av, cover: acct.cover, note: acct.note } : u)));
                  notify("アカウント設定を保存しました");
                }}
                className="flex-1 py-2.5 text-sm font-bold text-white"
                style={{ background: C.purple, borderRadius: "9px 18px 9px 18px" }}>
                保存する
              </button>
            </div>

            <button onClick={() => { setAuthed(false); setAuthStep("welcome"); setAuthEmail(""); setAuthCode(["","","","","",""]); }}
              className="w-full py-2.5 text-sm font-bold"
              style={{ border: `2px solid ${C.line}`, color: "#8A8A8A", borderRadius: "18px 9px 18px 9px" }}>
              サインアウト
            </button>
          </div>
        </div>

        <div>
          <SectionHead shape="stamp" color="orange" title="差出人"
            desc="AIがメールを書くときの署名に使われます。" />
          <div style={{ borderRadius: 22, border: `2.5px solid ${C.line}` }} className="bg-white p-3 text-sm">
            {MY_COMPANY} ／ {user(ME).name}
            <p className="text-sm text-slate-400 mt-1">AIが書くメールの署名に使われます。</p>
          </div>
        </div>
      </div>
    </>
  );

  const rmJoinSheet = () => {
    if (!rmSheet) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setRmSheet(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div className="relative w-full bg-white p-4 space-y-3 anim-sheet max-h-full overflow-y-auto"
          style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">誰が参加するか</span>
            <button onClick={() => setRmSheet(null)} style={{ color: "#8A8A8A" }}><X size={20} /></button>
          </div>
          <div className="space-y-1.5">
            {team.filter((u) => u.status === "active").map((u, i) => {
              const on = rmSheet.who.includes(u.id);
              const col = ["purple", "green", "pink", "orange", "blue", "red", "yellow"][(i + 7) % 7];
              return (
                <button key={u.id}
                  onClick={() => { rmToggleJoin(rmSheet.dept, rmSheet.id, u.id);
                    setRmSheet((s2) => ({ ...s2, who: on ? s2.who.filter((w) => w !== u.id) : [...s2.who, u.id] })); }}
                  className="w-full flex items-center gap-3 p-2.5 text-left"
                  style={{ background: on ? SOFT[col] : "#fff", borderRadius: "18px 9px 18px 9px",
                    border: `2.5px solid ${on ? C[col] : C.line}` }}>
                  <MemberDot id={u.id} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{u.name}</div>
                    <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>{u.role}</div>
                  </div>
                  {on && (
                    <span className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: C[col], borderRadius: 9 }}>
                      <Check size={14} className="text-white anim-check" strokeWidth={3.4} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={() => setRmSheet(null)} className="w-full text-white py-3.5 text-sm font-bold"
            style={{ background: C.ink, borderRadius: "24px 12px 24px 12px" }}>決定</button>
        </div>
      </div>
    );
  };

  const rmTopicSheet = () => {
    if (!rmForm) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setRmForm(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div className="relative w-full bg-white p-4 space-y-3 anim-sheet max-h-full overflow-y-auto"
          style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold">話したいことを追加</span>
            <button onClick={() => setRmForm(null)} style={{ color: "#8A8A8A" }}><X size={20} /></button>
          </div>

          <input value={rmForm.title} autoFocus
            onChange={(e) => setRmForm({ ...rmForm, title: e.target.value })}
            placeholder="議題（例：紹介特典をどうするか）"
            className="w-full text-base font-medium px-3.5 py-3 outline-none"
            style={{ background: "#F7F4ED", borderRadius: 18 }} />

          <div>
            <div className="text-sm text-slate-400 mb-1.5">どの部署の話か</div>
            <div className="flex flex-wrap gap-1.5">
              {DEPTS.filter((x) => x.id !== "all").map((x) => {
                const on = rmForm.dept === x.id;
                return (
                  <button key={x.id} onClick={() => setRmForm({ ...rmForm, dept: x.id })}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2"
                    style={{ background: on ? SOFT[x.color] : "#fff", color: on ? C[x.color] : "#6B6B6B",
                      border: `2px solid ${on ? C[x.color] : C.line}`, borderRadius: "16px 8px 16px 8px" }}>
                    <ShapeIcon shape={x.shape} color={x.color} size={18} />{x.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-1.5">いつ話すか（任意）</div>
            <input value={rmForm.when} onChange={(e) => setRmForm({ ...rmForm, when: e.target.value })}
              placeholder="例：8/20（木）14:00 に話す"
              className="w-full text-sm font-medium px-3.5 py-2.5 outline-none"
              style={{ background: "#F7F4ED", borderRadius: 16 }} />
          </div>

          <div>
            <div className="text-sm text-slate-400 mb-1.5">参加するメンバー</div>
            <div className="flex flex-wrap gap-1.5">
              {team.filter((u) => u.status === "active").map((u) => {
                const on = rmForm.who.includes(u.id);
                return (
                  <button key={u.id}
                    onClick={() => setRmForm({ ...rmForm,
                      who: on ? rmForm.who.filter((w) => w !== u.id) : [...rmForm.who, u.id] })}
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5"
                    style={{ background: on ? C.ink : "#fff", color: on ? "#fff" : "#6B6B6B",
                      border: `2px solid ${on ? C.ink : C.line}`, borderRadius: "14px 7px 14px 7px" }}>
                    <MemberDot id={u.id} size={20} />{u.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={rmSaveTopic} disabled={!rmForm.title.trim()}
            className="w-full text-white py-3.5 text-sm font-bold disabled:opacity-40"
            style={{ background: C.purple, borderRadius: "24px 12px 24px 12px" }}>追加する</button>
        </div>
      </div>
    );
  };

  const bigAvatar = (u, size = 96) => {
    const col = (u.av && u.av.color) || "purple";
    if (u.av && u.av.kind === "photo" && u.av.src) {
      return (
        <span className="inline-flex rounded-full overflow-hidden border-[5px] border-white shrink-0"
          style={{ width: size, height: size, boxShadow: "0 6px 18px rgba(20,20,20,.16)" }}>
          <img src={u.av.src} alt="" className="w-full h-full object-cover" />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center rounded-full overflow-hidden border-[5px] border-white shrink-0"
        style={{ width: size, height: size, background: SOFT[col] || "#EEE", boxShadow: "0 6px 18px rgba(20,20,20,.16)" }}>
        <ShapeIcon shape={(u.av && u.av.shape) || "flower"} color={col} size={Math.round(size * 0.62)} />
      </span>
    );
  };

  const profileView = () => {
    const u = user(viewProfile || ME);
    const mine = (viewProfile || ME) === ME;
    const cov = u.cover || { kind: "color", color: (u.av && u.av.color) || "purple" };
    return (
      <div className="absolute inset-0 z-30 flex flex-col" style={{ background: C.bg }}>
        {/* カバー */}
        <div className="relative shrink-0" style={{ height: 190 }}>
          {cov.kind === "photo" && cov.src ? (
            <img src={cov.src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full relative overflow-hidden" style={{ background: C[cov.color] || C.purple }}>
              {["flower", "clover", "sun", "hex", "blob", "burst"].map((sh, i) => (
                <span key={sh} className="absolute" style={{
                  opacity: 0.16,
                  left: `${8 + i * 16}%`, top: `${12 + (i % 3) * 26}%`,
                  transform: `rotate(${i * 27}deg)`,
                }}>
                  <ShapeIcon shape={sh} color="#ffffff" size={54 + (i % 3) * 16} />
                </span>
              ))}
            </div>
          )}

          <button onClick={() => setViewProfile(null)} aria-label="閉じる"
            className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,.9)", borderRadius: "16px 8px 16px 8px" }}>
            <X size={20} strokeWidth={2.8} />
          </button>

          {mine && (
            <label className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center cursor-pointer"
              style={{ background: "rgba(255,255,255,.9)", borderRadius: "8px 16px 8px 16px" }} aria-label="カバーを変える">
              <ImageIcon size={18} strokeWidth={2.6} />
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => setTeam((ts) => ts.map((x) => (x.id === ME ? { ...x, cover: { kind: "photo", src: r.result } } : x)));
                  r.readAsDataURL(f);
                }} />
            </label>
          )}
        </div>

        {/* 本体 */}
        <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ marginTop: -48 }}>
          <div className="flex items-end gap-3">
            {bigAvatar(u, 96)}
            <div className="flex-1 min-w-0 pb-2">
              {mine && (
                <button onClick={() => { setViewProfile(null); setScreen("settings"); }}
                  className="text-[11px] font-bold px-3 py-2 bg-white"
                  style={{ border: `2.5px solid ${C.ink}`, borderRadius: "14px 7px 14px 7px" }}>
                  設定で編集する
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="text-2xl font-extrabold">{u.name}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold px-2.5 py-1"
                style={{ background: SOFT[(u.av && u.av.color) || "purple"], color: C[(u.av && u.av.color) || "purple"], borderRadius: "12px 6px 12px 6px" }}>
                {u.role}
              </span>
              {u.admin && (
                <span className="text-[11px] font-bold px-2.5 py-1"
                  style={{ background: "#F1EDE4", color: "#7A7A7A", borderRadius: "12px 6px 12px 6px" }}>管理者</span>
              )}
              {u.status === "invited" && (
                <span className="text-[11px] font-bold px-2.5 py-1"
                  style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "12px 6px 12px 6px" }}>ログイン待ち</span>
              )}
            </div>
            {u.note && <p className="text-sm font-bold leading-relaxed pt-2" style={{ color: "#5B5B5B" }}>{u.note}</p>}
          </div>

          {/* 情報 */}
          <div className="mt-5 space-y-2.5">
            <div className="bg-white p-3.5 flex items-center gap-3"
              style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` }}>
              <ShapeIcon shape="square" color="blue" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>メール</div>
                <div className="text-sm font-bold truncate">{u.email}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 flex items-center gap-3"
              style={{ borderRadius: "13px 26px 13px 26px", border: `2.5px solid ${C.line}` }}>
              <ShapeIcon shape="flower" color="purple" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>ワークスペース</div>
                <div className="text-sm font-bold truncate">{workspace.name}</div>
              </div>
            </div>

            <div className="bg-white p-3.5 flex items-center gap-3"
              style={{ borderRadius: "26px 13px 26px 13px", border: `2.5px solid ${C.line}` }}>
              <ShapeIcon shape="sun" color="yellow" size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>担当している顧客</div>
                <div className="text-sm font-bold">
                  {companies.filter((c) => c.ownerId === u.id).length} 社
                  <span style={{ color: "#8A8A8A" }}>　未完了タスク {
                    companies.flatMap((c) => c.tasks).filter((t) => t.assignee === u.id && !t.done).length
                  } 件</span>
                </div>
              </div>
            </div>
          </div>

          {!mine && (
            <button onClick={() => { const id = u.id; setViewProfile(null); dmWith(id); setScreen("dm"); }}
              className="w-full mt-4 py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: C.purple, borderRadius: "24px 12px 24px 12px" }}>
              <MessageSquare size={16} strokeWidth={2.6} />1対1で話す
            </button>
          )}
        </div>
      </div>
    );
  };

  const dealEditSheet = () => {
    if (!dealSheet) return null;
    const co = companies.find((c) => c.id === dealSheet.id);
    if (!co) return null;
    const d = co.deal;
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setDealSheet(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div className="relative w-full bg-white p-4 space-y-3.5 anim-sheet max-h-full overflow-y-auto"
          style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }}
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <CompanyAvatar co={co} size={44} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-extrabold truncate">{co.name}</div>
              <div className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
                {d.days === 0 ? "今日更新" : `${d.days}日前に更新`}
              </div>
            </div>
            <button onClick={() => setDealSheet(null)} style={{ color: "#8A8A8A" }}><X size={20} /></button>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>いまの状況</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DEAL_STATUS).map(([k, v], i) => {
                const on = d.status === k;
                return (
                  <button key={k} onClick={() => patchDeal(co.id, { status: k, days: 0 })}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-2 ${on ? "anim-chip" : ""}`}
                    style={{ background: on ? C[v.color] : "#fff", color: on ? "#fff" : "#6B6B6B",
                      border: `2px solid ${on ? C[v.color] : C.line}`,
                      borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px" }}>
                    <ShapeIcon shape={v.shape} color={on ? "#ffffff" : C[v.color]} size={14} />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>案件の種類</div>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_TYPES.map((k, i) => {
                const on = co.dealType === k;
                const col = DEAL_TONE[k] || "green";
                return (
                  <button key={k} onClick={() => setField(co.id, "dealType", k)}
                    className="text-xs font-bold px-2.5 py-1.5"
                    style={{ background: on ? C[col] : "#fff", color: on ? (col === "yellow" ? C.ink : "#fff") : "#6B6B6B",
                      border: `2px solid ${on ? C[col] : C.line}`,
                      borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px" }}>{k}</button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>いま何をしているか</div>
            <textarea rows={3} value={d.memo}
              onChange={(e) => patchDeal(co.id, { memo: e.target.value, days: 0 })}
              placeholder="進捗や次の動きを書く"
              className="w-full text-sm font-medium p-3 outline-none resize-none"
              style={{ background: "#F7F4ED", borderRadius: 16 }} />
            <p className="text-[11px] font-bold mt-1" style={{ color: "#B0AA9E" }}>
              書き換えると更新され、動きなしの判定がリセットされます。
            </p>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>金額</div>
              <input value={d.amount} onChange={(e) => patchDeal(co.id, { amount: e.target.value })}
                placeholder="未定"
                className="w-full text-sm font-medium px-3 py-2.5 outline-none"
                style={{ background: "#F7F4ED", borderRadius: 14 }} />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>担当</div>
              <select value={co.ownerId} onChange={(e) => setField(co.id, "ownerId", e.target.value)}
                className="w-full text-sm font-medium px-3 py-2.5 outline-none"
                style={{ background: "#F7F4ED", borderRadius: 14 }}>
                {team.filter((u) => u.status === "active").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { const id = co.id; setDealSheet(null); open(id, "info"); }}
              className="flex-1 py-3 text-sm font-bold"
              style={{ border: `2px solid ${C.line}`, color: "#6B6B6B", borderRadius: "20px 10px 20px 10px" }}>
              会社を開く
            </button>
            <button onClick={() => finishDeal(co.id)}
              className="flex-1 py-3 text-sm font-bold"
              style={{ border: `2.5px solid ${C.green}`, color: C.green, borderRadius: "10px 20px 10px 20px" }}>
              完了にする
            </button>
          </div>
        </div>
      </div>
    );
  };

  const docEditSheet = () => {
    if (!docSheet) return null;
    const k = DOC_KINDS[docSheet.kind] || DOC_KINDS.other;
    const e = fileExt(docSheet.name);
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setDocSheet(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div className="relative w-full bg-white p-4 space-y-3.5 anim-sheet max-h-full overflow-y-auto"
          style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }}
          onClick={(e2) => e2.stopPropagation()}>
          <div className="flex items-start gap-3">
            <span className="relative shrink-0">
              <ShapeIcon shape={k.shape} color={EXT_COLOR[e] || k.color} size={52} />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-white">
                {e.toUpperCase()}
              </span>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold leading-snug break-all">{docSheet.name}</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: "#8A8A8A" }}>
                {docSheet.size} ・ {docSheet.at} ・ {user(docSheet.by).name}
              </div>
            </div>
            <button onClick={() => setDocSheet(null)} style={{ color: "#8A8A8A" }}><X size={20} /></button>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>種類</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DOC_KINDS).map(([kk, v], i) => {
                const on = docSheet.kind === kk;
                return (
                  <button key={kk} onClick={() => patchDoc(docSheet.cid, docSheet.id, { kind: kk })}
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5"
                    style={{ background: on ? C[v.color] : "#fff", color: on ? "#fff" : "#6B6B6B",
                      border: `2px solid ${on ? C[v.color] : C.line}`,
                      borderRadius: i % 2 ? "14px 7px 14px 7px" : "7px 14px 7px 14px" }}>
                    <ShapeIcon shape={v.shape} color={on ? "#ffffff" : C[v.color]} size={14} />
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold mb-1.5" style={{ color: "#8A8A8A" }}>メモ</div>
            <textarea rows={2} value={docSheet.note}
              onChange={(e2) => patchDoc(docSheet.cid, docSheet.id, { note: e2.target.value })}
              placeholder="更新時期や注意点など"
              className="w-full text-sm font-medium p-3 outline-none resize-none"
              style={{ background: "#F7F4ED", borderRadius: 16 }} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => { toggleDoc(docSheet.cid, docSheet.id); setDocSheet({ ...docSheet, pinned: !docSheet.pinned }); }}
              className="flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5"
              style={{ border: `2.5px solid ${docSheet.pinned ? C.yellow : C.line}`,
                color: docSheet.pinned ? "#9A6B00" : "#6B6B6B", borderRadius: "20px 10px 20px 10px" }}>
              <Star size={15} strokeWidth={2.6} fill={docSheet.pinned ? C.yellow : "none"} />
              {docSheet.pinned ? "よく使うから外す" : "よく使うに入れる"}
            </button>
            <button onClick={() => notify("書類を開きます")}
              className="flex-1 py-3 text-sm font-bold text-white flex items-center justify-center gap-1.5"
              style={{ background: C.purple, borderRadius: "10px 20px 10px 20px" }}>
              <Download size={15} strokeWidth={2.6} />開く
            </button>
          </div>
        </div>
      </div>
    );
  };

  const inviteSheet = () => {
    const isGroup = String(inviteFor).startsWith("g:");
    const gid = isGroup ? String(inviteFor).slice(2) : null;
    const g = isGroup ? groups.find((x) => x.id === gid) : null;
    const c = !isGroup ? companies.find((x) => x.id === inviteFor) : null;
    const current = isGroup ? (g ? g.members : []) : (c ? c.members : []);
    const label = isGroup ? (g ? g.name : "") : (c ? `#${channelName(c)}` : "");
    const cands = team.filter((u) => u.status === "active" && !current.includes(u.id));
    return (
      <div className="absolute inset-0 z-30 flex items-end" onClick={() => setInviteFor(null)}>
        <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
        <div style={{ borderRadius: "32px 32px 0 0", borderTop: `3px solid ${C.ink}` }} className="relative w-full bg-white p-4 space-y-3 anim-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-extrabold">メンバーを招待</div>
              <div className="text-sm text-slate-400">{label}</div>
            </div>
            <button onClick={() => setInviteFor(null)} className="text-slate-400"><X size={20} /></button>
          </div>
          {cands.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-slate-400">追加できるメンバーがいません。</p>
              <button onClick={() => { setInviteFor(null); setScreen("settings"); }}
                className="text-sm font-bold" style={{ color: C.purple }}>メンバーとして登録する</button>
            </div>
          ) : (
            <div className="space-y-1">
              {cands.map((u) => (
                <button key={u.id}
                  onClick={() => {
                    if (isGroup) inviteToGroup(gid, u.id); else invite(c.id, u.id);
                    notify(`${u.name} さんを招待しました`);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-2xl">
                  <MemberDot id={u.id} size={32} />
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm truncate">{u.name}</div>
                    <div className="text-sm text-slate-400 truncate">{u.role}</div>
                  </div>
                  <span className="text-sm text-violet-600 shrink-0">追加</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const rmOpen = ["sales", "is", "cs", "dev"]
    .flatMap((k) => agenda[k][mk(rmMi)] || [])
    .filter((t) => t.state !== "decided").length;

  const tabItems = [
    ["list", "customers", "顧客", 0],
    ["channels", "channels", "チャンネル", totalUnread + groups.reduce((n, g) => n + g.unread, 0) + totalDm()],
    ["scan", "scan", "スキャン", 0],
    ["tasks", "tasks", "タスク", 0],
    ["roadmap", "roadmap", "計画", rmOpen],
  ];
  const showTabs = !booting && authed && !locked && tabItems.some(([v]) => v === screen);
  const noScroll = ["list", "channel", "detail", "compose", "schedule", "scan", "booking", "group", "dm"].includes(screen);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 appfont" style={{ background: "#E8E4DA" }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800;900&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap');
.appfont, .appfont input, .appfont textarea, .appfont select, .appfont button {
  font-family: 'M PLUS Rounded 1c', 'Zen Maru Gothic', system-ui, sans-serif;
  letter-spacing: 0.015em;
}
.appfont { -webkit-font-smoothing: antialiased; }
/* 丸ゴシックに合わせた太さの調整 */
.appfont .font-extrabold { font-weight: 800; }
.appfont .font-bold { font-weight: 700; }
.appfont .font-medium { font-weight: 500; }
.deck::-webkit-scrollbar { display: none; }
.deck { scrollbar-width: none; }

/* ── 起動アニメーション ── */
@keyframes bootSwap {
  0%   { transform: scale(.7) rotate(-18deg); opacity: 0; }
  60%  { transform: scale(1.06) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.anim-bootswap { display:inline-flex; animation: bootSwap 260ms cubic-bezier(.22,1,.36,1) both; }
@keyframes bootPop { 0% { transform: scale(.5); opacity:0; } 60% { transform: scale(1.1); opacity:1; } 100% { transform: scale(1); } }
.anim-bootpop { display:inline-flex; animation: bootPop 560ms cubic-bezier(.34,1.56,.64,1) both; }
@keyframes bootRise { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: none; opacity: 1; } }
.anim-bootrise { animation: bootRise 600ms cubic-bezier(.22,1,.36,1) both; }
@keyframes bootBlink { 0%,100% { opacity:.25; transform: scale(.85); } 50% { opacity:1; transform: scale(1); } }
.anim-bootblink { animation: bootBlink 1s ease-in-out infinite; }

/* ── ボタンの基本挙動：沈んで、跳ねて戻る ── */
.appfont button {
  transition: transform .16s cubic-bezier(.34,1.56,.64,1), box-shadow .16s ease, filter .16s ease;
  -webkit-tap-highlight-color: transparent;
}
.appfont button.is-press { transform: scale(.93) translateY(1px); filter: brightness(.97); }
.appfont button.is-release { animation: springBack .42s cubic-bezier(.22,1,.36,1); }
@keyframes springBack {
  0%   { transform: scale(.93) translateY(1px); }
  42%  { transform: scale(1.045) translateY(-2px); }
  70%  { transform: scale(.985); }
  100% { transform: scale(1); }
}

/* 押した場所から色がふわっと広がる */
.bloom {
  position: absolute; border-radius: 999px; pointer-events: none; z-index: 60;
  transform: translate(-50%,-50%) scale(0); opacity: .38;
  animation: bloom .52s cubic-bezier(.22,1,.36,1) forwards;
}
@keyframes bloom {
  0%   { transform: translate(-50%,-50%) scale(0);   opacity: .34; }
  100% { transform: translate(-50%,-50%) scale(1);   opacity: 0; }
}

/* アイコンが軽く弾む */
@keyframes iconPop { 0% { transform: scale(.72) rotate(-14deg); } 55% { transform: scale(1.14) rotate(5deg); } 100% { transform: scale(1) rotate(0); } }
.anim-iconpop { animation: iconPop .46s cubic-bezier(.22,1,.36,1); }

/* ナビの選択：背景の形が広がる */
@keyframes navBlob { 0% { transform: scale(0); opacity:0; } 60% { transform: scale(1.1); opacity:1; } 100% { transform: scale(1); opacity:1; } }
.anim-navblob { animation: navBlob .4s cubic-bezier(.22,1,.36,1); }

/* チェックが跳ねて入る */
@keyframes checkIn { 0% { transform: scale(0) rotate(-30deg); } 60% { transform: scale(1.25) rotate(6deg); } 100% { transform: scale(1) rotate(0); } }
.anim-check { animation: checkIn .34s cubic-bezier(.22,1,.36,1); }

/* バッジがポンと出る */
@keyframes badgePop { 0% { transform: scale(0); } 62% { transform: scale(1.3); } 100% { transform: scale(1); } }
.anim-badge { animation: badgePop .38s cubic-bezier(.22,1,.36,1); }

/* 選択チップが少し傾いて戻る */
@keyframes chipTilt { 0% { transform: rotate(0) scale(1); } 40% { transform: rotate(-3deg) scale(1.06); } 100% { transform: rotate(0) scale(1); } }
.anim-chip { animation: chipTilt .4s cubic-bezier(.22,1,.36,1); }

/* アクションカードのアイコンが押すと回る */
.appfont button .qa-ic { transition: transform .3s cubic-bezier(.34,1.56,.64,1); }
.appfont button:hover .qa-ic { transform: rotate(-8deg) scale(1.06); }
.appfont button.is-press .qa-ic { transform: rotate(10deg) scale(.9); }

/* リスト・タブの下線がにゅっと伸びる */
.appfont select { transition: background-color .2s ease; }
`}</style>
      <div ref={shellRef} className="w-full max-w-sm overflow-hidden flex flex-col relative" style={{ height: 780, background: C.bg, borderRadius: 34, border: `3px solid ${C.ink}` }}>
        <div className="px-6 pt-3 pb-1 flex justify-between items-center shrink-0">
          <span className="text-sm font-bold">9:41</span>
          <div className="flex items-center gap-1.5">
            <Signal size={15} strokeWidth={2} />
            <Wifi size={15} strokeWidth={2} />
            <BatteryFull size={19} strokeWidth={1.6} />
          </div>
        </div>
        <div className={`flex-1 min-h-0 ${!authed || noScroll ? "overflow-hidden" : "overflow-y-auto"} ${authed && showTabs ? "pb-24" : ""}`}>
          {booting ? bootScreen() : !authed ? authScreen() : locked ? lockScreen() : (
          <div key={screen} className={`anim-screen ${noScroll ? "h-full" : ""}`}>
          {screen === "list" && listScreen()}
          {screen === "scan" && scanScreen()}
          {screen === "result" && resultScreen()}
          {screen === "detail" && detailScreen()}
          {screen === "compose" && composeScreen()}
          {screen === "schedule" && scheduleScreen()}
          {screen === "booking" && bookingScreen()}
          {screen === "channels" && channelsScreen()}
          {screen === "group" && groupScreen()}
          {screen === "dm" && dmScreen()}
          {screen === "channel" && active && channelBody(active, false)}
          {screen === "tasks" && tasksScreen()}
          {screen === "inbox" && inboxScreen()}
          {screen === "settings" && settingsScreen()}
          {screen === "roadmap" && roadmapScreen()}
          </div>
          )}
        </div>
        {toast && <div className="absolute left-4 right-4 bottom-24 z-20 bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 text-center">{toast}</div>}
        {inviteFor && inviteSheet()}
        {taskForm && taskSheet()}
        {groupForm && groupSheet()}
        {memoDraft && memoSheet()}
        {viewProfile !== null && profileView()}
        {rmSheet && rmJoinSheet()}
        {rmForm && rmTopicSheet()}
        {dealSheet && dealEditSheet()}
        {docSheet && docEditSheet()}
        {showTabs && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white flex items-end justify-around px-2 pt-2 pb-5"
            style={{ borderTop: `2px solid ${C.line}` }}>
            {tabItems.map(([v, key, label, badge]) => {
              const on = screen === v;
              return (
                <button key={v} onClick={() => setScreen(v)} aria-label={label}
                  className="relative flex-1 flex flex-col items-center gap-1 px-1 py-1">
                  {on && (
                    <span key={`b-${v}`} className="absolute anim-navblob"
                      style={{ width: 52, height: 52, top: -2, borderRadius: "22px 10px 22px 10px",
                        background: SOFT[FEATURE[key].color] || SOFT.purple }} />
                  )}
                  <span key={on ? `on-${v}` : `off-${v}`}
                    className={`relative ${on ? "anim-iconpop" : ""}`}
                    style={{ transition: "transform .24s cubic-bezier(.34,1.56,.64,1)", transform: on ? "translateY(-3px)" : "none" }}>
                    <FeatureIcon name={key} size={34} />
                    {badge > 0 && (
                      <span className="absolute -top-0.5 -right-1 w-3 h-3 rounded-full border-2 border-white anim-badge"
                        style={{ background: C.red }} />
                    )}
                  </span>
                  <span className="relative text-[11px] font-bold whitespace-nowrap"
                    style={{ color: on ? C.purple : "#9AA0A6", transition: "color .2s ease" }}>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
