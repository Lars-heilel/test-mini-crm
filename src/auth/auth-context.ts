import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

export interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
