-- Демо-данные для мини-CRM.
-- Выполняется от postgres/service_role. Пароли только для тестового стенда.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'manager@crm.test',
    extensions.crypt('Manager123!', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Сергей Петров"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'ivan@crm.test',
    extensions.crypt('Executor123!', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Иван Смирнов"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'anna@crm.test',
    extensions.crypt('Executor123!', extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Анна Ковалёва"}'::jsonb,
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"manager@crm.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"ivan@crm.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    '{"sub":"33333333-3333-3333-3333-333333333333","email":"anna@crm.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Сергей Петров', 'manager'),
  ('22222222-2222-2222-2222-222222222222', 'Иван Смирнов', 'assignee'),
  ('33333333-3333-3333-3333-333333333333', 'Анна Ковалёва', 'assignee')
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role;

insert into public.objects (id, name, address, created_by, created_at) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'ЖК «Солнечный»', 'ул. Ленина, 15',
    '11111111-1111-1111-1111-111111111111', now() - interval '10 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Офис на Ленина', 'пр-т Ленина, 42',
    '11111111-1111-1111-1111-111111111111', now() - interval '8 days'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Склад «Северный»', 'Северный проезд, 7',
    '11111111-1111-1111-1111-111111111111', now() - interval '6 days'
  )
on conflict (id) do nothing;

insert into public.tasks (
  id, object_id, title, description, assignee_id, author_id, created_at
) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Залить фундамент секции А',
    'Бетон М300, проверить отметки по проекту.',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '5 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Смонтировать опалубку секции Б',
    'Щиты по графику, не забыть про распалубочный состав.',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '2 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Проверить армирование',
    'Сверить с чертежами КЖ-01.',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '1 day'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000002',
    'Оштукатурить коридор 2 этажа',
    'Углы под маяк, откосы по уровню.',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '3 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000002',
    'Заменить проводку в переговорной',
    'Кабель ВВГнг, розетки у стола.',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '6 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000003',
    'Убрать территорию',
    'Вынести мусор, подмести вход.',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '2 hours'
  )
on conflict (id) do nothing;

-- Автосозданная запись null→new должна совпадать по времени с созданием задачи.
update public.task_history h
set created_at = t.created_at
from public.tasks t
where h.task_id = t.id
  and h.from_status is null
  and h.to_status = 'new'
  and h.task_id in (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000006'
  );

insert into public.task_history (
  task_id, actor_id, from_status, to_status, comment, created_at
)
select
  v.task_id,
  v.actor_id,
  v.from_status::public.task_status,
  v.to_status::public.task_status,
  v.comment,
  t.created_at + v.offset_interval
from (values
  (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'new', 'in_progress', null::text, interval '1 hour'
  ),
  (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'in_progress', 'on_review', null::text, interval '2 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000001'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'on_review', 'accepted', null::text, interval '3 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000002'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'new', 'in_progress', null::text, interval '1 hour'
  ),
  (
    'b0000000-0000-0000-0000-000000000003'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'new', 'in_progress', null::text, interval '1 hour'
  ),
  (
    'b0000000-0000-0000-0000-000000000003'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'in_progress', 'on_review', null::text, interval '2 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000004'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'new', 'in_progress', null::text, interval '1 hour'
  ),
  (
    'b0000000-0000-0000-0000-000000000004'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'in_progress', 'on_review', null::text, interval '2 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000004'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'on_review', 'rework', 'Проверьте швы в коридоре', interval '3 hours'
  )
) as v(task_id, actor_id, from_status, to_status, comment, offset_interval)
join public.tasks t on t.id = v.task_id
where not exists (
  select 1
  from public.task_history h
  where h.task_id = v.task_id
    and h.from_status = v.from_status::public.task_status
    and h.to_status = v.to_status::public.task_status
);

update public.tasks
set status = 'accepted'
where id = 'b0000000-0000-0000-0000-000000000001';

update public.tasks
set status = 'in_progress'
where id = 'b0000000-0000-0000-0000-000000000002';

update public.tasks
set status = 'on_review'
where id = 'b0000000-0000-0000-0000-000000000003';

update public.tasks
set status = 'rework'
where id = 'b0000000-0000-0000-0000-000000000004';
