import { Session } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  loading: boolean
  error: string | null
}

export interface AuthHook extends AuthState {
  refreshToken: () => Promise<Session | null>
}