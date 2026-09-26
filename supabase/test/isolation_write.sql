-- 他社のIDを知っていても書き込めないことの確認。
-- わざと失敗させるので ON_ERROR_STOP は掛けない。
\pset footer off

reset role;
select id as other_company, workspace_id as other_ws
  from public.companies where name = 'ミライ精機株式会社' \gset
select id as other_deal    from public.deals      where company_id = :'other_company'::uuid \gset

select set_config('request.jwt.claims',
  json_build_object(
    'sub',   '22222222-2222-2222-2222-222222222222',
    'email', 'other@example-corp.jp',
    'role',  'authenticated')::text, false) \gset _
set role authenticated;

\echo 'log_activity（他社の会社に書き込む）→ エラーになるのが正しい:'
select public.log_activity(:'other_company'::uuid, '勝手に書き込む');

\echo 'complete_deal（他社の案件を完了にする）→ エラーになるのが正しい:'
select public.complete_deal(:'other_deal'::uuid);

\echo 'documents に他社のIDを書いて入れる → ポリシー違反で弾かれるのが正しい:'
insert into public.documents (workspace_id, company_id, name, kind, storage_path)
values (:'other_ws'::uuid, :'other_company'::uuid, 'のっとり.pdf', 'other', 'x/y/z.pdf');
