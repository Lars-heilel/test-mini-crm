import { formatDate, statusLabels } from '@/lib/labels'
import type { TaskHistoryEntry } from '@/lib/types'

export function HistoryTimeline({ entries }: { entries: TaskHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">История пока пуста.</p>
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="border-l-2 border-muted pl-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{entry.actor.full_name}</span>
            <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {entry.from_status ? statusLabels[entry.from_status] : 'Создание'} →{' '}
            <span className="text-foreground">{statusLabels[entry.to_status]}</span>
          </div>
          {entry.comment && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">{entry.comment}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
