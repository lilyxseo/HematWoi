set check_function_bodies = off;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'avatars'
  ) then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true);
  else
    update storage.buckets
      set public = true
    where id = 'avatars';
  end if;
end $$;

alter table if exists storage.objects enable row level security;

drop policy if exists "Avatar owners can upload" on storage.objects;
drop policy if exists "Avatar owners can update" on storage.objects;
drop policy if exists "Avatar owners can delete" on storage.objects;
drop policy if exists "Avatars are publicly readable" on storage.objects;

create policy "Avatar owners can upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'avatars'
    and split_part(name, '/', 2) like auth.uid()::text || '.%'
  );

create policy "Avatar owners can update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'avatars'
    and split_part(name, '/', 2) like auth.uid()::text || '.%'
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'avatars'
    and split_part(name, '/', 2) like auth.uid()::text || '.%'
  );

create policy "Avatar owners can delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'avatars'
    and split_part(name, '/', 2) like auth.uid()::text || '.%'
  );

create policy "Avatars are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'avatars');
