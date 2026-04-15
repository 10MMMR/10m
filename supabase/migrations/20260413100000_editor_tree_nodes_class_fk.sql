create index if not exists editor_tree_nodes_class_id_idx
  on public.editor_tree_nodes (class_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'editor_tree_nodes_class_id_fkey'
      and conrelid = 'public.editor_tree_nodes'::regclass
  ) then
    alter table public.editor_tree_nodes
      add constraint editor_tree_nodes_class_id_fkey
      foreign key (class_id)
      references public.classes (id);
  end if;
end
$$;
