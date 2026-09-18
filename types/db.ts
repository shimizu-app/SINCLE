/**
 * SYNCLE の業務上のユニオン型。
 * DB のスキーマ型は types/supabase.ts（自動生成）にある。
 * こちらは手で定義する。DATABASE.md「型定義」の節が出どころ。
 */

import type { Tables } from "./supabase";

/* ══════════════ ユニオン型 ══════════════ */

export type Tier = "A" | "B" | "C";
export type Priority = "高" | "中" | "低";
export type TaskShare = "self" | "assignee" | "team";
export type DealStatus =
  | "talking" | "proposal" | "quote" | "working" | "review" | "paused";
export type DocKind =
  | "contract" | "quote" | "proposal" | "invoice" | "spec" | "other";
export type KeyGenre =
  | "it" | "maker" | "food" | "medical" | "retail"
  | "ad" | "finance" | "logistics" | "public" | "other";
export type KeyLayer =
  | "bigexec" | "smeexec" | "manager" | "academia"
  | "public" | "finance" | "media" | "community";
export type KeyScope = "national" | "region" | "pref";
export type AgendaState = "decided" | "talking" | "todo";
export type MailScope = "registered" | "domain" | "all";

export type MemberStatus = "invited" | "active";
export type ChannelKind = "company" | "group";
export type MailDirection = "in" | "out";
export type JoinVia = "domain" | "link";
export type AgendaDept = "sales" | "is" | "cs" | "dev";

export type Avatar =
  | { kind: "shape"; shape: string; color: string }
  | { kind: "photo"; src: string };

/* ══════════════ 行の型（ユニオンを当て直したもの） ══════════════ */
// 自動生成では text 列がすべて string になるため、
// 実際に取りうる値をここで絞る。

export type Workspace = Tables<"workspaces">;

export type WorkspaceMember = Omit<Tables<"workspace_members">, "status" | "avatar" | "cover"> & {
  status: MemberStatus;
  avatar: Avatar;
  cover: Avatar | null;
};

export type Stage = Tables<"stages">;
export type JoinRequest = Omit<Tables<"join_requests">, "via"> & { via: JoinVia };
export type InviteLink = Tables<"invite_links">;

export type Company = Omit<Tables<"companies">, "tier" | "tier_manual"> & {
  tier: Tier | null;
  tier_manual: Tier | null;
};

export type Contact = Tables<"contacts">;

export type Deal = Omit<Tables<"deals">, "status"> & { status: DealStatus };

export type Task = Omit<Tables<"tasks">, "priority" | "share"> & {
  priority: Priority;
  share: TaskShare;
};

export type Subtask = Tables<"subtasks">;
export type PersonalTodo = Omit<Tables<"personal_todos">, "priority"> & { priority: Priority };

export type Channel = Omit<Tables<"channels">, "kind"> & { kind: ChannelKind };
export type ChannelMember = Tables<"channel_members">;
export type Message = Tables<"messages">;
export type DmThread = Tables<"dm_threads">;
export type DmMessage = Tables<"dm_messages">;

export type Mail = Omit<Tables<"mails">, "direction"> & { direction: MailDirection };
export type CalendarEvent = Tables<"events">;
export type BookingLink = Tables<"booking_links">;

export type Document = Omit<Tables<"documents">, "kind"> & { kind: DocKind };
export type Memo = Tables<"memos">;

export type KeyPerson = Omit<Tables<"key_persons">, "genre" | "scope" | "layers" | "sub_genres"> & {
  genre: KeyGenre;
  scope: KeyScope;
  layers: KeyLayer[];
  sub_genres: KeyGenre[];
};

export type Referral = Tables<"referrals">;

export type AgendaItem = Omit<Tables<"agenda_items">, "state" | "dept"> & {
  state: AgendaState;
  dept: AgendaDept;
};

export type AgendaAction = Tables<"agenda_actions">;

/* ══════════════ 画面で使う組み合わせ ══════════════ */

/** ログイン後にアプリ全体で持ち回る現在地 */
export type Session = {
  userId: string;
  email: string;
  workspace: Workspace;
  member: WorkspaceMember;
};

/** 同ドメイン検索（find_workspaces_by_domain）の戻り */
export type DomainCandidate = {
  id: string;
  name: string;
  slug: string;
  color: string;
  shape: string;
  open_join: boolean;
  member_count: number;
  requested: boolean;
};
