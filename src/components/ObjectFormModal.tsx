import { useState, type FormEvent } from 'react'
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
import type { ObjectRow } from '@/lib/types'

interface ObjectFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: ObjectRow | null
  onSubmit: (values: { name: string; address: string }) => Promise<void>
}

function ObjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: ObjectRow | null
  onSubmit: (values: { name: string; address: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !address.trim()) {
      setError('Заполните название и адрес.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), address: address.trim() })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить объект')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="object-name">Название</Label>
          <Input
            id="object-name"
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="object-address">Адрес</Label>
          <Input
            id="object-address"
            required
            maxLength={300}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
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
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ObjectFormModal({ open, onOpenChange, initial, onSubmit }: ObjectFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Редактировать объект' : 'Новый объект'}</DialogTitle>
          <DialogDescription>
            Укажите название и адрес строительного объекта.
          </DialogDescription>
        </DialogHeader>
        <ObjectForm
          key={initial?.id ?? 'new'}
          initial={initial}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
