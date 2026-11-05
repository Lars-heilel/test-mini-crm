import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  changeTaskStatus,
  getTask,
  getTaskHistory,
  softDeleteTask,
  updateTask,
  type TaskInput,
} from '@/api/tasks'
import { useAuth } from '@/auth/useAuth'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HistoryTimeline } from '@/components/HistoryTimeline'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/labels'
import { availableActions, type TaskAction } from '@/lib/task-actions'
import type { TaskHistoryEntry, TaskWithRelations } from '@/lib/types'

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [history, setHistory] = useState<TaskHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [commentAction, setCommentAction] = useState<TaskAction | null>(null)
  const [comment, setComment] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true

    Promise.all([getTask(id), getTaskHistory(id)])
      .then(([loadedTask, loadedHistory]) => {
        if (!active) return
        setTask(loadedTask)
        setHistory(loadedHistory)
        setNotFound(false)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setTask(null)
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

  async function runAction(action: TaskAction, value?: string) {
    if (!task) return
    setActionBusy(true)
    setActionError(null)
    try {
      await changeTaskStatus(task.id, action.to, value)
      setCommentAction(null)
      setComment('')
      refresh()
    } catch (actionFailure) {
      setActionError(messageOf(actionFailure))
    } finally {
      setActionBusy(false)
    }
  }

  function handleAction(action: TaskAction) {
    setActionError(null)
    if (action.requiresComment) {
      setComment('')
      setCommentAction(action)
    } else {
      void runAction(action)
    }
  }

  async function handleUpdateTask(input: TaskInput) {
    if (!task) return
    await updateTask(task.id, input)
    setEditOpen(false)
    refresh()
  }

  async function handleDeleteTask() {
    if (!task) return
    const objectId = task.object_id
    setDeleteBusy(true)
    try {
      await softDeleteTask(task.id)
      setDeleteOpen(false)
      navigate(`/objects/${objectId}`)
    } catch (deleteError) {
      setError(messageOf(deleteError))
    } finally {
      setDeleteBusy(false)
    }
  }

  if (!id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Задача не найдена или недоступна</CardTitle>
          <CardDescription>Возможно, задача удалена или назначена другому исполнителю.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/objects">К объектам</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Загрузка…</div>
  }

  if (notFound || !task) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Задача не найдена или недоступна</CardTitle>
          <CardDescription>Возможно, задача удалена или назначена другому исполнителю.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/objects">К объектам</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const actions = profile ? availableActions(profile.role, task.status) : []

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={`/objects/${task.object_id}`}>← К объекту</Link>
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
              <CardTitle className="text-xl">{task.title}</CardTitle>
              <CardDescription>
                Объект:{' '}
                <Link className="underline underline-offset-2" to={`/objects/${task.object_id}`}>
                  {task.object.name}
                </Link>
              </CardDescription>
            </div>
            <StatusBadge status={task.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Исполнитель: </span>
              {task.assignee.full_name}
            </div>
            <div>
              <span className="text-muted-foreground">Автор: </span>
              {task.author.full_name}
            </div>
            <div>
              <span className="text-muted-foreground">Создана: </span>
              {formatDate(task.created_at)}
            </div>
          </div>

          <div>
            <h2 className="mb-1 text-sm font-medium">Описание</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {task.description || 'Без описания'}
            </p>
          </div>

          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {(actions.length > 0 || isManager) && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.to}
                  variant={action.variant === 'primary' ? 'default' : 'secondary'}
                  disabled={actionBusy}
                  onClick={() => handleAction(action)}
                >
                  {action.label}
                </Button>
              ))}
              {isManager && (
                <>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    Редактировать
                  </Button>
                  <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                    Удалить
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryTimeline entries={history} />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(commentAction)}
        onOpenChange={(open) => {
          if (!open && !actionBusy) {
            setCommentAction(null)
            setComment('')
            setActionError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{commentAction?.label}</DialogTitle>
            <DialogDescription>
              Комментарий обязателен: исполнитель увидит его в истории задачи.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rework-comment">Комментарий</Label>
            <Textarea
              id="rework-comment"
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={actionBusy}
              onClick={() => {
                setCommentAction(null)
                setComment('')
                setActionError(null)
              }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!comment.trim() || actionBusy}
              onClick={() => {
                if (commentAction) void runAction(commentAction, comment)
              }}
            >
              {actionBusy ? 'Отправка…' : 'Подтвердить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onSubmit={handleUpdateTask}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Удалить задачу?"
        description={`Задача «${task.title}» станет недоступна. История сохранится.`}
        busy={deleteBusy}
        onConfirm={() => void handleDeleteTask()}
      />
    </div>
  )
}
