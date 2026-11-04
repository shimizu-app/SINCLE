import "server-only";
import { createSign } from "node:crypto";
import { EXPECTED_PEM_BODY, normalizePem } from "./pem";

/**
 * Google Cloud Vision で名刺の文字を読む（SPEC 1章・フェーズ4）。
 *
 * ライブラリは足していない。サービスアカウントの鍵で JWT を自分で署名し、
 * アクセストークンに交換する。やることはこれだけなので、
 * google-auth-library を入れるほどの話ではない。
 *
 * 鍵は GOOGLE_VISION_SA_KEY に入れる。
 * JSON をそのまま入れても、base64 にして入れてもよい。
 * Vercel の環境変数は改行を含められるが、base64 のほうが事故が少ない。
 *
 *   base64 -w0 nico-app-xxxx.json      # Linux
 *   base64 -i nico-app-xxxx.json       # macOS
 *
 * NEXT_PUBLIC_ を頭に付けてはいけない。付けるとブラウザに焼き込まれる。
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const SCOPE = "https://www.googleapis.com/auth/cloud-vision";

type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

/** 読み取りが駄目だったとき、何をすれば直るのかを画面に出すための区別 */
export type VisionFailure =
  | { kind: "unconfigured"; message: string }
  | { kind: "key"; message: string }
  | { kind: "billing"; message: string }
  | { kind: "permission"; message: string }
  | { kind: "google"; message: string };

export type VisionResult =
  | { ok: true; text: string }
  | { ok: false; failure: VisionFailure };

/* ── 鍵の読み出し ───────────────────────────────────────── */

/**
 * 鍵の読み出し。駄目だった理由まで返す。
 *
 * 「変数が無い」と「貼ったけれど中身が壊れている」を
 * 同じ文言にしてはいけない。直し方がまったく違うのに、
 * 画面を見ても区別がつかなくなる。
 */
type KeyRead =
  | { ok: true; sa: ServiceAccount }
  | { ok: false; reason: string };

function readServiceAccount(): KeyRead {
  const raw = process.env.GOOGLE_VISION_SA_KEY?.trim();

  if (raw === undefined) {
    return {
      ok: false,
      reason:
        "GOOGLE_VISION_SA_KEY が設定されていません。" +
        "Vercel の Settings → Environment Variables に入れて、Redeploy してください。",
    };
  }
  if (raw === "") {
    return {
      ok: false,
      reason:
        "GOOGLE_VISION_SA_KEY は登録されていますが、中身が空です。" +
        "いったん削除してから入れ直してください。",
    };
  }

  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      reason:
        `GOOGLE_VISION_SA_KEY は入っていますが（${raw.length}文字）、中身が読めません。` +
        `${shapeOf(raw)}サービスアカウントのJSONは2,300文字くらいあります。` +
        "ファイルの中身を丸ごと貼り直してください（cat ファイル名 | pbcopy が確実です）。",
    };
  }

  const sa = parsed as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key) {
    return {
      ok: false,
      reason:
        "GOOGLE_VISION_SA_KEY の中身は読めましたが、client_email か private_key がありません。" +
        "サービスアカウントの鍵（JSON）とは別のファイルを貼っている可能性があります。",
    };
  }

  // 説明のために見せた見本（◯ で伏せたもの）がそのまま貼られることがある。
  // 鍵として使える文字だけを拾うと「1600」などが残り、短すぎる鍵に見えてしまう。
  if (/[◯○〇…]|（.*文字ほど）/.test(sa.private_key)) {
    return {
      ok: false,
      reason:
        "GOOGLE_VISION_SA_KEY に、説明用の見本（◯で伏せたもの）が入っています。" +
        "本物の鍵は、Google Cloud からダウンロードしたJSONファイルの中にあります。",
    };
  }

  // 貼る途中で秘密鍵の改行が崩れることがある（空白・欠落・文字の \n）。
  // 本体が欠けていなければ、組み直して元に戻せる。
  const pem = normalizePem(sa.private_key);
  if (!pem.ok) {
    return { ok: false, reason: `GOOGLE_VISION_SA_KEY の秘密鍵が読めません。${pem.reason}` };
  }
  if (pem.bodyLength < EXPECTED_PEM_BODY * 0.9) {
    return {
      ok: false,
      reason:
        `GOOGLE_VISION_SA_KEY の秘密鍵が短すぎます（本体 ${pem.bodyLength}文字、` +
        `本来は${EXPECTED_PEM_BODY}文字ほど）。途中で切れているので、ファイルの中身を丸ごと貼り直してください。`,
    };
  }

  return {
    ok: true,
    sa: {
      client_email: sa.client_email,
      private_key: pem.pem,
      project_id: sa.project_id,
    },
  };
}

/**
 * 入っているものが何に見えるかを一言で返す。
 *
 * 値そのものは出さない。画面に出す文字列なので、
 * 秘密鍵の断片が混ざってはいけない。
 * 「形」だけを伝えて、貼り間違いの種類を切り分ける。
 */
