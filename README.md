# SYNCLE

名刺から始まる営業CRM。

仕様は `SPEC.md` / `DATABASE.md` / `SCREENS.md`、デザインの見本は `PROTOTYPE.jsx`（`docs/` に置いてあります）。

## 技術構成

Next.js 15（App Router）/ React 19 / TypeScript / Tailwind CSS v4 / Supabase / Vercel

追加した依存は `@supabase/supabase-js` `@supabase/ssr` `lucide-react` の3つだけです。
状態管理ライブラリ・ORM・UIライブラリは入れていません（SPEC 1章「使わないもの」）。

## いまのフェーズ

**フェーズ5まで完了。フェーズ4（名刺スキャン）も実装済みで、鍵を入れれば動きます。**

| できること | 状態 |
|---|---|
| メール + 6桁コードでのログイン | ○ |
| ワークスペースの作成 | ○ |
| 事前登録（管理者がメール登録 → 本人のログインで参加） | ○ |
| 同ドメインでの発見と参加申請 | ○ |
| 招待リンクでの参加（`/join/{token}`） | ○ 発行画面は設定→メンバー |
| 全27テーブル + RLS + Storage | ○ |
| デザインシステム（色・書体・12シェイプ・共通部品） | ○ |
| 名刺の手入力と登録の連鎖（会社→チャンネル→ティア→案件→初回タスク） | ○ |
| 会社一覧（検索・絞り込み・並べ替え）と会社詳細 | ○ |
| タスク・チェックリスト・カレンダー・メモ | ○ |
| 会社チャンネル・グループ・DM（Realtime同期） | ○ |
| メンバー招待の3経路（事前登録・同ドメイン・招待リンク） | ○ |
| 進行中の案件（放置日数の警告・編集・完了） | ○ |
| 会社の履歴（メール・打合せ・タスク・会話を1本の時系列に） | ○ |
| 書類（Storageへ保存・種類別・よく使う） | ○ |
| キーパーソンと紹介の記録（4軸で絞り込み） | ○ |
| 会社詳細の7タブ（概要・名刺・履歴・書類・タスク・チャンネル） | ○ メールだけフェーズ6 |
| 商談の段階（ステージ）の編集 | ○ 設定から。変えられるのは管理者だけ |
| 名刺スキャン（カメラ・OCR・まとめ読み） | ○ 鍵を入れると動く（下記） |
| Google連携・日程調整・AIメール | フェーズ6（Google OAuth の申請待ち） |

フェーズ2以降の順番は `SPEC.md` 9章のとおりです。

---

## セットアップ

### 1. 依存を入れる

```bash
npm install
```

### 2. 環境変数

`.env.example` を `.env.local` にコピーして値を入れます。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Supabase の認証設定（必須）

**コマンド1つで済みます。**

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:auth
```

トークンは https://supabase.com/dashboard/account/tokens で発行します。
全プロジェクトを操作できるので、**終わったら失効させてください**。

本番URLが決まったら、それも渡します。

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run setup:auth -- --site-url https://sincle.vercel.app
```

独自SMTP も一緒に設定できます（`SMTP_PASS` を渡したときだけ送ります）。

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx SMTP_PASS=re_xxx \
  npm run setup:auth -- --site-url https://sincle.vercel.app
```

既定は Resend（`smtp.resend.com` / 465 / user `resend`）。差出人は
`--smtp-sender` で変えられます。SMTP を入れると送信上限も 1時間30通に上げます。

> ⚠️ **無料プランで既定のメール送信のままだと、メールの雛形を変更できません。**
> Supabase が `Email template modification is not available for free tier projects
> using the default email provider` を返します。
> Supabase が `Email template modification is not available for free tier projects` を返します。
> 独自SMTP を設定すると解禁されます。URL の設定は無料プランでも入ります。
>
> **リンク方式だけに頼らないこと。** メールアプリ内のブラウザでリンクを開くと
> Cookie が別扱いになり、PKCE の照合に失敗してログインできません。
> 6桁コードはこの問題を受けないので、SMTP を入れてコードを出すのが確実です。

このスクリプトがやること:

| 設定 | 値 |
|---|---|
| Site URL | `--site-url`（既定は `.env.local` の `NEXT_PUBLIC_SITE_URL`） |
| Redirect URLs | `http://localhost:3000/**` と Site URL 配下 |
| Magic Link の件名と本文 | `supabase/templates/magic-link.html` |
| Confirm signup の件名と本文 | `supabase/templates/confirmation.html` |

項目名を推測して壊さないよう、**先に現在の設定を GET して、そこに存在する項目だけを PATCH** します。
書いたあともう一度 GET して、反映されたかを1項目ずつ確認します。

メールの文面を変えたいときは `supabase/templates/` の HTML を直して、もう一度流してください。

<details>
<summary>手でやる場合（ダッシュボード・2か所）</summary>



コードだけでは設定できない箇所です。**ここをやらないとログインできません。**

