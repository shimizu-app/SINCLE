import "server-only";
import { createSign } from "node:crypto";

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
  | { kind: "billing"; message: string }
  | { kind: "permission"; message: string }
  | { kind: "google"; message: string };

export type VisionResult =
  | { ok: true; text: string }
  | { ok: false; failure: VisionFailure };

/* ── 鍵の読み出し ───────────────────────────────────────── */

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_VISION_SA_KEY?.trim();
  if (!raw) return null;

  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const sa = parsed as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key) return null;

  return {
    client_email: sa.client_email,
    // 環境変数に貼るとき \n が文字列のまま入ることがある
    private_key: sa.private_key.replace(/\\n/g, "\n"),
    project_id: sa.project_id,
  };
}

/** 鍵が使えるかだけを返す。画面の出し分けに使う。 */
export function visionConfigured(): boolean {
  return readServiceAccount() !== null;
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
  const sa = readServiceAccount();
  if (!sa) {
    return {
      ok: false,
      failure: {
        kind: "unconfigured",
        message:
          "名刺の読み取りの鍵（GOOGLE_VISION_SA_KEY）が入っていません。手入力で登録できます。",
      },
    };
  }

  let token: string;
  try {
    token = await accessToken(sa);
  } catch (error) {
    return {
      ok: false,
      failure: { kind: "permission", message: messageOf(error) },
    };
  }

  const res = await fetch(VISION_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
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
