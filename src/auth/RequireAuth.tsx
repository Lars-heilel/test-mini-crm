import { Navigate, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { session, profile, loading, error, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Нет доступа</CardTitle>
            <CardDescription>{error ?? 'Профиль пользователя не найден.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void signOut()}>
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
