alter table public.profiles
  add column if not exists job_title text,
  add column if not exists bio text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );
