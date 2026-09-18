# SYNCLE データベース設計

Supabase（PostgreSQL）。すべてのテーブルに RLS を設定する。

---

## 設計の原則

- すべての業務データは `workspace_id` を持ち、RLS でワークスペース単位に分離する
- 削除は原則論理削除にせず物理削除。ただし `companies` と `contacts` は `archived_at` で論理削除する
- タイムスタンプは `timestamptz`（UTC保存、表示時にJSTへ）
- ID は `uuid`（`gen_random_uuid()`）

---

## テーブル一覧

| テーブル | 役割 |
|---|---|
| workspaces | 会社アカウント |
| workspace_members | 所属メンバー |
| join_requests | 参加申請 |
| invite_links | 招待リンク |
| stages | 進捗ステージ（ワークスペースごとに可変） |
| companies | 顧客企業 |
| contacts | 名刺 |
| deals | 案件（当面 companies と1対1） |
| tasks | タスク |
| subtasks | チェックリスト |
| personal_todos | 個人TODO |
| channels | チャンネル（会社・グループ） |
| channel_members | チャンネル参加者 |
| messages | メッセージ |
| dm_threads | 個人チャット |
| dm_messages | 個人チャットのメッセージ |
| mails | メール履歴 |
| events | 打合せ予定 |
| booking_links | 予約ページ |
| documents | 書類 |
| memos | メモ |
| key_persons | キーパーソン |
| referrals | 紹介の記録 |
| agenda_items | 計画の議題 |
| agenda_actions | 議題から出たやること |
| integrations | 外部連携のトークン |

---

## SQL

