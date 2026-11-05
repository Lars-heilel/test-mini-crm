import { supabase } from '@/lib/supabase'
import type { TaskHistoryEntry, TaskStatus, TaskWithRelations } from '@/lib/types'

export interface TaskInput {
  object_id: string
  title: string
  description: string | null
  assignee_id: string
}

const taskSelect =
  '*, object:objects!tasks_object_id_fkey(id,name,address), assignee:profiles!tasks_assignee_id_fkey(id,full_name,role), author:profiles!tasks_author_id_fkey(id,full_name,role)'

export async function listTasksForObject(objectId: string): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(taskSelect)
    .eq('object_id', objectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskWithRelations[]
}

export async function listAllTasks(): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(taskSelect)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskWithRelations[]
}

export async function listMyTasks(profileId: string): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(taskSelect)
    .eq('assignee_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskWithRelations[]
}

export async function getTask(id: string): Promise<TaskWithRelations> {
  const { data, error } = await supabase.from('tasks').select(taskSelect).eq('id', id).single()

  if (error) throw new Error(error.message)
  return data as TaskWithRelations
}

export async function createTask(input: TaskInput): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      object_id: input.object_id,
      title: input.title,
      description: input.description,
      assignee_id: input.assignee_id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      object_id: input.object_id,
      title: input.title,
      description: input.description,
      assignee_id: input.assignee_id,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function softDeleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').update({ is_deleted: true }).eq('id', id)

  if (error) throw new Error(error.message)
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select('*, actor:profiles!task_history_actor_id_fkey(id,full_name,role)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TaskHistoryEntry[]
}

export async function changeTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.rpc('change_task_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment?.trim() || null,
  })

  if (error) throw new Error(error.message)
}
