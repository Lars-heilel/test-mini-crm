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