#### (a) メールの雛形に6桁コードを入れる

Supabase の既定の雛形はリンクだけを送ります。6桁コードを出すには
`{{ .Token }}` を雛形に足す必要があります。

**Authentication → Email Templates → Magic Link** を開いて、本文を次に差し替えてください。

```html
<h2>SYNCLE へのログイン</h2>
<p>確認コードはこちらです。</p>
<p style="font-size:28px;font-weight:800;letter-spacing:.2em">{{ .Token }}</p>
<p>または、こちらのリンクからもログインできます。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">ログインする</a></p>
<p style="color:#888;font-size:12px">心当たりがない場合はこのメールを破棄してください。</p>
```

`Confirm signup` の雛形も同じ内容にしておくと、新規ユーザーでも同じ体験になります。

#### (b) URL の許可リスト

**Authentication → URL Configuration**

- Site URL … `https://（本番のドメイン）`
- Redirect URLs … `http://localhost:3000/**` と `https://（本番のドメイン）/**`

</details>

### 4. 名刺の読み取り（任意・フェーズ4）

名刺を撮って読み取るには Google Cloud Vision の鍵が要ります。
**入れなくてもアプリは動きます**（スキャン画面が手入力へ案内するだけ）。

1. Google Cloud のプロジェクトで **Cloud Vision API** を有効にする
2. サービスアカウントを作り、**JSON キー**を1つ作ってダウンロードする
3. その JSON を base64 にして `GOOGLE_VISION_SA_KEY` に入れる

```bash
base64 -w0 nico-app-xxxxxx.json    # Linux（macOS は -i）
```

```
GOOGLE_VISION_SA_KEY=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgLi4uCn0=
```

Vercel にも同じ名前で入れて Redeploy します。
`NEXT_PUBLIC_` は付けません（付けるとブラウザに渡ってしまいます）。

**課金アカウントの紐づけが必要です。**
Vision は文字の読み取りが月1,000枚まで無料ですが、
プロジェクトに課金アカウントが付いていないと呼び出し自体が断られます。
その場合は画面に「課金アカウントが紐づいていません」と出ます。

読み取りがうまくいかないときは、画面に Google からの文言がそのまま出ます。
`403` が出るならサービスアカウントの権限、`billing` が出るなら課金の設定です。

ライブラリは足していません。`node:crypto` で JWT に署名して
アクセストークンに交換しています（`lib/vision.ts`）。

### 5. メール送信の上限に注意

Supabase の既定のメール送信は**1時間あたり数通**に制限されています。
検証でログインを繰り返すとすぐに詰まります。実際に使い始める前に
独自SMTP（Resend など）へ切り替えてください。
**Authentication → Emails → SMTP Settings** から設定します。

### 6. 起動

```bash
npm run dev
```

---

## データベース

マイグレーションは `supabase/migrations/` にあります。番号順に適用してください。

| ファイル | 中身 |
|---|---|
| `001_workspaces.sql` | ワークスペース・メンバー・参加申請・招待リンク・ステージ + 所属判定のヘルパー |
| `002_companies.sql` | 会社・名刺・案件 + 会社名の正規化と `updated_at` のトリガ |
| `003_tasks.sql` | タスク・チェックリスト・個人TODO |
| `004_channels.sql` | チャンネル・メッセージ・個人チャット |
| `005_mails_events.sql` | メール・打合せ・予約ページ + `get_booking()` |
| `006_documents_memos.sql` | 書類・メモ |
| `007_keypersons.sql` | キーパーソン・紹介の記録 |
| `008_agenda.sql` | 計画の議題とやること |
| `009_integrations.sql` | 外部連携のトークン + `integration_status()` |
| `010_auth_rpc.sql` | 認証・参加のための RPC（下記） |
| `011_storage.sql` | Storage の3バケットとポリシー |
| `012_revoke_anon_execute.sql` | anon からの関数実行を締める |
| `013_revoke_public_execute.sql` | PUBLIC からの関数実行を締める |
| `014_rls_performance.sql` | RLS を行ごとの関数呼び出しから `in (select …)` に書き換える |
| `015_contacts_registration.sql` | ティアの計算・重複会社の検出 + 登録の連鎖 `register_contact()` |
| `016_company_search.sql` | 会社一覧の検索・件数・絞り込みの選択肢 |
| `017_tasks_channels.sql` | タスク・カレンダー・チャンネル・DM・メンバー招待の RPC |
| `018_deals_timeline.sql` | 進行中の案件・活動タイムライン・キーパーソンの RPC |
| `019_company_tasks_stages.sql` | `list_tasks` に会社の絞り込み／ステージの書き換えを管理者だけに |

**RLS は各テーブルの作成直後に有効化しています**（SPEC 0章）。

### 認証のための RPC（010）

RLS は「`status='active'` の所属メンバー」を前提にしています。
そのため素のテーブル操作だけでは行き止まりが生まれます。

