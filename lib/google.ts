import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hkdfSync } from "node:crypto";
import { decryptWith, encryptWith, parseKey } from "./token-crypto";

/**
 * Google カレンダー連携（SPEC 6章・フェーズ6）。
 *
 * ライブラリは足していない。OAuth のやりとりは fetch だけで済む。
 *
 * 必要な環境変数（サーバー専用。NEXT_PUBLIC_ を付けないこと）
 *   GOOGLE_OAUTH_CLIENT_SECRET  OAuth クライアントのシークレット（これだけは必須）
 *
 * 任意
 *   GOOGLE_OAUTH_CLIENT_ID      OAuth クライアントのID。無ければ ORINAMI のものを使う。
 *                               IDは同意画面のURLに必ず載る値で、秘密ではない
 *   TOKEN_ENCRYPTION_KEY        トークンを暗号化する鍵（32バイトを base64）。
 *                               無ければクライアントシークレットから鍵を作る。
 *                               別に入れたほうが守りは固い（片方が漏れても開けない）
 *
 * 権限は読み取りだけ（calendar.readonly）。SPEC 6章「権限スコープは必要最小限に」。
 * 予定を書き込む機能（タスクのカレンダー登録・日程調整）を入れるときに広げる。
 * Gmail（gmail.readonly）は、Gmail をつなぐと決めた人にだけ追加で求める（lib/gmail.ts）。
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CAL_API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** 連携の入口と戻り先。登録するリダイレクトURIはこれ */
export const CALLBACK_PATH = "/api/google/callback";

/* ── 設定 ───────────────────────────────────────────────── */

type Config = { clientId: string; clientSecret: string; key: Buffer };

/** ORINAMI（nico-app-512610）の「Web client」。秘密ではない */
const DEFAULT_CLIENT_ID = "493448789124-2mddeld1qq4a9rd9cm0gfs5gfpon556c.apps.googleusercontent.com";

/** 足りない環境変数を返す。揃っていれば config を返す */
export function googleConfig(): { ok: true; config: Config } | { ok: false; missing: string[] } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientSecret) return { ok: false, missing: ["GOOGLE_OAUTH_CLIENT_SECRET"] };

  // 暗号化の鍵。専用の鍵が入っていればそれを、無ければシークレットから作る。
  // 鍵の文字列を人の手で受け渡さずに済むようにするため。
  const key =
    parseKey(process.env.TOKEN_ENCRYPTION_KEY) ??
    Buffer.from(hkdfSync("sha256", clientSecret, "syncle", "integration-token-v1", 32));

  return { ok: true, config: { clientId, clientSecret, key } };
}

/* ── 同意画面へ ─────────────────────────────────────────── */

/** Gmail の読み取り。メール画面・設定の「Gmail をつなぐ」から来たときだけ足す */
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function authorizeUrl(
  config: Config,
  redirectUri: string,
  state: string,
  extraScopes: string[] = []
): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...GOOGLE_SCOPES, ...extraScopes].join(" "),
    // 1時間で切れるアクセストークンを取り直すための refresh_token をもらう
    access_type: "offline",
    // 2回目以降も refresh_token を返してもらうため、毎回同意を出す
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

/* ── 戻ってきたら ───────────────────────────────────────── */

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

/** 同意の後に受け取った code を、トークンに換えて保存する */
export async function connectWithCode(
  workspaceId: string,
  code: string,
  redirectUri: string
): Promise<{ ok: true; email: string | null; scopes: string[] } | { ok: false; message: string }> {
  const cfg = googleConfig();
  if (!cfg.ok) return { ok: false, message: `設定が足りません：${cfg.missing.join("、")}` };
  const { config } = cfg;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json()) as TokenResponse;
  if (!res.ok || !body.access_token) {
    return { ok: false, message: body.error_description ?? body.error ?? `連携に失敗しました（${res.status}）` };
  }

  // id_token は Google の token エンドポイントから TLS で直接受け取ったもの。
  // 中身（どのアカウントか）を読むだけなので、署名の検証はしない。
  const email = emailFromIdToken(body.id_token);
  const scopes = (body.scope ?? "").split(" ").filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_integration", {
    p_workspace_id: workspaceId,
    p_provider: "google",
    p_access_token: encryptWith(config.key, body.access_token),
    p_refresh_token: body.refresh_token ? encryptWith(config.key, body.refresh_token) : undefined,
    p_expires_at: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
    p_scopes: scopes,
    p_account_email: email ?? undefined,
  });
  if (error) return { ok: false, message: error.message };

  return { ok: true, email, scopes };
}

function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/* ── 連携の状態とアクセストークン ───────────────────────── */

export type GoogleLink =
  | { state: "unconfigured"; missing: string[] }
  | { state: "needs_migration" }
  | { state: "disconnected" }
  | { state: "expired"; email: string | null }
  | { state: "connected"; email: string | null; calendarIds: string[]; token: string };

