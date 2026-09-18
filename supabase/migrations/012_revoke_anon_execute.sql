-- ═══════════════════════════════════════════════════════════
-- 012 anon からの関数実行を締める
--
-- Supabase は public スキーマの関数に anon / authenticated への
-- EXECUTE を既定で付与する。`revoke ... from public` では
-- ロールへの明示的な付与は消えないため、anon から個別に剥がす。
-- 未ログインで呼んでよいのは get_booking（予約ページ）だけ。
-- ═══════════════════════════════════════════════════════════

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname <> 'get_booking'
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;

-- 今後追加する関数も既定では anon から呼べないようにする。
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