```sql
-- ═══════════════════════════════════════
-- ワークスペース
-- ═══════════════════════════════════════

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,                          -- 同ドメイン参加の判定用
  open_join boolean not null default false,  -- 同ドメインなら承認なしで参加可
  color text not null default 'purple',
  shape text not null default 'flower',
  created_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,  -- ログイン前はnull
  email text not null,
  name text not null,
  role text not null default 'メンバー',
  is_admin boolean not null default false,
  status text not null default 'invited',   -- invited | active
  note text,                                 -- ひとこと
  avatar jsonb not null default '{"kind":"shape","shape":"flower","color":"purple"}',
  cover jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  name text,
  via text not null,                    -- 'domain' | 'link'
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table invite_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token text not null unique,           -- 32文字以上のランダム
  expires_at timestamptz not null,
  max_uses int not null default 10,
  uses int not null default 0,
  created_by uuid references workspace_members(id),
  created_at timestamptz not null default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  position int not null
);

-- ═══════════════════════════════════════
-- 顧客
-- ═══════════════════════════════════════

create table companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  name_normalized text not null,        -- 重複検出用（法人格と空白を除去）
  industry text,
  employees int default 0,
  revenue text,
  address text,
  web text,
  tier text,                            -- 'A' | 'B' | 'C'
  tier_manual text,                     -- 手動上書き
  stage_id uuid references stages(id),
  owner_id uuid references workspace_members(id),
  primary_contact_id uuid,              -- 窓口（contactsへのFKは循環するのでアプリ側で担保）
  deal_type text,
  comment text,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on companies (workspace_id, archived_at);
create index on companies (workspace_id, name_normalized);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  dept text,
  title text,
  email text,
  phone text,
  card_image_url text,                  -- 名刺画像（Storage）
  mail_watch boolean not null default true,  -- Gmail取り込み対象か
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on contacts (workspace_id, email);

create table deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  active boolean not null default true,
  status text not null default 'talking',
    -- talking | proposal | quote | working | review | paused
  memo text,
  amount text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()   -- 放置判定に使う
);
create index on deals (workspace_id, active, updated_at);

-- ═══════════════════════════════════════
-- タスク
-- ═══════════════════════════════════════

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  due_at timestamptz,                   -- 時刻なしの場合は日付のみ扱いにする
  due_has_time boolean not null default false,
  assignee_id uuid references workspace_members(id),
  contact_id uuid references contacts(id) on delete set null,
  priority text not null default '中',  -- 高 | 中 | 低
  share text not null default 'assignee',  -- self | assignee | team
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on tasks (workspace_id, done, due_at);

create table subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  text text not null,
  at timestamptz,
  done boolean not null default false,
  position int not null default 0
);

create table personal_todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid not null references workspace_members(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  due_has_time boolean not null default false,
  priority text not null default '中',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- チャンネル
-- ═══════════════════════════════════════

create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null,                   -- 'company' | 'group'
  company_id uuid references companies(id) on delete cascade,
  name text,                            -- groupのとき使う
  shape text default 'flower',
  color text default 'purple',
  created_at timestamptz not null default now()
);

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  member_id uuid not null references workspace_members(id) on delete cascade,
  last_read_at timestamptz,
  primary key (channel_id, member_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid references workspace_members(id),  -- systemメッセージはnull
  text text not null,
  is_system boolean not null default false,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on messages (channel_id, created_at desc);

create table dm_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_a uuid not null references workspace_members(id) on delete cascade,
  member_b uuid not null references workspace_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, member_a, member_b)
);
-- member_a < member_b の順で保存する（アプリ側で担保）

create table dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references dm_threads(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid not null references workspace_members(id),
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- メール・予定
-- ═══════════════════════════════════════

create table mails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  direction text not null,              -- 'in' | 'out'
  subject text not null,
  body text,
  excerpt text,
  from_email text,
  to_email text,
  gmail_message_id text,                -- 重複取り込み防止
  gmail_thread_id text,
  replied boolean not null default false,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, gmail_message_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  format text not null default 'Google Meet',
  meet_url text,
  gcal_event_id text,
  created_at timestamptz not null default now()
);

create table booking_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  token text not null unique,           -- 32文字以上のランダム
  slots jsonb not null,                 -- 候補日時の配列
  duration_min int not null default 60,
  format text not null,
  expires_at timestamptz not null,
  confirmed_event_id uuid references events(id),
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- 書類・メモ
-- ═══════════════════════════════════════

create table documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  kind text not null default 'other',
    -- contract | quote | proposal | invoice | spec | other
  storage_path text not null,           -- Supabase Storage のパス
  size_bytes bigint,
  mime_type text,
  note text,
  pinned boolean not null default false,
  uploaded_by uuid references workspace_members(id),
  created_at timestamptz not null default now()
);

create table memos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid not null references workspace_members(id) on delete cascade,
  text text not null,
  color text not null default 'yellow',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- キーパーソン
-- ═══════════════════════════════════════

create table key_persons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,  -- 名刺から作った場合
  name text not null,
  kana text,
  company_name text,                    -- 顧客でない場合もあるので文字列で持つ
  title text,
  genre text not null default 'other',
  sub_genres text[] not null default '{}',
  layers text[] not null default '{}',
    -- bigexec | smeexec | manager | academia | public | finance | media | community
  scope text not null default 'pref',   -- national | region | pref
  pref text,
  city text,
  met text,                             -- 出会いのきっかけ
  about text,
  network text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key_person_id uuid not null references key_persons(id) on delete cascade,
  to_name text not null,                -- 紹介先
  to_company_id uuid references companies(id) on delete set null,
  result text not null default '初回接触',
  happened_at date,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════
-- 計画（ロードマップ）
-- ═══════════════════════════════════════

create table agenda_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  dept text not null,                   -- sales | is | cs | dev
  year int not null,
  month int not null,
  title text not null,
  state text not null default 'todo',   -- decided | talking | todo
  decision text,
  decided_at date,
  scheduled_text text,                  -- 「8/12（火）14:00 に話す」
  participants uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table agenda_actions (
  id uuid primary key default gen_random_uuid(),
  agenda_item_id uuid not null references agenda_items(id) on delete cascade,
  text text not null,
  assignee_id uuid references workspace_members(id),
  done boolean not null default false,
  position int not null default 0
);

-- ═══════════════════════════════════════
-- 外部連携
-- ═══════════════════════════════════════

create table integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid not null references workspace_members(id) on delete cascade,
  provider text not null,               -- 'google'
  access_token text not null,           -- 暗号化して保存する
  refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  gmail_scope text not null default 'registered',  -- registered | domain | all
  calendar_ids jsonb not null default '[]',
  last_sync_at timestamptz,
  unique (workspace_id, member_id, provider)
);
```

---

## RLS ポリシー

