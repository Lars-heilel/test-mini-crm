import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export async function listExecutors(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role')
    .eq('role', 'assignee')
    .order('full_name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}
