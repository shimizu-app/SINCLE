import "server-only";
import { createClient } from "@/lib/supabase/server";
import { GMAIL_READ_SCOPE, googleLink, type GoogleLink } from "./google";
import { isGmailScope, type GmailScope } from "./mail-parse";
import { runGmailSync, type GmailStats, type SyncResult } from "./gmail-sync";

export type { GmailStats, SyncResult } from "./gmail-sync";

/**
 * Gmail の取り込み（SPEC 6章・フェーズ6）。
 *
 * Google カレンダーと同じ連携（integrations の google の行）に、Gmail の読み取り権限を足して使う。
 * 権限は読み取りだけ（gmail.readonly）。送信・削除・既読はしない。
 *
 * 取り込みは「開いたとき」と「ボタンを押したとき」。裏で勝手には回さない。
 * 中身の決め方（どれを入れて、どれを入れないか）は lib/mail-parse.ts、
 * Gmail から読んで保存するまでの流れは lib/gmail-sync.ts。
 */

export const GMAIL_SCOPE = GMAIL_READ_SCOPE;

export type GmailState =
  | { state: "unconfigured"; missing: string[] }
  | { state: "needs_migration"; migration: "020" | "021" }
  | { state: "disconnected" }
  | { state: "expired"; email: string | null }
  | { state: "no_permission"; email: string | null }
  | {
      state: "connected";
      email: string | null;
      token: string;
      scope: GmailScope;
      lastSyncAt: string | null;
      stats: GmailStats | null;
    };

type StatusRow = {
  workspace_id: string;
  provider: string;
  scopes: string[] | null;
  gmail_scope: string | null;
  last_sync_at: string | null;
  gmail_stats?: unknown;
};

/**
 * いまの Gmail の連携。つながっていれば、使えるアクセストークンも返す。
 * 同じ画面で googleLink をもう呼んでいれば、それを渡す（トークンの取り直しを2回しない）。
 */
export async function gmailState(workspaceId: string, known?: GoogleLink): Promise<GmailState> {
  const link = known ?? (await googleLink(workspaceId));
  if (link.state === "needs_migration") return { state: "needs_migration", migration: "020" };
  if (link.state !== "connected") return link;

  const supabase = await createClient();
  const { data } = await supabase.rpc("integration_status");
  const row = ((data ?? []) as unknown as StatusRow[]).find(
    (r) => r.workspace_id === workspaceId && r.provider === "google"
  );
  if (!row) return { state: "disconnected" };

  // カレンダーだけでつないだ人。Gmail の許可を足してもらう
  if (!(row.scopes ?? []).includes(GMAIL_SCOPE)) return { state: "no_permission", email: link.email };

  // 021 を当てる前は gmail_stats が返ってこない
  if (!("gmail_stats" in row)) return { state: "needs_migration", migration: "021" };

  return {
    state: "connected",
    email: link.email,
    token: link.token,
    scope: isGmailScope(row.gmail_scope) ? row.gmail_scope : "registered",
    lastSyncAt: row.last_sync_at,
    stats: (row.gmail_stats ?? null) as GmailStats | null,
  };
}

/* ── 取り込み ─────────────────────────────────────────────── */

export async function syncGmail(input: {
  workspaceId: string;
  memberId: string;
  workspaceDomain: string | null;
}): Promise<SyncResult> {
  const state = await gmailState(input.workspaceId);

  switch (state.state) {
    case "unconfigured":
      return { error: `Google 連携の設定が足りません：${state.missing.join("、")}` };
    case "needs_migration":
      return { error: `データベースの更新（${state.migration}）がまだです。` };
    case "disconnected":
      return { error: "Gmail がつながっていません。", reconnect: true };
    case "expired":
      return { error: "Google との連携が切れています。もう一度つないでください。", reconnect: true };
    case "no_permission":
      return { error: "Gmail を読む許可がありません。もう一度つないで、Gmail にチェックを入れてください。", reconnect: true };
  }

  return runGmailSync(await createClient(), state, input);
}