- 最初の1人がワークスペースを作れない（作る前は誰もメンバーでない）
- 事前登録された人が自分の行を `active` にできない

これを `security definer` の関数で埋めています。

| 関数 | 役割 |
|---|---|
| `create_workspace()` | workspace + 自分（管理者・active）+ 既定ステージ を1トランザクションで作る |
| `claim_membership()` | ログイン中のメールと一致する `invited` 行に `user_id` を入れて `active` にする |
| `find_workspaces_by_domain()` | **自分のメールのドメイン**に一致するワークスペースだけを返す |
| `join_by_domain()` | `open_join` なら即参加、そうでなければ `join_requests` に積む |
| `join_via_invite()` | トークンを検証して参加し、`uses` を増やす |
| `is_slug_available()` | 新規作成時の重複チェック |

### 型の再生成

```bash
npx supabase gen types typescript --project-id <project-ref> > types/supabase.ts
```

`types/supabase.ts` は自動生成です。業務上のユニオン型は `types/db.ts` に手で置いています。

### 名刺の振り分けの確認

```bash
npm run test:card
```

OCR の文字列を会社名・氏名・役職・部署・メール・電話・Web・住所に
振り分けるところ（`lib/card.ts`）だけを確かめます。
ネットワークには出ません。依存も足していません
（Node の `--experimental-strip-types` で TypeScript をそのまま読みます）。

### 通し確認（本番に触らない）

```bash
npm run db:test
```

手元の PostgreSQL に使い捨てのデータベースを作り、`001`〜`018` を順に当てて、
登録の連鎖・案件・履歴・書類・キーパーソンを実際に動かします。
続けて**別のワークスペースから1件も見えないこと**（RLS）も確かめます。
終わったらデータベースは消します。本番のプロジェクトには一切繋ぎません。

`postgresql-16` が要ります（`initdb` / `pg_ctl` / `psql`）。
別の場所に入っている場合は `PGBIN=/usr/lib/postgresql/17/bin npm run db:test` のように渡してください。

`auth.uid()` や Storage など Supabase が用意している部分は
`supabase/test/shim.sql` が最小限だけ代役を務めます。マイグレーションには手を入れません。

---

## ディレクトリ

```
app/
  page.tsx              起動アニメーション（読み込み完了で次へ飛ばす）
  auth/                 入口 / メール / コード / ワークスペース選択 / 新規作成
  join/[token]/         招待リンク
  (app)/                下部ナビつきの本体（顧客・チャンネル・スキャン・タスク・計画）
  api/boot/             起動時の行き先を返す
components/
  ui/                   デザインシステムの共通部品
lib/
  design.ts             色・形・分類・判定ロジック（仕様書から無改変）
  vision.ts             Google Cloud Vision（サーバー専用）
  card.ts               読み取った文字を各欄に振り分ける
  supabase/             クライアント（ブラウザ / サーバー / middleware）
  workspace.ts          いま開いているワークスペースの解決
types/
  supabase.ts           自動生成
  db.ts                 手で定義するユニオン型
supabase/migrations/    マイグレーション
supabase/test/          手元の PostgreSQL で流す通し確認
test/                   名刺の振り分けの確認（npm run test:card）
```

---

## 仕様から変えた点

実装のうえで必要だと判断して変えた箇所です。戻したい場合は言ってください。

1. **`workspace_members` の書き込みを管理者に限定した。** DATABASE.md の基本パターンでは所属メンバー全員が
   他のメンバーを削除できてしまうため。参照は全員、作成・削除は管理者、自分の行の更新は本人。
2. **DM を当事者2人だけに限定した。** 基本パターンのままだとワークスペースの全員が他人のDMを読めてしまう。
   併せて `member_a < member_b` の順序をDB側の CHECK で強制した。
3. **グループチャンネルのメッセージを参加者のみにした。** 会社チャンネルは全員が読める。
4. **`integrations` に SELECT ポリシーを置かなかった。** `access_token` が返ってしまうため。
   画面には `integration_status()` を使う（トークンを含まない）。
5. **同ドメイン参加からフリーメールを除外した。** `gmail.com` などを対象にすると
   赤の他人に「同じ会社にあります」と表示されてしまう。`is_corporate_domain()` で判定。
6. **`deals` に「1社につき進行中は1件」の部分ユニーク制約を入れた。** SPEC 3章の「当面は1社1案件」をDB側で担保。
   並行案件を扱うことになったらこの index を外す。
7. **`companies.name_normalized` をトリガで自動生成にした。** アプリ側の入れ忘れで重複検出が壊れるのを防ぐため。

## まだ決めていないこと（SCREENS 14章）

1. 顧客リストの表示形式（デッキか通常リストか）
2. 案件が複数になったときの扱い
3. 金額の持ち方（現状は文字列。集計するなら数値化が必要）
4. タスクの期限の意味（「◯時までに終わらせる」か「◯時から作業する」か）
5. 書類の種類の増減
6. キーパーソンの「層」の言葉
