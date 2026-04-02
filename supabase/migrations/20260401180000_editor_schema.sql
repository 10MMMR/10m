insert into storage.buckets (id, name, public)
values ('uploaded-pdfs', 'uploaded-pdfs', false)
on conflict (id) do nothing;

create table if not exists public.editor_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  body text not null default '<p></p>',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create index if not exists editor_notes_user_updated_idx
  on public.editor_notes (user_id, updated_at desc);

alter table public.editor_notes enable row level security;
alter table public.editor_notes force row level security;

drop policy if exists "Users can read their own notes" on public.editor_notes;
create policy "Users can read their own notes"
on public.editor_notes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own notes" on public.editor_notes;
create policy "Users can insert their own notes"
on public.editor_notes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own notes" on public.editor_notes;
create policy "Users can update their own notes"
on public.editor_notes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own notes" on public.editor_notes;
create policy "Users can delete their own notes"
on public.editor_notes
for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.editor_tree_nodes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  class_id text not null,
  parent_id text,
  kind text not null check (kind in ('root', 'folder', 'note', 'file')),
  note_id text,
  title text,
  order_index integer not null default 0 check (order_index >= 0),
  file_storage_path text,
  file_mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  constraint editor_tree_nodes_note_id_fkey
    foreign key (user_id, note_id)
    references public.editor_notes (user_id, id)
    on delete restrict,
  constraint editor_tree_nodes_note_ref_check
    check (
      (kind = 'note' and note_id is not null)
      or (kind <> 'note' and note_id is null)
    ),
  constraint editor_tree_nodes_title_3nf_check
    check (
      (kind = 'note' and title is null)
      or (kind <> 'note' and title is not null)
    )
);

create index if not exists editor_tree_nodes_user_class_idx
  on public.editor_tree_nodes (user_id, class_id, order_index);

create index if not exists editor_tree_nodes_user_parent_idx
  on public.editor_tree_nodes (user_id, parent_id, order_index);

create index if not exists editor_tree_nodes_user_note_idx
  on public.editor_tree_nodes (user_id, note_id)
  where note_id is not null;

alter table public.editor_tree_nodes enable row level security;
alter table public.editor_tree_nodes force row level security;

drop policy if exists "Users can read their own tree nodes" on public.editor_tree_nodes;
create policy "Users can read their own tree nodes"
on public.editor_tree_nodes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own tree nodes" on public.editor_tree_nodes;
create policy "Users can insert their own tree nodes"
on public.editor_tree_nodes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tree nodes" on public.editor_tree_nodes;
create policy "Users can update their own tree nodes"
on public.editor_tree_nodes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tree nodes" on public.editor_tree_nodes;
create policy "Users can delete their own tree nodes"
on public.editor_tree_nodes
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own uploaded PDFs" on storage.objects;
create policy "Users can read their own uploaded PDFs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'uploaded-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload their own PDFs" on storage.objects;
create policy "Users can upload their own PDFs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'uploaded-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own uploaded PDFs" on storage.objects;
create policy "Users can update their own uploaded PDFs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'uploaded-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'uploaded-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own uploaded PDFs" on storage.objects;
create policy "Users can delete their own uploaded PDFs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'uploaded-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
