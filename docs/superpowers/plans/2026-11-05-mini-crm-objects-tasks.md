# Мини-CRM «Объекты и задачи» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать и задеплоить мини-CRM, где постановщик создаёт объекты и задачи, исполнитель ведёт только свои задачи, а матрица переходов, доступ и неизменяемая история обеспечиваются PostgreSQL/Supabase, а не только интерфейсом.

**Architecture:** SPA на React + Vite + TypeScript с Tailwind CSS. Данные и авторизация — Supabase. Доступ к строкам закрыт RLS-политиками, смена статуса и запись истории выполняются одной `SECURITY DEFINER`-функцией `change_task_status`, прямые `UPDATE status` и любые записи в `task_history` через API запрещены. Мягкое удаление (`is_deleted`) скрывает объект и его задачи; история не удаляется физически никогда.

**Tech Stack:** React 19, TypeScript 6, Vite 8, React Router 8, Tailwind CSS 4, **shadcn/ui на Radix (готовые компоненты, без самодельного UI)**, Supabase JS 2, Supabase Postgres/Auth. Тесты чистой логики — встроенный `node --test`; проверка RLS/RPC — отдельный скрипт `scripts/verify-security.mjs`.

**Spec:** `specs/001-mini-crm-objects-tasks/spec.md`

**Порядок под 2–3 часа:** задачи 1–9 — ядро приложения, 10 — документация и финальная проверка, 11 — публикация. Задачи 1–4 можно делать параллельно с чтением UI-кода, но не наоборот.

## Global Constraints

- React + TypeScript + Vite; Supabase (free tier); Tailwind CSS; интерфейс на русском.
- **UI только из shadcn/ui:** `Button`, `Input`, `Textarea`, `Select`, `Card`, `Badge`, `Dialog`, `AlertDialog`, `Label`, `Alert`. Свои визуальные примитивы не пишем; допустимы только тонкие обёртки над shadcn (`ObjectFormModal`, `TaskFormModal`, `ConfirmDialog`, `StatusBadge`).
- **Одна роль на пользователя:** `manager` или `assignee`, совмещения нет.
- Статусы строго: `new`, `in_progress`, `on_review`, `rework`, `accepted`. Подписи: «Новая», «В работе», «На проверке», «На доработке», «Принята».
- Переходы только: `new→in_progress` и `in_progress→on_review` и `rework→in_progress` — назначенный исполнитель; `on_review→accepted` и `on_review→rework` — постановщик. Комментарий обязателен только для `on_review→rework`.
- Мягкое удаление: `objects.is_deleted`, `tasks.is_deleted`. Задача скрыта, если `tasks.is_deleted = true` **или** `objects.is_deleted = true`. Каскадных триггеров на удаление нет.
- `task_history` — только вставка через `change_task_status` и триггер создания; `UPDATE`/`DELETE` истории запрещены всем ролям через API.
- Все авторизованные читают из `profiles` только `id`, `full_name`, `role` — чтобы видеть имена в истории. Email и изменение профилей через API недоступны.
- Открытая регистрация в Supabase Auth выключена; пользователи создаются вручную/сидом.
- `service_role` и другие секретные ключи не попадают во фронтенд и репозиторий. Во фронтенде только `VITE_SUPABASE_URL` и публичный ключ (`sb_publishable_...`).
- Никакого оверинжиниринга: без realtime, вложений, дедлайнов, пагинации, глобального поиска и менеджера состояния.

## Review Focus

Пять условий, которые чаще всего ломают такие CRM; каждое закреплено тестом в указанной задаче.

1. **Чужой исполнитель обращается к задаче/объекту напрямую через API** — должен получить пустой результат или отказ, даже зная UUID (Task 4).
2. **Прямой `UPDATE tasks.status` или вставка поддельной записи в `task_history`** — должны быть запрещены на уровне прав/RLS, без обхода через PostgREST (Task 4).
3. **Возврат на доработку с пустым или пробельным комментарием** — должен отклоняться и в RPC, и в интерфейсе (Task 4, Task 8).
4. **Задача в мягко удалённом объекте** — должна исчезать у исполнителя и у постановщика, а история остаётся в базе (Task 4, Task 6).
5. **Повышение роли через `profiles` или метаданные пользователя и открытая регистрация** — должны быть невозможны; роль задаётся только сервером/администратором (Task 4, Task 10).

---

## File Structure

```
supabase/
  migrations/20261105120000_schema.sql       # типы, таблицы, индексы, триггеры, helper-функции
  migrations/20261105120100_security.sql     # RLS, column grants, change_task_status
  seed.sql                                   # тестовые пользователи, объекты, задачи, история
scripts/
  verify-security.mjs                        # входы 3 пользователями + проверки RLS/RPC
src/
  main.tsx                                   # BrowserRouter + AuthProvider
  App.tsx                                    # маршруты
  index.css                                  # Tailwind
  lib/
    supabase.ts                              # единственный клиент Supabase
    utils.ts                                 # cn() из shadcn
    types.ts                                 # Role, TaskStatus, Profile, ObjectRow, TaskRow, ...
    labels.ts                                # подписи статусов/ролей, классы бейджей, даты
    task-actions.ts                          # доступные действия по роли и статусу
    task-actions.test.ts                     # матрица действий (node --test)
  api/
    objects.ts                               # list/get/create/update/softDelete
    tasks.ts                                 # list/get/history/create/update/delete/changeStatus
    profiles.ts                              # listExecutors
  auth/
    auth-context.ts                          # createContext + тип значения
    AuthProvider.tsx                         # сессия + профиль
    useAuth.ts                               # хук
    RequireAuth.tsx                          # защита маршрутов
    HomeRedirect.tsx                         # стартовый экран по роли
  components/
    Layout.tsx                               # навигация, имя, выход
    ui/                                      # готовые shadcn: button, card, badge, dialog, alert-dialog, input, textarea, select, label, alert
    StatusBadge.tsx                          # обёртка над shadcn Badge
    ConfirmDialog.tsx                        # обёртка над shadcn AlertDialog
    ObjectFormModal.tsx                      # форма в shadcn Dialog
    TaskFormModal.tsx                        # форма в shadcn Dialog
    HistoryTimeline.tsx                      # история переходов
  pages/
    LoginPage.tsx
    ObjectsPage.tsx
    ObjectDetailPage.tsx
    TaskDetailPage.tsx
    MyTasksPage.tsx
    NotFoundPage.tsx
docs/
  explanation-for-manager.md                 # объяснение без терминов
  decisions.md                               # решения, допущения, что не вошло
README.md
vercel.json
components.json                            # конфигурация shadcn
.env.example
```

