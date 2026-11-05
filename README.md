# Мини-CRM для строительной компании

**Демо:** https://test-mini-crm.vercel.app

Небольшое приложение для учёта строительных объектов и задач с двумя ролями:
**постановщик** (менеджер) и **исполнитель**. Постановщик создаёт объекты и задачи,
назначает исполнителей и принимает работу. Исполнитель видит только свои задачи,
берёт их в работу и отправляет на проверку.

## Стек

- React 19 + TypeScript + Vite
- Tailwind CSS 4 и готовые компоненты [shadcn/ui](https://ui.shadcn.com/) на Radix
- React Router
- Supabase: Postgres, Auth, Row Level Security
- Тесты чистой логики: встроенный `node --test`
- Проверка RLS/RPC: отдельный скрипт на Supabase JS

## Демо-доступы

| Роль | Email | Пароль | Имя |
|---|---|---|---|
| Постановщик | `manager@crm.test` | `Manager123!` | Сергей Петров |
| Исполнитель | `ivan@crm.test` | `Executor123!` | Иван Смирнов |
| Исполнитель | `anna@crm.test` | `Executor123!` | Анна Ковалёва |

В демо-данных три объекта и шесть задач во всех статусах: «Новая», «В работе»,
«На проверке», «На доработке», «Принята».

## Локальный запуск

```bash
npm install
cp .env.example .env.local
# заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm run dev
```

`VITE_SUPABASE_ANON_KEY` — это publishable/anon-ключ Supabase. Он предназначен для
браузера; доступ к данным ограничен RLS-политиками. **Service-role ключ во фронтенд
и репозиторий не попадает.**

Приложение откроется на `http://localhost:5173`.

## База данных

Миграции лежат в `supabase/migrations/` и применяются по порядку:

1. `20261105120000_schema.sql` — таблицы, enum-типы, индексы, триггеры, helper-функции.
2. `20261105120100_security.sql` — RLS, column-level grants, RPC смены статуса.
3. `20261105120200_fix_returning_visibility.sql` — исправление SELECT-политик для
   `INSERT ... RETURNING`.

Демо-данные — `supabase/seed.sql`.

### Применение через Supabase CLI

```bash
supabase link --project-ref <project-ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Применение через SQL Editor / MCP

Выполните файлы миграций по порядку, затем `seed.sql` в SQL Editor Supabase или
через `apply_migration` / `execute_sql` в Supabase MCP.

### Настройки Auth

В Dashboard → Authentication → Providers → Email:

- **Allow new users to sign up** — выключено;
- анонимные входы — выключены.

Проверка:

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

Ожидается `"disable_signup": true`. Пользователи создаются вручную (в демо — через
`seed.sql`, который вставляет `auth.users` и `auth.identities`).

## Проверки

```bash
npm run lint        # ESLint
npm run build       # tsc + vite build
npm test            # матрица переходов статусов, 3 теста
npm run verify:security  # 16 интеграционных проверок RLS и RPC
```

`verify:security` требует `.env.local`, применённых миграций, демо-пользователей и
выключенной регистрации. Скрипт создаёт временные объекты и задачи, проверяет
запреты и мягко удаляет их в конце.

## Модель безопасности

- **RLS включён на всех таблицах.** Исполнитель видит только свои задачи и объекты,
  где у него есть неудалённые задачи. Постановщик видит все неудалённые объекты.
- **Прямая смена статуса запрещена.** У роли `authenticated` нет `UPDATE`-права на
  колонку `tasks.status`; попытка прямого `UPDATE` возвращает ошибку.
- **Единственный путь смены статуса** — функция
  `change_task_status(p_task_id, p_new_status, p_comment)`. Она работает как
  `SECURITY DEFINER`, проверяет роль, назначение, допустимость перехода и
  обязательный комментарий, блокирует строку `FOR UPDATE` и атомарно пишет историю.
- **История неизменяема.** У `task_history` есть только `SELECT`-права; `INSERT`
  делает функция/триггер, `UPDATE` и `DELETE` запрещены даже постановщику.
- **Профили.** Все авторизованные читают только `id`, `full_name`, `role`, чтобы
  показывать имена в истории. Менять роли через API нельзя.
- **Мягкое удаление.** У объектов и задач есть `is_deleted`. Удалённая запись
  скрывается, если удалена сама или её объект. `task_history` не удаляется.

Подробности — в [спецификации](specs/001-mini-crm-objects-tasks/spec.md) и
[списке решений](docs/decisions.md).

## Деплой на Vercel

1. Импортируйте репозиторий в Vercel.
2. Framework preset — **Vite**, build command — `npm run build`, output — `dist`.
3. Добавьте переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
4. `vercel.json` уже содержит rewrite всех путей на `index.html` для клиентских
   маршрутов React Router.

## Структура

```
src/
  api/            запросы к Supabase (объекты, задачи, профили)
  auth/           сессия, профиль, защита маршрутов
  components/     Layout, модалки, StatusBadge, история
  components/ui/  сгенерированные компоненты shadcn
  lib/            типы, подписи, матрица действий, Supabase-клиент
  pages/          вход, объекты, объект, задача, мои задачи
supabase/
  migrations/     схема, безопасность, исправление политик
  seed.sql        демо-пользователи, объекты, задачи, история
scripts/
  verify-security.mjs
docs/
  decisions.md
  explanation-for-manager.md
specs/001-mini-crm-objects-tasks/spec.md
```

## Документы

- [Спецификация](specs/001-mini-crm-objects-tasks/spec.md)
- [Решения и допущения](docs/decisions.md)
- [Объяснение для руководителя](docs/explanation-for-manager.md)
