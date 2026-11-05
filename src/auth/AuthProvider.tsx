import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        setError('Не удалось проверить сессию. Попробуйте войти снова.')
        setLoading(false)
        return
      }
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        setLoading(true)
        setError(null)
      } else {
        setProfile(null)
        setError(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    let active = true

    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
      .then(({ data, error: profileError }) => {
        if (!active) return
        if (profileError) {
          setProfile(null)
          setError('Профиль не найден. Обратитесь к администратору.')
        } else {
          setProfile(data as Profile)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setLoading(false)
      throw new Error('Неверный email или пароль')
    }
    setSession(data.session)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setError(null)
    setLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, error, signIn, signOut }),
    [session, profile, loading, error, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
