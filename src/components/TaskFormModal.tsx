import { useEffect, useState, type FormEvent } from 'react'
import { listObjects } from '@/api/objects'
import { listExecutors } from '@/api/profiles'
import type { TaskInput } from '@/api/tasks'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ObjectSummary, Profile, TaskWithRelations } from '@/lib/types'

interface TaskFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskWithRelations | null
  objectId?: string
  objectName?: string
  onSubmit: (input: TaskInput) => Promise<void>
}

function TaskForm({
  task,
  objectId,
  objectName,
  onSubmit,
  onCancel,
}: {
  task: TaskWithRelations | null
  objectId?: string
  objectName?: string
  onSubmit: (input: TaskInput) => Promise<void>
  onCancel: () => void
}) {
  const isEdit = Boolean(task)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
  const [selectedObjectId, setSelectedObjectId] = useState(
    task?.object_id ?? objectId ?? '',
  )
  const [executors, setExecutors] = useState<Profile[]>([])
  const [objects, setObjects] = useState<ObjectSummary[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([listExecutors(), isEdit ? listObjects() : Promise.resolve([])])
      .then(([loadedExecutors, loadedObjects]) => {
        if (!active) return
        setExecutors(loadedExecutors)
        setObjects(loadedObjects)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setOptionsError(
            loadError instanceof Error ? loadError.message : 'Не удалось загрузить список',
          )
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [isEdit])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Введите название задачи.')
      return
    }
    if (!assigneeId) {
      setError('Выберите исполнителя.')
      return
    }
    if (!selectedObjectId) {
      setError('Выберите объект.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        object_id: selectedObjectId,
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить задачу')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="task-title">Название</Label>
          <Input
            id="task-title"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-description">Описание</Label>
          <Textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Исполнитель</Label>
          <Select
            value={assigneeId || undefined}
            onValueChange={setAssigneeId}
            disabled={optionsLoading || submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите исполнителя" />
            </SelectTrigger>
            <SelectContent>
              {executors.map((executor) => (
                <SelectItem key={executor.id} value={executor.id}>
                  {executor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Объект</Label>
          {isEdit ? (
            <Select
              value={selectedObjectId || undefined}
              onValueChange={setSelectedObjectId}
              disabled={optionsLoading || submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите объект" />
              </SelectTrigger>
              <SelectContent>
                {objects.map((object) => (
                  <SelectItem key={object.id} value={object.id}>
                    {object.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={objectName ?? 'Текущий объект'} disabled readOnly />
          )}
        </div>

        {optionsError && (
          <Alert variant="destructive">
            <AlertDescription>{optionsError}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" disabled={submitting || optionsLoading}>
          {submitting ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function TaskFormModal({
  open,
  onOpenChange,
  task,
  objectId,
  objectName,
  onSubmit,
}: TaskFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
          <DialogDescription>
            Назначьте исполнителя и опишите, что нужно сделать.
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          key={task?.id ?? `new-${objectId ?? ''}`}
          task={task}
          objectId={objectId}
          objectName={objectName}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
