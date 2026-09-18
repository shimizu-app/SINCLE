-- ═══════════════════════════════════════════════════════════
-- 011 Storage バケットとポリシー
-- パスは {workspace_id}/{company_id}/{uuid}_{filename}
-- 先頭のフォルダ名がワークスペースIDであることで分離する。
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('cards', 'cards', false),
       ('documents', 'documents', false),
       ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- パス先頭の workspace_id を取り出す。UUID でなければ null。
create or replace function public.ws_from_path(p_name text)
returns uuid language sql immutable
set search_path = '' as $$
  select case
    when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_name))[1])::uuid
    else null
  end;
$$;

create policy "SYNCLE: 所属ワークスペースのファイルを読める" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
  );

create policy "SYNCLE: 所属ワークスペースにアップロードできる" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
  );

create policy "SYNCLE: 所属ワークスペースのファイルを更新できる" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
  );

create policy "SYNCLE: 所属ワークスペースのファイルを削除できる" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('cards', 'documents', 'avatars')
    and public.is_member(public.ws_from_path(name))
  );
