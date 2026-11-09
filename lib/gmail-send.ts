import "server-only";
import { GMAIL_SEND_SCOPE, googleLink } from "./google";
import { buildMime, toGmailRaw, type OutgoingMail } from "./mime";

/**
 * Gmail で送る（SCREENS 9「送信すると」）。人が「送信」を押したときだけ呼ぶ。
 * 権限は送信だけ（gmail.send）。受信箱の中身を消したり書き換えたりはしない。
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type SendState =
  | { ok: true; token: string; email: string | null }
  | { ok: false; reason: "unconfigured" | "disconnected" | "expired" | "no_permission" | "needs_migration" };

export async function gmailSendState(workspaceId: string): Promise<SendState> {
  const link = await googleLink(workspaceId);
  if (link.state === "connected") {
    if (!link.scopes.includes(GMAIL_SEND_SCOPE)) return { ok: false, reason: "no_permission" };
    return { ok: true, token: link.token, email: link.email };
  }
  return { ok: false, reason: link.state };
}

export async function sendViaGmail(
  token: string,
  mail: OutgoingMail,
  threadId?: string | null
): Promise<{ id: string; threadId: string; messageId: string | null } | { error: string; status: number }> {
  const res = await fetch(`${API}/messages/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: toGmailRaw(buildMime(mail)), ...(threadId ? { threadId } : {}) }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok || !body.id) {
    return { error: body.error?.message ?? `送れませんでした（${res.status}）`, status: res.status };
  }

  // 送ったメールの Message-ID（取り込みの重複を見る鍵。021）。Gmail が付け直すので読み直す
  let messageId: string | null = null;
  try {
    const meta = await fetch(
      `${API}/messages/${encodeURIComponent(body.id)}?format=metadata&metadataHeaders=Message-ID`,
      { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    const m = (await meta.json()) as { payload?: { headers?: { name: string; value: string }[] } };
    messageId =
      m.payload?.headers?.find((h) => h.name.toLowerCase() === "message-id")?.value?.trim().replace(/^<|>$/g, "") ?? null;
  } catch {
    // 読めなくても送れてはいる
  }
  return { id: body.id, threadId: body.threadId ?? body.id, messageId };
}
