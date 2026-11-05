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
