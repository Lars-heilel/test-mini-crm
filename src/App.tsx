import { Route, Routes } from 'react-router'
import { HomeRedirect } from '@/auth/HomeRedirect'
import { RequireAuth } from '@/auth/RequireAuth'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { MyTasksPage } from '@/pages/MyTasksPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ObjectDetailPage } from '@/pages/ObjectDetailPage'
import { ObjectsPage } from '@/pages/ObjectsPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { TasksPage } from '@/pages/TasksPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="objects" element={<ObjectsPage />} />
          <Route path="objects/:id" element={<ObjectDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
