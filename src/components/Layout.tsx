import { Link, NavLink, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { roleLabels } from '@/lib/labels'
import { useAuth } from '@/auth/useAuth'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'text-sm font-medium text-foreground'
    : 'text-sm text-muted-foreground transition-colors hover:text-foreground'
}

export function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="font-semibold">
            Мини-CRM
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/objects" className={navClass}>
              Объекты
            </NavLink>
            {profile?.role === 'manager' && (
              <NavLink to="/tasks" className={navClass}>
                Задачи
              </NavLink>
            )}
            {profile?.role === 'assignee' && (
              <NavLink to="/my-tasks" className={navClass}>
                Мои задачи
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium">{profile?.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {profile ? roleLabels[profile.role] : ''}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