**全テーブルで有効にする。** 基本の考え方は「自分が所属するワークスペースのデータだけ触れる」。

```sql
-- 所属判定のヘルパー
create or replace function is_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- 全テーブルで有効化（例：companies）
alter table companies enable row level security;

create policy "所属メンバーは参照できる" on companies
  for select using (is_member(workspace_id));

create policy "所属メンバーは作成できる" on companies
  for insert with check (is_member(workspace_id));

create policy "所属メンバーは更新できる" on companies
  for update using (is_member(workspace_id));

create policy "所属メンバーは削除できる" on companies
  for delete using (is_member(workspace_id));
```

同じパターンを全テーブルに適用する。例外は以下。

| テーブル | 例外 |
|---|---|
| `workspaces` | 参照は所属メンバーのみ。同ドメイン検索用に `slug` `name` `domain` だけ返す関数を別途用意 |
| `join_requests` | 参照・更新は管理者のみ。作成は誰でも可（申請するため） |
| `invite_links` | 参照・作成・削除は管理者のみ。トークン検証は関数経由 |
| `booking_links` | **顧客が未ログインで見るため、トークンによる参照を許可する関数を用意する** |
| `integrations` | 本人のみ参照可。`access_token` はクライアントに返さない |
| `personal_todos` `memos` | 本人のみ |

### 予約ページ用の関数

```sql
-- 未ログインでもトークンで候補を取得できる
create or replace function get_booking(p_token text)
returns jsonb language sql security definer stable as $$
  select jsonb_build_object(
    'company_name', c.name,
    'slots', b.slots,
    'duration_min', b.duration_min,
    'format', b.format,
    'confirmed', b.confirmed_event_id is not null
  )
  from booking_links b
  join companies c on c.id = b.company_id
  where b.token = p_token
    and b.expires_at > now()
    and b.confirmed_event_id is null;
$$;
```

---

## Storage

| バケット | 用途 | 公開 |
|---|---|---|
| `cards` | 名刺画像 | 非公開（署名URLで配信） |
| `documents` | 書類 | 非公開（署名URLで配信） |
| `avatars` | プロフィール写真・カバー | 非公開（署名URL） |

パスは `{workspace_id}/{company_id}/{uuid}_{filename}` の形にする。
Storage のポリシーでも `workspace_id` による分離を行う。

---

## 型定義（TypeScript）

`types/db.ts` に置く。Supabase の型生成（`supabase gen types typescript`）を使い、それに加えて以下のユニオン型を手で定義する。

```ts
export type Tier = 'A' | 'B' | 'C';
export type Priority = '高' | '中' | '低';
export type TaskShare = 'self' | 'assignee' | 'team';
export type DealStatus =
  | 'talking' | 'proposal' | 'quote' | 'working' | 'review' | 'paused';
export type DocKind =
  | 'contract' | 'quote' | 'proposal' | 'invoice' | 'spec' | 'other';
export type KeyGenre =
  | 'it' | 'maker' | 'food' | 'medical' | 'retail'
  | 'ad' | 'finance' | 'logistics' | 'public' | 'other';
export type KeyLayer =
  | 'bigexec' | 'smeexec' | 'manager' | 'academia'
  | 'public' | 'finance' | 'media' | 'community';
export type KeyScope = 'national' | 'region' | 'pref';
export type AgendaState = 'decided' | 'talking' | 'todo';
export type MailScope = 'registered' | 'domain' | 'all';

export type Avatar =
  | { kind: 'shape'; shape: string; color: string }
  | { kind: 'photo'; src: string };
```

---

## マイグレーションの進め方

1. `supabase init` でプロジェクトを初期化
2. テーブルを機能のまとまりごとにマイグレーションファイルに分ける
   - `001_workspaces.sql`（ワークスペース・メンバー・参加）
   - `002_companies.sql`（会社・名刺・案件）
   - `003_tasks.sql`
   - `004_channels.sql`
   - `005_mails_events.sql`
   - `006_documents_memos.sql`
   - `007_keypersons.sql`
   - `008_agenda.sql`
   - `009_integrations.sql`
   - `010_rls.sql`（ポリシーをまとめて）
3. RLS は最後にまとめて適用せず、**各テーブル作成直後に有効化する**