type Row = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_ids: unknown;
  account_email: string | null;
};

/**
 * いま使えるアクセストークンを返す。切れていれば取り直して保存する。
 *
 * 取り直せない（invalid_grant）のは、本人が Google 側で許可を取り消したか、
 * 同意画面が「テスト中」のまま7日たったとき。どちらも、つなぎ直せば戻る。
 */
export async function googleLink(workspaceId: string): Promise<GoogleLink> {
  const cfg = googleConfig();
  if (!cfg.ok) return { state: "unconfigured", missing: cfg.missing };
  const { config } = cfg;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_integration", {
    p_workspace_id: workspaceId,
    p_provider: "google",
  });

  // 020 を当てる前のデータベースには関数が無い
  if (error) return /function|does not exist|Could not find/i.test(error.message)
    ? { state: "needs_migration" }
    : { state: "disconnected" };

  const row = ((data as unknown as Row[] | null) ?? [])[0];
  if (!row) return { state: "disconnected" };

  const email = row.account_email;
  const calendarIds = Array.isArray(row.calendar_ids) ? (row.calendar_ids as string[]) : [];

  // まだ1分以上もつなら、そのまま使う
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) {
    try {
      return { state: "connected", email, calendarIds, token: decryptWith(config.key, row.access_token) };
    } catch {
      // 鍵を入れ替えた等で開けない。つなぎ直してもらう
      return { state: "expired", email };
    }
  }

  if (!row.refresh_token) return { state: "expired", email };

  let refresh: string;
  try {
    refresh = decryptWith(config.key, row.refresh_token);
  } catch {
    return { state: "expired", email };
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as TokenResponse;
  if (!res.ok || !body.access_token) return { state: "expired", email };

  await supabase.rpc("refresh_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: "google",
    p_access_token: encryptWith(config.key, body.access_token),
    p_expires_at: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
  });

  return { state: "connected", email, calendarIds, token: body.access_token };
}

/** 連携を外す。Google 側の許可も取り消してから、こちらの記録を消す */
export async function disconnectGoogle(workspaceId: string): Promise<{ error?: string }> {
  const cfg = googleConfig();
  const supabase = await createClient();

  if (cfg.ok) {
    const { data } = await supabase.rpc("my_integration", {
      p_workspace_id: workspaceId,
      p_provider: "google",
    });
    const row = ((data as unknown as Row[] | null) ?? [])[0];
    const packed = row?.refresh_token ?? row?.access_token;
    if (packed) {
      try {
        const token = decryptWith(cfg.config.key, packed);
        // 取り消しに失敗しても、こちらの記録は消す（Google 側からも外せるので）
        await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
      } catch {
        // 開けない鍵なら、取り消しは諦めて記録だけ消す
      }
    }
  }

  const { error } = await supabase.rpc("delete_integration", {
    p_workspace_id: workspaceId,
    p_provider: "google",
  });
  return error ? { error: error.message } : {};
}

/* ── カレンダー ─────────────────────────────────────────── */

export type GoogleCalendar = { id: string; name: string; color: string | null; primary: boolean };

export async function listCalendars(token: string): Promise<GoogleCalendar[] | { error: string }> {
  const res = await fetch(`${CAL_API}/users/me/calendarList?minAccessRole=reader&maxResults=100`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    items?: { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean }[];
    error?: { message?: string };
  };
  if (!res.ok) return { error: body.error?.message ?? `カレンダーの一覧を取れませんでした（${res.status}）` };

  return (body.items ?? [])
    .map((c) => ({
      id: c.id,
      name: c.summaryOverride ?? c.summary ?? c.id,
      color: c.backgroundColor ?? null,
      primary: Boolean(c.primary),
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

export type GoogleEvent = {
  id: string;
  calendarId: string;
  title: string;
  at: string;
  allDay: boolean;
};

/**
 * 選んだカレンダーの、期間内の予定。
 * 繰り返しの予定は1回ずつに展開してもらう（singleEvents）。
 * 取り消された予定は出さない。
 */
export async function listEvents(
  token: string,
  calendarIds: string[],
  from: Date,
  to: Date
): Promise<GoogleEvent[]> {
  const ids = calendarIds.length ? calendarIds : ["primary"];

  const perCalendar = await Promise.all(
    ids.map(async (calendarId) => {
      const q = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        items?: {
          id: string;
          status?: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
        }[];
      };
      return (body.items ?? [])
        .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
        .map((e) => ({
          id: `${calendarId}:${e.id}`,
          calendarId,
          // 非公開の予定は題名が来ない
          title: e.summary?.trim() || "（予定あり）",
          at: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
          allDay: !e.start?.dateTime,
        }));
    })
  );

  return perCalendar.flat();
}
