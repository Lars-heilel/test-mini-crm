import { Badge } from '@/components/ui/badge'
import { statusClasses, statusLabels } from '@/lib/labels'
import type { TaskStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={statusClasses[status]}>{statusLabels[status]}</Badge>
}
