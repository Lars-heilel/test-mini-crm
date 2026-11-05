alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

revoke all on public.profiles, public.objects, public.tasks, public.task_history
  from anon, authenticated;

grant select (id, full_name, role) on public.profiles to authenticated;
grant select on public.objects, public.tasks, public.task_history to authenticated;

grant insert (name, address) on public.objects to authenticated;
grant update (name, address, is_deleted) on public.objects to authenticated;

grant insert (object_id, title, description, assignee_id) on public.tasks to authenticated;
grant update (title, description, object_id, assignee_id, is_deleted) on public.tasks to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy objects_select on public.objects
  for select to authenticated using (public.object_visible(id));

create policy objects_insert on public.objects
  for insert to authenticated with check (public.is_manager());

create policy objects_update on public.objects
  for update to authenticated
  using (public.is_manager() and not is_deleted)
  with check (public.is_manager());

create policy tasks_select on public.tasks
  for select to authenticated using (public.task_visible(id));

create policy tasks_insert on public.tasks
  for insert to authenticated with check (
    public.is_manager()
    and public.object_visible(object_id)
    and exists (
      select 1 from public.profiles p
      where p.id = assignee_id and p.role = 'assignee'
    )
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_manager() and public.task_visible(id) and not is_deleted)
  with check (
    public.is_manager()
    and public.object_visible(object_id)
    and exists (
      select 1 from public.profiles p
      where p.id = assignee_id and p.role = 'assignee'
    )
  );

create policy task_history_select on public.task_history
  for select to authenticated using (public.task_visible(task_id));

create function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
) returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_task public.tasks;
  v_old_status public.task_status;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_allowed boolean := false;
begin
  if v_actor is null then
    raise exception 'Требуется вход в систему';
  end if;

  select role into v_role from public.profiles where id = v_actor;
  if v_role is null then
    raise exception 'Профиль пользователя не найден';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Задача не найдена';
  end if;
  if v_task.is_deleted or exists (
    select 1 from public.objects o
    where o.id = v_task.object_id and o.is_deleted
  ) then
    raise exception 'Задача недоступна';
  end if;

  if v_role = 'assignee' then
    if v_task.assignee_id <> v_actor then
      raise exception 'Вы не назначены на эту задачу';
    end if;
    v_allowed :=
      (v_task.status = 'new' and p_new_status = 'in_progress')
      or (v_task.status = 'in_progress' and p_new_status = 'on_review')
      or (v_task.status = 'rework' and p_new_status = 'in_progress');
  elsif v_role = 'manager' then
    v_allowed := v_task.status = 'on_review'
      and p_new_status in ('accepted', 'rework');
  end if;

  if not v_allowed then
    raise exception 'Недопустимый переход статуса';
  end if;

  if p_new_status = 'rework' and v_comment is null then
    raise exception 'Комментарий обязателен при возврате на доработку';
  end if;
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Комментарий не должен превышать 2000 символов';
  end if;

  v_old_status := v_task.status;
  update public.tasks
    set status = p_new_status
    where id = p_task_id
    returning * into v_task;

  insert into public.task_history (task_id, actor_id, from_status, to_status, comment)
  values (p_task_id, v_actor, v_old_status, p_new_status, v_comment);

  return v_task;
end;
$$;

revoke all on function public.change_task_status(uuid, public.task_status, text)
  from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text)
  to authenticated;