function shapeOf(raw: string): string {
  if (raw.includes("BEGIN PRIVATE KEY")) {
    return "秘密鍵の部分だけが入っているようです。JSON全体が必要です。";
  }
  if (raw.startsWith("{")) {
    return raw.trimEnd().endsWith("}")
      ? "JSON の形には見えますが、途中が壊れているようです。"
      : "JSON の途中で切れています（最後の } がありません）。";
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    return "base64 のようですが、戻してもJSONになりません。途中で切れている可能性があります。";
  }
  return "JSON でも base64 でもないものが入っているようです。";
}

/** 鍵が使えるかだけを返す。画面の出し分けに使う。 */
export function visionConfigured(): boolean {
  return readServiceAccount().ok || Boolean(process.env.GOOGLE_VISION_API_KEY?.trim());
}

/* ── アクセストークン ───────────────────────────────────── */

// 1時間もつので取り直さない。サーバーレスでは使い回せないこともあるが、
// 同じインスタンスに連続で来たぶんは節約できる。
let cached: { token: string; expires: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(sa.private_key)
    .toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? `トークンの取得に失敗しました（${res.status}）`);
  }

  cached = { token: body.access_token, expires: Date.now() + 3500_000 };
  return body.access_token;
}

/* ── 読み取り ───────────────────────────────────────────── */

/**
 * 画像から文字を取り出す。
 *
 * DOCUMENT_TEXT_DETECTION は行の並びを保ったまま返すので、
 * 名刺のような小さな紙では TEXT_DETECTION より素行がよい。
 */
export async function readCard(imageBase64: string): Promise<VisionResult> {
  const key = readServiceAccount();

  // サービスアカウントの鍵が使えなければ、APIキーを使う。
  // APIキーは画面に出る短い文字列なので、ファイルを扱わずに済む。
  if (!key.ok) {
    const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
    if (apiKey) return callVision(imageBase64, { apiKey });

    return {
      ok: false,
      failure: { kind: "unconfigured", message: `${key.reason}（いまは手入力で登録できます）` },
    };
  }

  let token: string;
  try {
    token = await accessToken(key.sa);
  } catch (error) {
    const message = messageOf(error);
    // 署名の段階で落ちたなら、Google に断られたのではなく鍵が開けていない。
    // 「権限」と出すと Google 側の設定を疑わせてしまうので分ける。
    if (/DECODER|PEM|asn1|bad base64|unsupported/i.test(message)) {
      return {
        ok: false,
        failure: {
          kind: "key",
          message:
            "秘密鍵を開けませんでした。GOOGLE_VISION_SA_KEY の中身が崩れています。" +
            "ダウンロードしたJSONファイルの中身を丸ごと貼り直してください。",
        },
      };
    }
    return { ok: false, failure: { kind: "permission", message } };
  }

  return callVision(imageBase64, { token });
}

/** Vision を呼ぶ。認証はアクセストークンか APIキーのどちらか。 */
async function callVision(
  imageBase64: string,
  auth: { token: string } | { apiKey: string }
): Promise<VisionResult> {
  const url = "apiKey" in auth
    ? `${VISION_URL}?key=${encodeURIComponent(auth.apiKey)}`
    : VISION_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...("token" in auth ? { authorization: `Bearer ${auth.token}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          // 日本語と英語が混ざるのが普通なので両方を伝える
          imageContext: { languageHints: ["ja", "en"] },
        },
      ],
    }),
  });

  const body = (await res.json()) as {
    error?: { message?: string; status?: string };
    responses?: { error?: { message?: string }; fullTextAnnotation?: { text?: string } }[];
  };

  const error = body.error ?? body.responses?.[0]?.error;
  if (!res.ok || error) {
    return { ok: false, failure: classify(res.status, error?.message ?? "") };
  }

  const text = body.responses?.[0]?.fullTextAnnotation?.text ?? "";
  return { ok: true, text };
}

/* ── 小物 ───────────────────────────────────────────────── */

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Google の返事から、利用者が次に何をすればよいかを決める。
 * ここを「失敗しました」で済ませると、課金未設定なのか鍵が違うのか分からない。
 */
function classify(status: number, message: string): VisionFailure {
  if (/API key not valid/i.test(message)) {
    return {
      kind: "key",
      message: "GOOGLE_VISION_API_KEY が正しくありません。Google Cloud の画面からコピーし直してください。",
    };
  }
  if (/are blocked|API_KEY_SERVICE_BLOCKED/i.test(message)) {
    return {
      kind: "permission",
      message:
        "このAPIキーでは Cloud Vision を使えない設定になっています。" +
        "Google Cloud でキーの「APIの制限」に Cloud Vision API を入れてください。",
    };
  }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) {
    return {
      kind: "permission",
      message: "Cloud Vision API が有効になっていません。Google Cloud の「APIとサービス」で有効にしてください。",
    };
  }
  if (/billing/i.test(message)) {
    return {
      kind: "billing",
      message:
        "Google Cloud のプロジェクトに課金アカウントが紐づいていません。" +
        "Vision は月1,000枚まで無料ですが、課金アカウントの登録自体は必要です。",
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "permission",
      message: `Google に断られました（${status}）。${message}`,
    };
  }
  return { kind: "google", message: message || `読み取りに失敗しました（${status}）。` };
}
