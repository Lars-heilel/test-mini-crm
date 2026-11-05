import { supabase } from '@/lib/supabase'
import type { ObjectRow, ObjectSummary, TaskStatus } from '@/lib/types'

type ObjectListRow = ObjectRow & {
  tasks: { id: string; status: TaskStatus; is_deleted: boolean }[]
}

function fail(error: { message: string }): never {
  throw new Error(error.message)
}

export async function listObjects(): Promise<ObjectSummary[]> {
  const { data, error } = await supabase
    .from('objects')
    .select('id,name,address,created_at,is_deleted,tasks(id,status,is_deleted)')
    .order('created_at', { ascending: true })

  if (error) fail(error)

  return ((data ?? []) as ObjectListRow[]).map(({ tasks, ...object }) => ({
    ...object,
    task_count: (tasks ?? []).filter((task) => !task.is_deleted).length,
  }))
}

export async function getObject(id: string): Promise<ObjectRow> {
  const { data, error } = await supabase
    .from('objects')
    .select('id,name,address,created_at,is_deleted')
    .eq('id', id)
    .single()

  if (error) fail(error)
  return data as ObjectRow
}

export async function createObject(values: {
  name: string
  address: string
}): Promise<ObjectRow> {
  const { data, error } = await supabase
    .from('objects')
    .insert({ name: values.name, address: values.address })
    .select('id,name,address,created_at,is_deleted')
    .single()

  if (error) fail(error)
  return data as ObjectRow
}

export async function updateObject(
  id: string,
  values: { name: string; address: string },
): Promise<void> {
  const { error } = await supabase
    .from('objects')
    .update({ name: values.name, address: values.address })
    .eq('id', id)

  if (error) fail(error)
}

export async function softDeleteObject(id: string): Promise<void> {
  const { error } = await supabase.from('objects').update({ is_deleted: true }).eq('id', id)

  if (error) fail(error)
}
