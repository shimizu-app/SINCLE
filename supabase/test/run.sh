#!/usr/bin/env bash
# 手元の PostgreSQL に移行ファイルを全部当てて、通し確認を流す。
#
#   ./supabase/test/run.sh
#
# 本番には一切触らない。使い捨てのクラスタを作って、終わったら消す。
# 必要なもの：postgresql-16（initdb / pg_ctl / psql）
#
# 確かめられること
#   ・001〜018 が空のデータベースに順番どおり当たる
#   ・登録の連鎖・案件・履歴・書類・キーパーソンが期待どおり動く
#   ・別のワークスペースからは1件も見えない（RLS）
#
# Supabase が用意している部分（auth.uid() や storage など）は
# shim.sql が最小限だけ代役を務める。移行ファイルには手を入れない。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
[ -x "$PGBIN/initdb" ] || { echo "postgresql-16 が見つかりません（PGBIN=$PGBIN）"; exit 1; }

# root では initdb が動かないので、postgres ユーザーの下に作る
OWNER="${PGOWNER:-postgres}"
BASE="${PGBASE:-/var/lib/postgresql/syncle-test}"
PORT="${PGPORT:-5433}"
SOCK="$BASE/sock"

as_owner() { if [ "$(id -un)" = "$OWNER" ]; then bash -c "$1"; else su "$OWNER" -c "$1"; fi }

cleanup() {
  as_owner "PATH=$PGBIN:\$PATH pg_ctl -D $BASE/data stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$BASE"
}
trap cleanup EXIT

echo "使い捨てのデータベースを作ります（$BASE）"
rm -rf "$BASE"; mkdir -p "$BASE/data" "$SOCK"
chown -R "$OWNER":"$OWNER" "$BASE"
as_owner "PATH=$PGBIN:\$PATH initdb -D $BASE/data -U postgres -A trust --locale=C --encoding=UTF8" >"$BASE/initdb.log" 2>&1
as_owner "PATH=$PGBIN:\$PATH pg_ctl -D $BASE/data -o '-k $SOCK -p $PORT -c listen_addresses=' -l $BASE/server.log start" >/dev/null
for _ in $(seq 20); do "$PGBIN/pg_isready" -h "$SOCK" -p "$PORT" -q && break; sleep 0.5; done

P="$PGBIN/psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "create database syncle;" >/dev/null

echo "Supabase の代役を入れます"
$P -d syncle -f "$HERE/shim.sql" >/dev/null 2>&1

echo "移行ファイルを順番に当てます"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '  %-34s' "$(basename "$f")"
  if $P -d syncle -f "$f" >"$BASE/mig.log" 2>&1; then echo "✓"
  else echo "✗"; tail -12 "$BASE/mig.log"; exit 1; fi
done

# Supabase は public のテーブル権限を既定で開けている（RLS は別に効く）
$P -d syncle -c "
  grant all on all tables    in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;" >/dev/null

echo ""
echo "══ フェーズ5の通し確認 ══"
$PGBIN/psql -h "$SOCK" -p "$PORT" -U postgres -d syncle -v ON_ERROR_STOP=1 -q \
  -f "$HERE/phase5.sql"

echo ""
echo "══ 他社から見えないことの確認 ══"
$PGBIN/psql -h "$SOCK" -p "$PORT" -U postgres -d syncle -v ON_ERROR_STOP=1 -q \
  -f "$HERE/isolation.sql"
$PGBIN/psql -h "$SOCK" -p "$PORT" -U postgres -d syncle -q \
  -f "$HERE/isolation_write.sql"

echo ""
echo "終わりました。データベースは消します。"
