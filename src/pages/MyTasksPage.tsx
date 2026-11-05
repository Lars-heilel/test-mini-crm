import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { listMyTasks } from '@/api/tasks'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/labels'
import type { TaskWithRelations } from '@/lib/types'

export function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let active = true

    listMyTasks(profile.id)
      .then((data) => {
        if (!active) return
        setTasks(data)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить задачи')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [profile])

  if (profile?.role === 'manager') {
    return <Navigate to="/objects" replace />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Мои задачи</h1>
        <p className="text-sm text-muted-foreground">
          Задачи, которые назначены лично вам.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>У вас пока нет задач</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link className="font-medium hover:underline" to={`/tasks/${task.id}`}>
                    {task.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {task.object.name} · создана {formatDate(task.created_at)}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
