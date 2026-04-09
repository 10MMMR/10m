create table if not exists public.editor_note_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  class_id text not null,
  note_node_id text not null,
  title text not null,
  unit_titles text[] not null default '{}',
  note_titles text[] not null default '{}',
  pdf_titles text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  constraint editor_note_sessions_note_node_id_fkey
    foreign key (user_id, note_node_id)
    references public.editor_tree_nodes (user_id, id)
    on delete cascade
);

create unique index if not exists editor_note_sessions_user_class_note_node_idx
  on public.editor_note_sessions (user_id, class_id, note_node_id);

create index if not exists editor_note_sessions_user_class_updated_idx
  on public.editor_note_sessions (user_id, class_id, updated_at desc);

alter table public.editor_note_sessions enable row level security;
alter table public.editor_note_sessions force row level security;

drop policy if exists "Users can read their own note sessions" on public.editor_note_sessions;
create policy "Users can read their own note sessions"
on public.editor_note_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own note sessions" on public.editor_note_sessions;
create policy "Users can insert their own note sessions"
on public.editor_note_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own note sessions" on public.editor_note_sessions;
create policy "Users can update their own note sessions"
on public.editor_note_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own note sessions" on public.editor_note_sessions;
create policy "Users can delete their own note sessions"
on public.editor_note_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);