---

### Task 1: Каркас проекта, Tailwind, Supabase, git

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `.gitignore`
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`, `.env.example`, `.env.local`

**Interfaces:**
- Produces: `supabase` (единственный клиент), переменные `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, базовые типы.
- Produces: скрипты `npm run test`, `npm run verify:security` (будут наполнены позже).

- [ ] **Step 1: Установить зависимости**

```bash
npm install @supabase/supabase-js
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Подключить Tailwind и alias `@/*`**

`vite.config.ts`:

```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
```

В `tsconfig.app.json` добавить:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: Инициализировать shadcn/ui и добавить готовые компоненты**

```bash
npx shadcn@latest init -d -b neutral
npx shadcn@latest add button card badge dialog alert-dialog input textarea select label alert -y
```

Если CLI задаёт вопрос про CSS-файл — указать `src/index.css`. Если `init` не находит alias — проверить Step 2. Ожидается: появились `components.json`, `src/lib/utils.ts`, `src/index.css` с темой shadcn и файлы в `src/components/ui/`.

- [ ] **Step 4: Создать `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Не настроены VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, key)
```

- [ ] **Step 5: Создать `src/lib/types.ts`**

```ts
export type Role = 'manager' | 'assignee'
export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'rework' | 'accepted'

export interface Profile {
  id: string
  full_name: string
  role: Role
}

export interface ObjectRow {
  id: string
  name: string
  address: string
  created_at: string
  is_deleted: boolean
}

export interface ObjectSummary extends ObjectRow {
  task_count: number
}

export interface TaskRow {
  id: string
  object_id: string
  title: string
  description: string | null
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
  updated_at: string
  is_deleted: boolean
}

export interface TaskWithRelations extends TaskRow {
  object: Pick<ObjectRow, 'id' | 'name' | 'address'>
  assignee: Profile
  author: Profile
}

export interface TaskHistoryEntry {
  id: number
  task_id: string
  actor_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  actor: Profile
}
```

- [ ] **Step 6: Создать `.env.example` и локальный `.env.local`**

`.env.example` (коммитится):

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

`.env.local` (не коммитится) — реальные значения проекта:

```dotenv
VITE_SUPABASE_URL=https://cbvbsepdyhwlaswocwer.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_wGotLyB4QXH2JedwkXLc3w_jQThAPQr
```

- [ ] **Step 7: Заменить демо-шаблон на заглушку и проверить сборку**

`src/App.tsx`:

```tsx
export default function App() {
  return <main className="p-8">Мини-CRM загружается…</main>
}
```

`src/main.tsx` оставить с `createRoot`, но импорт `./App.css` убрать.

Run: `npm run build`
Expected: сборка завершается без ошибок.

- [ ] **Step 8: Инициализировать git и закоммитить каркас**

Добавить в `.gitignore`:

```gitignore
.env
.env.local
supabase/.temp
```

```bash
git init
git branch -M main
git add package.json package-lock.json vite.config.ts tsconfig.app.json components.json src index.html .env.example .gitignore
git commit -m "chore: scaffold vite react tailwind shadcn supabase client"
```

---

### Task 2: Схема БД, триггеры и helper-функции

**Files:**
- Create: `supabase/migrations/20261105120000_schema.sql`

**Interfaces:**
- Produces: таблицы `profiles`, `objects`, `tasks`, `task_history`; типы `user_role`, `task_status`.
- Produces: `is_manager()`, `object_visible(uuid)`, `task_visible(uuid)`; триггеры создания истории и профиля.
- Produces: `tasks.status` по умолчанию `new`, `author_id`/`created_by` по умолчанию `auth.uid()`.

- [ ] **Step 1: Написать миграцию схемы**

```sql
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
```

- [ ] **Step 2: Применить миграцию к Supabase**

Через Supabase MCP: `apply_migration` с именем `schema` и содержимым файла. Либо через SQL Editor / `supabase db push`, если CLI настроен. Миграция должна примениться без ошибок.

- [ ] **Step 3: Проверить схему**

```sql
select to_regclass('public.profiles') as profiles,
       to_regclass('public.objects') as objects,
       to_regclass('public.tasks') as tasks,
       to_regclass('public.task_history') as history;
```

Expected: четыре непустых значения.

- [ ] **Step 4: Проверить триггер создания истории**

Выполнить в транзакции и откатить (подставить ID реального профиля после Task 4 либо временно вставить `auth.users`):

```sql
begin;
insert into public.objects (id, name, address, created_by)
values ('00000000-0000-0000-0000-000000000001', 'Тест', 'Тест', '<profile-id>');
insert into public.tasks (id, object_id, title, assignee_id, author_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
        'Проверка', '<assignee-id>', '<manager-id>');
select from_status, to_status from public.task_history
where task_id = '00000000-0000-0000-0000-000000000002';
rollback;
```

Expected: одна строка `null → new`.

- [ ] **Step 5: Закоммитить**

```bash
git add supabase/migrations/20261105120000_schema.sql
git commit -m "feat(db): add crm schema, triggers and visibility helpers"
```

---

### Task 3: RLS, права на колонки и RPC смены статуса

**Files:**
- Create: `supabase/migrations/20261105120100_security.sql`

**Interfaces:**
- Consumes: таблицы и helper-функции из Task 2.
- Produces: `change_task_status(p_task_id uuid, p_new_status task_status, p_comment text default null) returns tasks`.
- Produces: RLS-политики и column-level grants, на которых держится вся безопасность.

- [ ] **Step 1: Написать миграцию безопасности**

```sql
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
```

- [ ] **Step 2: Применить миграцию**

Через Supabase MCP: `apply_migration` с именем `security` и содержимым файла. Ожидается успех.

- [ ] **Step 3: Проверить RLS и права**

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'objects', 'tasks', 'task_history');

select proname, prosecdef
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('change_task_status', 'is_manager', 'task_visible', 'object_visible');

select table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee = 'authenticated'
order by table_name, column_name;
```

Expected: у всех четырёх таблиц `relrowsecurity = true`; `change_task_status` с `prosecdef = true`; у `tasks` в списке update-колонок **нет** `status`, `author_id`, `created_at`; у `task_history` только `SELECT`.

- [ ] **Step 4: Закоммитить**

```bash
git add supabase/migrations/20261105120100_security.sql
git commit -m "feat(db): enforce rls, column grants and status transition rpc"
```

---

### Task 4: Тестовые пользователи, демо-данные и проверка безопасности

**Files:**
- Create: `supabase/seed.sql`, `scripts/verify-security.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `change_task_status`, таблицы и RLS из Task 3.
- Produces: три пользователя (1 менеджер, 2 исполнителя), 3 объекта, задачи во всех статусах.
- Produces: `npm run verify:security`, который печатает `OK <имя проверки>` и падает на первом нарушении.

- [ ] **Step 1: Сначала написать `scripts/verify-security.mjs` (падающий тест)**

Скрипт использует `@supabase/supabase-js` и `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, создаёт отдельный клиент на каждого пользователя с `{ auth: { persistSession: false, autoRefreshToken: false } }` и входит тремя пользователями:

| Роль | Email | Пароль |
|---|---|---|
| Постановщик | `manager@crm.test` | `Manager123!` |
| Исполнитель 1 | `ivan@crm.test` | `Executor123!` |
| Исполнитель 2 | `anna@crm.test` | `Executor123!` |

Проверки (каждая — отдельная функция с `assert`):

1. `disable_signup === true` в `GET /auth/v1/settings` (заголовок `apikey`).
2. Менеджер создаёт объект O1 и задачу T1 на исполнителя 1; объект O2 и задачу T2 на исполнителя 2.
3. Исполнитель 1: `select` по T2 возвращает `[]`; `select` по O2 возвращает `[]`.
4. Исполнитель 1: прямой `update({ status: 'in_progress' })` по T1 возвращает ошибку; статус T1 после этого всё ещё `new` (проверяет менеджер).
5. Исполнитель 1: `insert` в `task_history` и `delete` из `task_history` возвращают ошибку.
6. Исполнитель 1: `update({ role: 'manager' })` в `profiles` возвращает ошибку.
7. Исполнитель 1: `rpc('change_task_status', T2, 'in_progress')` — ошибка; `rpc(..., T1, 'accepted')` — ошибка.
8. Менеджер: `rpc(T1, 'accepted')` из `new` — ошибка.
9. Исполнитель 1: `rpc(T1, 'in_progress')` — успех; история T1 содержит запись с `actor.full_name`.
10. Два одновременных `rpc(T1, 'on_review')` через `Promise.all`: ровно один успех, второй — ошибка; в истории только одна запись `in_progress→on_review`.
11. Менеджер: `rpc(T1, 'rework', '   ')` — ошибка «Комментарий обязателен…»; затем `rpc(T1, 'rework', 'Поправьте швы')` — успех.
12. Исполнитель 1: `rpc(T1, 'in_progress')`, затем `rpc(T1, 'on_review')` — успех; менеджер: `rpc(T1, 'accepted')` — успех; любой следующий переход — ошибка.
13. Исполнитель 2: `select task_history` по T1 возвращает `[]`.
14. Менеджер: `delete()` истории возвращает ошибку; `update({ comment: 'x' })` истории — ошибка.
15. Менеджер мягко удаляет O1; исполнитель 1 больше не видит T1. Менеджер мягко удаляет T2; исполнитель 2 больше не видит T2.
16. Исполнитель 1: попытка создать задачу — ошибка.

Скрипт в конце мягко удаляет созданные тестовые объекты. Пользователи и демо-данные остаются.

Добавить в `package.json` скрипт:

```json
"verify:security": "node --env-file=.env.local scripts/verify-security.mjs"
```

- [ ] **Step 2: Отключить открытую регистрацию**

В Supabase Dashboard → Authentication → Providers → Email отключить «Allow new users to sign up» (или «Enable sign up»). Анонимные входы оставить выключенными.

Проверка:

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

Expected: `"disable_signup": true`.

- [ ] **Step 3: Запустить проверки и убедиться, что падают**

Run: `node --env-file=.env.local scripts/verify-security.mjs`
Expected: FAIL на входе `manager@crm.test` — пользователей ещё нет (проверка `disable_signup` уже проходит).

- [ ] **Step 4: Написать `supabase/seed.sql`**

Создать трёх пользователей с фиксированными UUID (вставка в `auth.users` + `auth.identities`, пароль через `extensions.crypt(..., extensions.gen_salt('bf'))`, `email_confirmed_at = now()`), затем:

```sql
-- профили уже созданы триггером; роли выставляются только здесь/администратором
update public.profiles set full_name = 'Сергей Петров', role = 'manager'
where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set full_name = 'Иван Смирнов', role = 'assignee'
where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set full_name = 'Анна Ковалёва', role = 'assignee'
where id = '33333333-3333-3333-3333-333333333333';
```

Демо-данные:

| Объект | Задача | Исполнитель | Статус |
|---|---|---|---|
| ЖК «Солнечный», ул. Ленина, 15 | Залить фундамент секции А | Иван | Принята |
| ЖК «Солнечный» | Смонтировать опалубку секции Б | Иван | В работе |
| ЖК «Солнечный» | Проверить армирование | Анна | На проверке |
| Офис на Ленина, пр-т Ленина, 42 | Оштукатурить коридор 2 этажа | Анна | На доработке |
| Офис на Ленина | Заменить проводку в переговорной | Иван | Новая |
| Склад «Северный», Северный проезд, 7 | Убрать территорию | Анна | Новая |

Для каждой задачи триггер создаёт запись `null→new`; затем сид добавляет переходы:
- «В работе»: `new→in_progress` (исполнитель);
- «На проверке»: плюс `in_progress→on_review` (исполнитель);
- «Принята»: плюс `on_review→accepted` (менеджер);
- «На доработке»: плюс `on_review→rework` (менеджер) с комментарием `Проверьте швы в коридоре`.
Времена записей — `created_at` задачи + интервалы 1 час/2 часа/3 часа; автосозданной записи `null→new` выставить `created_at = tasks.created_at`.

Важно: сид выполняется от `postgres`, поэтому `created_by`, `author_id` и `assignee_id` указываются явно (значения `auth.uid()` при сиде равны `NULL`). Дополнительные записи истории вставлять с условием `where not exists`, чтобы повторный запуск не дублировал переходы.

- [ ] **Step 5: Применить сид**

Через Supabase MCP `execute_sql` (или SQL Editor). Ожидается успех.

- [ ] **Step 6: Прогнать проверки безопасности**

Run: `npm run verify:security`
Expected: все проверки `OK`, процесс завершается с кодом 0.

- [ ] **Step 7: Проверить входы вручную**

Через `npm run dev` войти всеми тремя пользователями. Ожидается: менеджер видит 3 объекта, Иван — 2 объекта (ЖК и Офис), Анна — 3 объекта (у неё задачи во всех).

- [ ] **Step 8: Закоммитить**

```bash
git add supabase/seed.sql scripts/verify-security.mjs package.json
git commit -m "test: seed demo data and verify rls plus status rpc"
```

---

### Task 5: Авторизация, маршрутизация, каркас интерфейса

**Files:**
- Create: `src/auth/auth-context.ts`, `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/RequireAuth.tsx`, `src/auth/HomeRedirect.tsx`, `src/components/Layout.tsx`, `src/pages/LoginPage.tsx`, `src/pages/NotFoundPage.tsx`, `src/lib/labels.ts`
- Create (заглушки, заменяются в Task 6–9): `src/pages/ObjectsPage.tsx`, `src/pages/ObjectDetailPage.tsx`, `src/pages/TaskDetailPage.tsx`, `src/pages/MyTasksPage.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `Profile`, `Role`.
- Produces: `useAuth(): { session: Session | null; profile: Profile | null; loading: boolean; signIn(email, password): Promise<void>; signOut(): Promise<void> }`.
- Produces: маршруты `/login`, `/objects`, `/objects/:id`, `/tasks/:id`, `/my-tasks`; `/` редиректит по роли.

- [ ] **Step 1: Реализовать контекст и провайдер**

`AuthProvider` при старте вызывает `supabase.auth.getSession()`, подписывается на `onAuthStateChange` и загружает профиль запросом:

```ts
supabase.from('profiles').select('id, full_name, role').eq('id', userId).single()
```

Если профиль не найден — показать ошибку и кнопку «Выйти», не пускать в приложение. `signIn` вызывает `supabase.auth.signInWithPassword`, `signOut` — `supabase.auth.signOut`.

- [ ] **Step 2: Создать `src/lib/labels.ts`**

```ts
import type { Role, TaskStatus } from './types'

export const statusLabels: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  rework: 'На доработке',
  accepted: 'Принята',
}

export const statusClasses: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  on_review: 'bg-amber-100 text-amber-800',
  rework: 'bg-rose-100 text-rose-800',
  accepted: 'bg-emerald-100 text-emerald-800',
}

export const roleLabels: Record<Role, string> = {
  manager: 'Постановщик',
  assignee: 'Исполнитель',
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
```

`Layout` использует `roleLabels`, `StatusBadge` — остальные поля.

- [ ] **Step 3: Сделать `LoginPage` на shadcn**

`Card` с формой: `Label` + `Input` для email и пароля, `Button` «Войти», ошибка в `Alert`. Сообщение об ошибке не раскрывает, существует ли аккаунт. Ссылки на регистрацию нет. При успехе — редирект на `/`.

- [ ] **Step 4: Сделать защиту маршрутов и стартовый редирект**

`RequireAuth`: пока `loading` — спиннер; без сессии — `<Navigate to="/login" replace />`; с сессией — `<Outlet />`.
`HomeRedirect`: `manager → /objects`, `assignee → /my-tasks`.

- [ ] **Step 5: Сделать `Layout`**

Шапка с названием, именем пользователя и ролью; ссылки «Объекты» (всем), «Мои задачи» (только исполнителю); shadcn `Button` «Выйти». Контент — `<Outlet />` в контейнере `mx-auto max-w-5xl px-4 py-6`.

- [ ] **Step 6: Собрать маршруты в `App.tsx` и обернуть в провайдеры в `main.tsx`**

```tsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="objects" element={<ObjectsPage />} />
          <Route path="objects/:id" element={<ObjectDetailPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

Страницы объектов/задач на этом шаге могут быть заглушками — они появятся в Task 6–9.

- [ ] **Step 7: Проверить вручную**

Run: `npm run dev`
Expected: без сессии любой URL ведёт на `/login`; после входа менеджер попадает на `/objects`, Иван — на `/my-tasks`; выход возвращает на `/login`.

- [ ] **Step 8: Закоммитить**

```bash
git add src/auth src/components/Layout.tsx src/pages src/lib/labels.ts src/main.tsx src/App.tsx
git commit -m "feat(ui): add auth session, role routing and layout"
```

---

### Task 6: Список объектов на shadcn

**Files:**
- Create: `src/components/StatusBadge.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/ObjectFormModal.tsx`, `src/api/objects.ts`
- Consume: `src/components/ui/*` из shadcn (Task 1)
- Modify: `src/pages/ObjectsPage.tsx` (заменить заглушку), `src/pages/NotFoundPage.tsx` при необходимости

**Interfaces:**
- Consumes: `statusLabels`, `statusClasses`, `roleLabels`, `formatDate` из Task 5; shadcn `Button`, `Card`, `Input`, `Label`, `Dialog`, `AlertDialog`, `Alert`.
- Produces: `listObjects(): Promise<ObjectSummary[]>`, `getObject(id): Promise<ObjectRow>`, `createObject({name,address}): Promise<ObjectRow>`, `updateObject(id,{name,address}): Promise<void>`, `softDeleteObject(id): Promise<void>`.

- [ ] **Step 1: Использовать готовые shadcn-компоненты**

Проверить, что установлены `button`, `card`, `badge`, `dialog`, `alert-dialog`, `input`, `textarea`, `select`, `label`, `alert`. Свои кнопки/поля/модалки не создавать. Импортировать из `@/components/ui/...`.

- [ ] **Step 2: Сделать `StatusBadge` на shadcn `Badge`**

Компонент принимает `status: TaskStatus` и рендерит `<Badge className={statusClasses[status]}>{statusLabels[status]}</Badge>`. Данные брать из `src/lib/labels.ts`, созданного в Task 5.

- [ ] **Step 3: Реализовать `src/api/objects.ts`**

Список: `select('id,name,address,created_at,is_deleted,tasks(id,status,is_deleted)')`, `task_count = tasks.filter(t => !t.is_deleted).length`, сортировка по `created_at`.
Создание: `insert({ name, address })`.
Редактирование: `update({ name, address }).eq('id', id)`.
Удаление: `update({ is_deleted: true }).eq('id', id)`.
Любая ошибка Supabase → `throw new Error(error.message)`.

- [ ] **Step 4: Сделать `ObjectsPage`**

Менеджер: `Button` «Новый объект», каждая запись — shadcn `Card` с названием, адресом, числом задач, кнопками «Редактировать» и «Удалить» (`ConfirmDialog` на `AlertDialog`). Исполнитель: те же карточки без кнопок, число задач = его задачи. Клик по карточке — `/objects/:id`. Состояния: спиннер, пустой список («Объектов пока нет»), ошибка в shadcn `Alert`. `ObjectFormModal` — `Dialog` с `Input`, `Label`, `Button`.

- [ ] **Step 5: Проверить вручную**

Менеджер создаёт объект, редактирует адрес, удаляет объект. После удаления объект исчезает у всех. Исполнитель не видит кнопок создания/редактирования. RLS не даёт исполнителю удалить объект прямым запросом (это уже покрыто Task 4).

- [ ] **Step 6: Закоммитить**

```bash
git add src/components/StatusBadge.tsx src/components/ConfirmDialog.tsx src/components/ObjectFormModal.tsx src/api/objects.ts src/pages/ObjectsPage.tsx
git commit -m "feat(ui): add object list and manager object crud"
```

---

### Task 7: Карточка объекта и создание/редактирование задач

**Files:**
- Create: `src/api/tasks.ts`, `src/api/profiles.ts`, `src/components/TaskFormModal.tsx`, `src/pages/ObjectDetailPage.tsx`

**Interfaces:**
- Produces: `listTasksForObject(objectId): Promise<TaskWithRelations[]>`, `listExecutors(): Promise<Profile[]>`, `createTask(input): Promise<{id: string}>`, `updateTask(id, input): Promise<void>`, `softDeleteTask(id): Promise<void>`.
- `createTask` input: `{ object_id, title, description, assignee_id }`.

- [ ] **Step 1: Реализовать запросы задач**

Список задач объекта:

```ts
supabase
  .from('tasks')
  .select('*, object:objects!tasks_object_id_fkey(id,name,address), assignee:profiles!tasks_assignee_id_fkey(id,full_name,role), author:profiles!tasks_author_id_fkey(id,full_name,role)')
  .eq('object_id', objectId)
  .order('created_at', { ascending: false })
```

`listExecutors`: `from('profiles').select('id,full_name,role').eq('role','assignee').order('full_name')`.
`createTask`: `insert({ object_id, title, description: description.trim() || null, assignee_id }).select('id').single()`.
`updateTask`: `update({ title, description, object_id, assignee_id }).eq('id', id)` — **без поля `status`**.
`softDeleteTask`: `update({ is_deleted: true }).eq('id', id)`.

- [ ] **Step 2: Сделать `TaskFormModal` на shadcn**

`Dialog` + `Input` (название), `Textarea` (описание), `Select` (исполнитель из `listExecutors`), `Select` (объект: в создании фиксирован, в редактировании — выбор из объектов менеджера), `Label`, `Button`. Валидация на клиенте: название не пустое, исполнитель выбран. Кнопка сохранения блокируется на время запроса; ошибка — в `Alert`.

- [ ] **Step 3: Сделать `ObjectDetailPage`**

Загрузить объект и задачи. Показать `Card` с названием и адресом, кнопки менеджера (`Button`) «Редактировать объект», «Удалить объект», «Новая задача». Список задач — `Card`/строки: название, исполнитель, `StatusBadge`, дата, ссылка `/tasks/:id`. Исполнитель видит только свои задачи (RLS), кнопок управления нет. Если объект не найден/недоступен — «Объект не найден или недоступен» и ссылка назад. Ошибки — `Alert`.

- [ ] **Step 4: Проверить вручную**

Менеджер создаёт задачу в объекте и назначает Ивана. Задача появляется в карточке объекта. Иван видит её в объекте; Анна не видит. Редактирование названия и исполнителя работает; после смены исполнителя задача исчезает у прежнего и появляется у нового.

- [ ] **Step 5: Закоммитить**

```bash
git add src/api/tasks.ts src/api/profiles.ts src/components/TaskFormModal.tsx src/pages/ObjectDetailPage.tsx
git commit -m "feat(ui): add object card and task create edit"
```

---

### Task 8: Карточка задачи, действия по статусу и история

**Files:**
- Create: `src/lib/task-actions.ts`, `src/lib/task-actions.test.ts`, `src/components/HistoryTimeline.tsx`, `src/pages/TaskDetailPage.tsx`
- Modify: `src/api/tasks.ts` (добавить `getTask`, `getTaskHistory`, `changeTaskStatus`), `package.json` (скрипт `test`)

**Interfaces:**
- Produces: `availableActions(role: Role, status: TaskStatus): TaskAction[]`, где `TaskAction = { to: TaskStatus; label: string; requiresComment?: boolean; variant: 'primary' | 'secondary' }`.
- Produces: `getTask(id): Promise<TaskWithRelations>`, `getTaskHistory(taskId): Promise<TaskHistoryEntry[]>`, `changeTaskStatus(taskId, newStatus, comment?): Promise<void>`.

- [ ] **Step 1: Написать падающий тест матрицы действий**

`src/lib/task-actions.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { availableActions } from './task-actions.ts'

test('постановщик действует только на проверке', () => {
  assert.deepEqual(
    availableActions('manager', 'on_review').map((a) => a.to),
    ['accepted', 'rework'],
  )
  for (const status of ['new', 'in_progress', 'rework', 'accepted'] as const) {
    assert.deepEqual(availableActions('manager', status), [])
  }
})

test('исполнитель ведёт только свои переходы', () => {
  assert.deepEqual(availableActions('assignee', 'new').map((a) => a.to), ['in_progress'])
  assert.deepEqual(availableActions('assignee', 'rework').map((a) => a.to), ['in_progress'])
  assert.deepEqual(availableActions('assignee', 'in_progress').map((a) => a.to), ['on_review'])
  assert.deepEqual(availableActions('assignee', 'on_review'), [])
  assert.deepEqual(availableActions('assignee', 'accepted'), [])
})

test('комментарий требуется только при возврате на доработку', () => {
  const managerActions = availableActions('manager', 'on_review')
  assert.equal(managerActions.find((a) => a.to === 'rework')?.requiresComment, true)
  assert.equal(managerActions.find((a) => a.to === 'accepted')?.requiresComment, undefined)
})
```

- [ ] **Step 2: Запустить тест и убедиться, что падает**

Run: `node --test src/lib/task-actions.test.ts`
Expected: FAIL — модуль `task-actions.ts` не найден.

- [ ] **Step 3: Реализовать `availableActions`**

```ts
import type { Role, TaskStatus } from './types'

export interface TaskAction {
  to: TaskStatus
  label: string
  requiresComment?: boolean
  variant: 'primary' | 'secondary'
}

export function availableActions(role: Role, status: TaskStatus): TaskAction[] {
  if (role === 'assignee') {
    if (status === 'new' || status === 'rework') {
      return [{ to: 'in_progress', label: 'Взять в работу', variant: 'primary' }]
    }
    if (status === 'in_progress') {
      return [{ to: 'on_review', label: 'Отправить на проверку', variant: 'primary' }]
    }
    return []
  }

  if (status === 'on_review') {
    return [
      { to: 'accepted', label: 'Принять', variant: 'primary' },
      { to: 'rework', label: 'Вернуть на доработку', requiresComment: true, variant: 'secondary' },
    ]
  }

  return []
}
```

- [ ] **Step 4: Запустить тест и убедиться, что проходит**

Run: `node --test src/lib/task-actions.test.ts`
Expected: PASS, 3 теста.

Добавить в `package.json`: `"test": "node --test src/lib/task-actions.test.ts"`.

- [ ] **Step 5: Добавить запросы карточки задачи**

`getTask` — тот же select с joins, что в Task 7, плюс `.eq('id', id).single()`.
`getTaskHistory`:

```ts
supabase
  .from('task_history')
  .select('*, actor:profiles!task_history_actor_id_fkey(id,full_name,role)')
  .eq('task_id', taskId)
  .order('created_at', { ascending: true })
```

`changeTaskStatus` вызывает `supabase.rpc('change_task_status', { p_task_id, p_new_status, p_comment: comment?.trim() || null })`; при ошибке бросает `new Error(error.message)`.

- [ ] **Step 6: Сделать `TaskDetailPage`**

Показать `Card`: название, `StatusBadge`, объект (ссылка), исполнитель, автор, дата создания, описание, история. Кнопки строятся **только** из `availableActions(profile.role, task.status)` и используют shadcn `Button`.

- Для `accepted` действия сразу вызывают `changeTaskStatus`, затем перезагружают задачу и историю.
- Для действия с `requiresComment` открывается shadcn `Dialog` с `Textarea`; кнопка подтверждения disabled, пока `comment.trim()` пуст; после ошибки сервера текст сохраняется.
- Менеджер дополнительно видит «Редактировать» и «Удалить» (удаление — мягкое, через `ConfirmDialog` на `AlertDialog`).
- Ошибки RPC показываются в shadcn `Alert`, без потери данных формы.
- После успешного перехода обновляются и карточка, и история.

- [ ] **Step 7: Сделать `HistoryTimeline`**

Каждая запись: `actor.full_name`, `formatDate(created_at)`, `statusLabels[from_status] ?? 'Создание'` → `statusLabels[to_status]`, комментарий (если есть). Порядок — от старых к новым.

- [ ] **Step 8: Проверить полный цикл вручную**

1. Менеджер создаёт задачу на Ивана.
2. Иван: «Взять в работу» → «Отправить на проверку».
3. Менеджер: «Вернуть на доработку» без комментария (кнопка недоступна) и с комментарием (успех).
4. Иван видит комментарий в истории, снова берёт в работу и отправляет на проверку.
5. Менеджер принимает; кнопок перехода больше нет.
6. В истории 7 записей: создание, в работу, на проверку, доработка, в работу, на проверку, принята.
7. Анна не может открыть эту задачу по прямой ссылке и не видит историю.

Run: `npm run build && npm test`
Expected: обе команды без ошибок.

- [ ] **Step 9: Закоммитить**

```bash
git add src/lib/task-actions.ts src/lib/task-actions.test.ts src/components/HistoryTimeline.tsx src/pages/TaskDetailPage.tsx src/api/tasks.ts package.json
git commit -m "feat(ui): add task card, status actions and immutable history"
```

---

### Task 9: «Мои задачи»

**Files:**
- Create: `src/pages/MyTasksPage.tsx`
- Modify: `src/api/tasks.ts` (добавить `listMyTasks`)

**Interfaces:**
- Consumes: `useAuth`, `listMyTasks`, `StatusBadge`, `formatDate`.
- Produces: `listMyTasks(profileId: string): Promise<TaskWithRelations[]>` — задачи указанного исполнителя, новые сверху.

- [ ] **Step 1: Реализовать `listMyTasks`**

```ts
supabase
  .from('tasks')
  .select('*, object:objects!tasks_object_id_fkey(id,name,address), assignee:profiles!tasks_assignee_id_fkey(id,full_name,role), author:profiles!tasks_author_id_fkey(id,full_name,role)')
  .eq('assignee_id', profileId)
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: Сделать страницу**

Список shadcn `Card`: название, объект, `StatusBadge`, дата. Клик — `/tasks/:id`. Пустое состояние: «У вас пока нет задач». Если роль менеджера — `<Navigate to="/objects" replace />` (раздел только для исполнителя).

- [ ] **Step 3: Проверить вручную**

Иван видит 3 свои задачи, Анна — 3 свои, пересечений нет. После смены исполнителя список обновляется при следующем входе/перезагрузке.

- [ ] **Step 4: Закоммитить**

```bash
git add src/pages/MyTasksPage.tsx src/api/tasks.ts
git commit -m "feat(ui): add my tasks screen for assignees"
```

---

### Task 10: Документация, проверка настроек, финальная проверка

**Files:**
- Modify: `README.md`, `package.json`
- Create: `docs/explanation-for-manager.md`, `docs/decisions.md`, `vercel.json`

**Interfaces:**
- Produces: инструкция запуска, список доступов, объяснение для руководителя, список решений и ограничений.

- [ ] **Step 1: Убедиться, что регистрация по-прежнему отключена**

Настройка выполнена в Task 4. Повторно проверить, что в Supabase Dashboard → Authentication → Providers → Email выключен «Allow new users to sign up», а анонимные входы запрещены.

Проверка:

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

Expected: `"disable_signup": true`. Если `false` — настройка не применилась, повторить.

- [ ] **Step 2: Написать README**

Разделы: что это; стек (React, Vite, TypeScript, Tailwind, shadcn/ui, Supabase); демо-доступы (1 менеджер, 2 исполнителя); локальный запуск (`npm install`, `.env.local`, применение миграций, `seed.sql`, `npm run dev`); как применить миграции (Supabase MCP/CLI/SQL Editor); тесты (`npm test`, `npm run verify:security`); модель безопасности простыми словами; деплой на Vercel; структура проекта; ссылки на `spec.md`, `docs/decisions.md`, `docs/explanation-for-manager.md`.

- [ ] **Step 3: Написать объяснение для руководителя**

`docs/explanation-for-manager.md` — полстраницы без терминов: зачем система, две роли, жизненный цикл задачи, что видит исполнитель, почему он не увидит чужое, почему историю нельзя подделать, что не входит в демо-версию.

- [ ] **Step 4: Написать список решений и допущений**

`docs/decisions.md`: A-001…A-015 из спеки кратко + отдельный раздел «Что не успели/не входит»: восстановление пароля, уведомления, вложения, дедлайны, управление пользователями из интерфейса, realtime, пагинация/поиск.

- [ ] **Step 5: Создать `vercel.json` для SPA-маршрутов**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 6: Финальная проверка**

```bash
npm run build
npm run lint
npm test
npm run verify:security
```

Expected: все команды завершаются с кодом 0. Вручную пройти сценарии SC-001 (полный цикл менеджера) и SC-002 (исполнитель отправляет задачу на проверку).

- [ ] **Step 7: Закоммитить**

```bash
git add README.md docs vercel.json package.json
git commit -m "docs: add setup guide, manager explanation and decisions"
```

---

### Task 11: Публикация и сдача

**Files:**
- Modify: `README.md` (ссылки на прод и репозиторий)

**Interfaces:**
- Produces: публичная ссылка, GitHub-репозиторий, подтверждение работы продакшена.

- [ ] **Step 1: Создать GitHub-репозиторий и запушить**

```bash
gh repo create test-mini-crm --public --source=. --remote=origin --push
```

Если `gh` не авторизован — создать репозиторий вручную и выполнить `git remote add origin ... && git push -u origin main`.

- [ ] **Step 2: Задеплоить на Vercel**

```bash
npx vercel --prod
```

При деплое задать `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (публичный ключ). Если CLI не авторизован — импортировать репозиторий в Vercel Dashboard и задать те же переменные. `service_role` не добавлять.

- [ ] **Step 3: Проверить прод**

Открыть публичную ссылку:
1. Войти менеджером, увидеть 3 объекта и задачи во всех статусах.
2. Войти Иваном, увидеть только свои задачи.
3. Открыть прямую ссылку `/tasks/<id>` во вкладке инкогнито — редирект на вход, без данных.
4. Обновить страницу на `/objects` — маршрут не даёт 404.
5. Проверить, что в исходниках фронтенда нет `service_role`.

Run: `npm run verify:security` (против локального `.env.local`, тот же проект)
Expected: все проверки проходят.

- [ ] **Step 4: Обновить README ссылкой на прод**

Добавить в начало README ссылку на приложение и репозиторий.

- [ ] **Step 5: Финальный коммит**

```bash
git add README.md
git commit -m "docs: add production and repository links"
git push
```

- [ ] **Step 6: Собрать пакет сдачи**

Одним сообщением отправить:
1. Ссылку на приложение и доступы (1 менеджер + 2 исполнителя).
2. Ссылку на GitHub-репозиторий с миграциями и README.
3. Объяснение для руководителя (ссылка на `docs/explanation-for-manager.md` или видео).
4. Список решений и допущений (ссылка на `docs/decisions.md`) и что не вошло.

---

## Self-Review

**1. Покрытие спеки**

| Требование спеки | Задача |
|---|---|
| FR-001…FR-007 роли, вход, отсутствие регистрации | Task 3, 4, 5, 10 |
| FR-008…FR-011 объекты и мягкое удаление | Task 2, 3, 6 |
| FR-012…FR-019 задачи, карточки, «Мои задачи», только доступные действия | Task 7, 8, 9 |
| FR-020…FR-029 статусы, матрица, комментарий, конкурентность | Task 3, 4, 8 |
| FR-030…FR-035 история, автор/время, неизменяемость | Task 2, 3, 4, 8 |
| SR-001…SR-011 RLS, права, секреты, роли, профили | Task 3, 4, 10, 11 |
| FR-036…FR-043 экраны, русский UI | Task 5–9 |
| FR-044…FR-048 демо-данные, доступы, деплой, README, объяснение | Task 4, 10, 11 |
| SC-001…SC-010 критерии успеха | Task 4 (безопасность), Task 8 (цикл), Task 10–11 |

**2. Проверка шагов:** каждый шаг содержит одно действие с проверяемым результатом; SQL-политики и сигнатуры даны явно, потому что именно они являются проектными решениями. UI собирается из готовых shadcn-компонентов; код компонентов не транскрибирован — даны файлы, сигнатуры и поведение.

**3. Согласованность типов:** `Role`, `TaskStatus`, `Profile`, `ObjectRow`, `TaskWithRelations`, `TaskHistoryEntry`, `TaskAction`, `availableActions`, `changeTaskStatus` совпадают во всех задачах. Имена RPC-аргументов (`p_task_id`, `p_new_status`, `p_comment`) совпадают в SQL и вызове Supabase.

**4. Review Focus:** все пять пунктов закрыты проверками 1–16 в `scripts/verify-security.mjs` (Task 4) и UI-валидацией комментария в Task 8.

**5. Пропорция:** план содержит только те решения, которые нельзя принять по ходу: схему, политики, сигнатуры, матрицу действий, порядок экранов. Полные тексты компонентов не приводятся.
