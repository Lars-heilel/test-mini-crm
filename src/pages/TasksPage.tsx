import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { listAllTasks, updateTask, type TaskInput } from '@/api/tasks'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskFormModal } from '@/components/TaskFormModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/labels'
import type { TaskWithRelations } from '@/lib/types'

export function TasksPage() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState<TaskWithRelations | null>(null)

  useEffect(() => {
    if (!isManager) return
    let active = true

    listAllTasks()
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
  }, [isManager, refreshKey])

  function refresh() {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  async function handleUpdateTask(input: TaskInput) {
    if (!editing) return
    await updateTask(editing.id, input)
    setEditing(null)
    refresh()
  }

  if (profile?.role === 'assignee') {
    return <Navigate to="/my-tasks" replace />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Задачи</h1>
        <p className="text-sm text-muted-foreground">
          Все активные задачи по всем объектам. Редактировать задачу можно прямо из списка.
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
            <CardTitle>Задач пока нет</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">Всего: {tasks.length}</div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                      to={`/tasks/${task.id}`}
                    >
                      {task.title}
                      <span aria-hidden>→</span>
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {task.object.name} · {task.assignee.full_name} · создана{' '}
                      {formatDate(task.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    <Button variant="outline" size="sm" onClick={() => setEditing(task)}>
                      Редактировать
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <TaskFormModal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        task={editing}
        onSubmit={handleUpdateTask}
      />
    </div>
  )
}
