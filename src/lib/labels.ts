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
