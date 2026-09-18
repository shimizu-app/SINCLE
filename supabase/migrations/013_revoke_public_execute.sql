-- ═══════════════════════════════════════════════════════════
-- 013 PUBLIC からの関数実行を締める
--
-- 012 で anon への直接付与は剥がしたが、PUBLIC 疑似ロールへの
-- 付与が残っていると anon はそれを継承して呼べてしまう。
-- PUBLIC からも剥がし、authenticated にだけ明示的に付け直す。
-- （RLS ポリシー内の関数呼び出しは呼び出し側の権限で評価されるため、
--   authenticated への EXECUTE は必須。）
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
    execute format('revoke execute on function %s from public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
