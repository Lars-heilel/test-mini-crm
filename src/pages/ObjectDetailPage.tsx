import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getObject, softDeleteObject, updateObject } from '@/api/objects'
import { createTask, listTasksForObject, type TaskInput } from '@/api/tasks'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ObjectFormModal } from '@/components/ObjectFormModal'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskFormModal } from '@/components/TaskFormModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate } from '@/lib/labels'
import type { ObjectRow, TaskWithRelations } from '@/lib/types'

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось загрузить объект'
}

export function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [object, setObject] = useState<ObjectRow | null>(null)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [objectFormOpen, setObjectFormOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true

    Promise.all([getObject(id), listTasksForObject(id)])
      .then(([loadedObject, loadedTasks]) => {
        if (!active) return
        setObject(loadedObject)
        setTasks(loadedTasks)
        setNotFound(false)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setObject(null)
        setNotFound(true)
        setError(messageOf(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, refreshKey])

  function refresh() {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  async function handleUpdateObject(values: { name: string; address: string }) {
    if (!object) return
    await updateObject(object.id, values)
    setObjectFormOpen(false)
    refresh()
  }

  async function handleDeleteObject() {
    if (!object) return
    setDeleteBusy(true)
    try {
      await softDeleteObject(object.id)
      setDeleteOpen(false)
      navigate('/objects')
    } catch (deleteError) {
      setError(messageOf(deleteError))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleCreateTask(input: TaskInput) {
    await createTask(input)
    setTaskFormOpen(false)
    refresh()
  }

  if (!id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Объект не найден или недоступен</CardTitle>
          <CardDescription>Возможно, объект удалён или у вас нет к нему доступа.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/objects">К списку объектов</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Загрузка…</div>
  }

  if (notFound || !object) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Объект не найден или недоступен</CardTitle>
          <CardDescription>Возможно, объект удалён или у вас нет к нему доступа.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/objects">К списку объектов</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/objects">← К объектам</Link>
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{object.name}</CardTitle>
              <CardDescription>{object.address}</CardDescription>
            </div>
            {isManager && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setObjectFormOpen(true)}>
                  Редактировать объект
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  Удалить объект
                </Button>
                <Button size="sm" onClick={() => setTaskFormOpen(true)}>
                  Новая задача
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Задачи</h2>
        <span className="text-sm text-muted-foreground">Всего: {tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Задач пока нет</CardTitle>
            <CardDescription>
              {isManager
                ? 'Создайте первую задачу и назначьте исполнителя.'
                : 'Постановщик ещё не назначил вам задачи по этому объекту.'}
            </CardDescription>
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
                    {task.assignee.full_name} · создана {formatDate(task.created_at)}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ObjectFormModal
        open={objectFormOpen}
        onOpenChange={setObjectFormOpen}
        initial={object}
        onSubmit={handleUpdateObject}
      />

      <TaskFormModal
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={null}
        objectId={object.id}
        objectName={object.name}
        onSubmit={handleCreateTask}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Удалить объект?"
        description={`Объект «${object.name}» и все его задачи станут недоступны. История сохранится.`}
        busy={deleteBusy}
        onConfirm={() => void handleDeleteObject()}
      />
    </div>
  )
}
