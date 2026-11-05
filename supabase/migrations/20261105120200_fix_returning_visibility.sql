-- PostgreSQL evaluates the SELECT policy on INSERT ... RETURNING. The original
-- policies called helpers that re-query the same table, so the freshly inserted
-- row was not visible yet and the RETURNING clause failed with RLS 42501.
-- Manager rows are now checked directly on the current row; the helper remains
-- for assignees and for existing-row checks.
drop policy objects_select on public.objects;
create policy objects_select on public.objects
  for select to authenticated using (
    (public.is_manager() and not is_deleted)
    or public.object_visible(id)
  );

drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (
    (
      public.is_manager()
      and not is_deleted
      and public.object_visible(object_id)
    )
    or public.task_visible(id)
  );
