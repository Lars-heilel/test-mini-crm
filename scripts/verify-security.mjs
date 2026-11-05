import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

const manager = createClient(url, key, clientOptions)
const ivan = createClient(url, key, clientOptions)
const anna = createClient(url, key, clientOptions)

let passed = 0

function ok(name) {
  passed += 1
  console.log(`OK ${passed}. ${name}`)
}

async function check(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.message ?? error}`)
    throw error
  }
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert.ifError(error)
  return data.user
}

async function insertOne(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select().single()
  assert.ifError(error)
  return data
}

const suffix = Date.now()
let object1
let object2

try {
  await check('открытая регистрация отключена', async () => {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    assert.equal(response.ok, true, `settings HTTP ${response.status}`)
    const settings = await response.json()
    assert.equal(settings.disable_signup, true)
  })

  const managerUser = await signIn(manager, 'manager@crm.test', 'Manager123!')
  const ivanUser = await signIn(ivan, 'ivan@crm.test', 'Executor123!')
  const annaUser = await signIn(anna, 'anna@crm.test', 'Executor123!')

  object1 = await insertOne(manager, 'objects', {
    name: `Проверка O1 ${suffix}`,
    address: 'Тестовый адрес 1',
  })
  object2 = await insertOne(manager, 'objects', {
    name: `Проверка O2 ${suffix}`,
    address: 'Тестовый адрес 2',
  })

  const task1 = await insertOne(manager, 'tasks', {
    object_id: object1.id,
    title: `Проверка T1 ${suffix}`,
    description: 'Задача для проверки переходов',
    assignee_id: ivanUser.id,
  })
  const task2 = await insertOne(manager, 'tasks', {
    object_id: object2.id,
    title: `Проверка T2 ${suffix}`,
    description: 'Задача второго исполнителя',
    assignee_id: annaUser.id,
  })

  await check('менеджер создал объекты и задачи', async () => {
    assert.ok(object1.id && object2.id && task1.id && task2.id)
    const { data, error } = await manager
      .from('tasks')
      .select('id, status, assignee_id')
      .in('id', [task1.id, task2.id])
    assert.ifError(error)
    assert.equal(data.length, 2)
    assert.equal(data.every((task) => task.status === 'new'), true)
  })

  await check('исполнитель 1 не видит чужие задачу и объект', async () => {
    const { data: tasks, error: tasksError } = await ivan
      .from('tasks')
      .select('id')
      .eq('id', task2.id)
    assert.ifError(tasksError)
    assert.equal(tasks.length, 0)

    const { data: objects, error: objectsError } = await ivan
      .from('objects')
      .select('id')
      .eq('id', object2.id)
    assert.ifError(objectsError)
    assert.equal(objects.length, 0)
  })

  await check('прямое обновление статуса задачи запрещено', async () => {
    const direct = await ivan.from('tasks').update({ status: 'in_progress' }).eq('id', task1.id)
    assert.ok(direct.error, 'ожидалась ошибка прямого UPDATE status')

    const { data, error } = await manager.from('tasks').select('status').eq('id', task1.id).single()
    assert.ifError(error)
    assert.equal(data.status, 'new')
  })

  await check('исполнитель не может писать и удалять историю', async () => {
    const inserted = await ivan.from('task_history').insert({
      task_id: task1.id,
      actor_id: ivanUser.id,
      from_status: 'new',
      to_status: 'in_progress',
    })
    assert.ok(inserted.error, 'ожидалась ошибка INSERT task_history')

    const deleted = await ivan.from('task_history').delete().eq('task_id', task1.id)
    assert.ok(deleted.error, 'ожидалась ошибка DELETE task_history')
  })

  await check('исполнитель не может повысить себе роль', async () => {
    const { error } = await ivan.from('profiles').update({ role: 'manager' }).eq('id', ivanUser.id)
    assert.ok(error, 'ожидалась ошибка UPDATE profiles.role')
  })

  await check('RPC запрещает чужие задачи и недопустимые переходы', async () => {
    const foreign = await ivan.rpc('change_task_status', {
      p_task_id: task2.id,
      p_new_status: 'in_progress',
    })
    assert.ok(foreign.error, 'ожидалась ошибка RPC для чужой задачи')

    const skipped = await ivan.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'accepted',
    })
    assert.ok(skipped.error, 'ожидалась ошибка RPC при переходе new → accepted')
  })

  await check('менеджер не может принять задачу из статуса new', async () => {
    const { error } = await manager.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'accepted',
    })
    assert.ok(error, 'ожидалась ошибка RPC accepted из new')
  })

  await check('исполнитель берёт задачу в работу, история содержит автора', async () => {
    const { error } = await ivan.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'in_progress',
    })
    assert.ifError(error)

    const { data, error: historyError } = await ivan
      .from('task_history')
      .select('id, from_status, to_status, actor:profiles!task_history_actor_id_fkey(full_name)')
      .eq('task_id', task1.id)
      .order('created_at')
    assert.ifError(historyError)
    assert.equal(
      data.some((entry) => entry.actor?.full_name === 'Иван Смирнов'),
      true,
      'в истории нет ФИО исполнителя',
    )
  })

  await check('два одновременных перехода создают одну запись истории', async () => {
    const [first, second] = await Promise.all([
      ivan.rpc('change_task_status', { p_task_id: task1.id, p_new_status: 'on_review' }),
      ivan.rpc('change_task_status', { p_task_id: task1.id, p_new_status: 'on_review' }),
    ])
    assert.equal([first, second].filter((result) => !result.error).length, 1)

    const { data, error } = await ivan
      .from('task_history')
      .select('id')
      .eq('task_id', task1.id)
      .eq('from_status', 'in_progress')
      .eq('to_status', 'on_review')
    assert.ifError(error)
    assert.equal(data.length, 1)
  })

  await check('возврат на доработку требует непустой комментарий', async () => {
    const blank = await manager.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'rework',
      p_comment: '   ',
    })
    assert.ok(blank.error, 'ожидалась ошибка при пустом комментарии')
    assert.match(blank.error.message, /Комментарий обязателен/)

    const returned = await manager.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'rework',
      p_comment: 'Поправьте швы',
    })
    assert.ifError(returned.error)
  })

  await check('полный цикл rework → in_progress → on_review → accepted', async () => {
    const inProgress = await ivan.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'in_progress',
    })
    assert.ifError(inProgress.error)

    const onReview = await ivan.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'on_review',
    })
    assert.ifError(onReview.error)

    const accepted = await manager.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'accepted',
    })
    assert.ifError(accepted.error)

    const afterAccepted = await manager.rpc('change_task_status', {
      p_task_id: task1.id,
      p_new_status: 'rework',
      p_comment: 'Поздний возврат',
    })
    assert.ok(afterAccepted.error, 'ожидалась ошибка перехода из accepted')
  })

  await check('исполнитель 2 не видит историю чужой задачи', async () => {
    const { data, error } = await anna.from('task_history').select('id').eq('task_id', task1.id)
    assert.ifError(error)
    assert.equal(data.length, 0)
  })

  await check('история недоступна для изменения даже менеджеру', async () => {
    const deleted = await manager.from('task_history').delete().eq('task_id', task1.id)
    assert.ok(deleted.error, 'ожидалась ошибка DELETE task_history')

    const updated = await manager
      .from('task_history')
      .update({ comment: 'подмена' })
      .eq('task_id', task1.id)
    assert.ok(updated.error, 'ожидалась ошибка UPDATE task_history')
  })

  await check('мягкое удаление скрывает объект и его задачи', async () => {
    const deleted1 = await manager.from('objects').update({ is_deleted: true }).eq('id', object1.id)
    assert.ifError(deleted1.error)
    const { data: hiddenTask, error: taskError } = await ivan
      .from('tasks')
      .select('id')
      .eq('id', task1.id)
    assert.ifError(taskError)
    assert.equal(hiddenTask.length, 0)

    const deleted2 = await manager.from('objects').update({ is_deleted: true }).eq('id', object2.id)
    assert.ifError(deleted2.error)
    const { data: hiddenTask2, error: taskError2 } = await anna
      .from('tasks')
      .select('id')
      .eq('id', task2.id)
    assert.ifError(taskError2)
    assert.equal(hiddenTask2.length, 0)
  })

  await check('исполнитель не может создать задачу', async () => {
    const { error } = await ivan.from('tasks').insert({
      object_id: object2.id,
      title: `Нельзя ${suffix}`,
      assignee_id: annaUser.id,
    })
    assert.ok(error, 'ожидалась ошибка INSERT tasks для исполнителя')
  })

  console.log(`\nВсе проверки пройдены: ${passed}`)
} finally {
  if (object1?.id) {
    await manager.from('objects').update({ is_deleted: true }).eq('id', object1.id)
  }
  if (object2?.id) {
    await manager.from('objects').update({ is_deleted: true }).eq('id', object2.id)
  }
}
