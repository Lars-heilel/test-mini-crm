import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { createObject, listObjects, softDeleteObject, updateObject } from '@/api/objects'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ObjectFormModal } from '@/components/ObjectFormModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/auth/useAuth'
import type { ObjectRow, ObjectSummary } from '@/lib/types'

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось загрузить объекты'
}

export function ObjectsPage() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [objects, setObjects] = useState<ObjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ObjectRow | null>(null)
  const [deleting, setDeleting] = useState<ObjectSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let active = true
    listObjects()
      .then((data) => {
        if (!active) return
        setObjects(data)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(messageOf(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshKey])

  function refresh() {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  async function handleSave(values: { name: string; address: string }) {
    if (editing) {
      await updateObject(editing.id, values)
    } else {
      await createObject(values)
    }
    setFormOpen(false)
    setEditing(null)
    refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setError(null)
    try {
      await softDeleteObject(deleting.id)
      setDeleting(null)
      refresh()
    } catch (deleteError) {
      setError(messageOf(deleteError))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Объекты</h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? 'Строительные объекты и количество задач по ним.'
              : 'Объекты, на которые у вас назначены задачи.'}
          </p>
        </div>
        {isManager && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Новый объект
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : objects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Объектов пока нет</CardTitle>
            <CardDescription>
              {isManager
                ? 'Создайте первый объект, чтобы добавлять задачи.'
                : 'Когда постановщик назначит вам задачи, объекты появятся здесь.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {objects.map((object) => (
            <Card key={object.id}>
              <CardHeader>
                <CardTitle>
                  <Link className="hover:underline" to={`/objects/${object.id}`}>
                    {object.name}
                  </Link>
                </CardTitle>
                <CardDescription>{object.address}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Задач: <span className="font-medium text-foreground">{object.task_count}</span>
                </span>
                {isManager && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(object)
                        setFormOpen(true)
                      }}
                    >
                      Редактировать
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleting(object)}>
                      Удалить
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ObjectFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        initial={editing}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Удалить объект?"
        description={
          deleting
            ? `Объект «${deleting.name}» и все его задачи станут недоступны. История сохранится.`
            : ''
        }
        busy={deleteBusy}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
