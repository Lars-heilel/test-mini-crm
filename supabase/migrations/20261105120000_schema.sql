create type public.user_role as enum ('manager', 'assignee');
create type public.task_status as enum ('new', 'in_progress', 'on_review', 'rework', 'accepted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  role public.user_role not null default 'assignee',
  created_at timestamptz not null default now()
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text not null check (char_length(btrim(address)) between 1 and 300),
  created_by uuid not null default auth.uid() references public.profiles(id),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects(id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  assignee_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles(id),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id),
  actor_id uuid not null references public.profiles(id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create index tasks_assignee_idx on public.tasks (assignee_id) where not is_deleted;
create index tasks_object_idx on public.tasks (object_id) where not is_deleted;
create index task_history_task_idx on public.task_history (task_id, created_at);

create function public.set_updated_at() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Пользователь'
    ),
    'assignee'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.log_task_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.task_history (task_id, actor_id, from_status, to_status)
  values (new.id, new.author_id, null, 'new');
  return new;
end $$;

create trigger tasks_log_created
after insert on public.tasks
for each row execute function public.log_task_created();

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'manager'
  )
$$;

create function public.object_visible(p_object_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.objects o
    where o.id = p_object_id
      and not o.is_deleted
      and (
        public.is_manager()
        or exists (
          select 1 from public.tasks t
          where t.object_id = o.id
            and t.assignee_id = auth.uid()
            and not t.is_deleted
        )
      )
  )
$$;

create function public.task_visible(p_task_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.tasks t
    join public.objects o on o.id = t.object_id
    where t.id = p_task_id
      and not t.is_deleted
      and not o.is_deleted
      and (public.is_manager() or t.assignee_id = auth.uid())
  )
$$;
