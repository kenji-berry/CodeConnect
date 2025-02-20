import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { Session } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session)
      setLoading(false)
      if (error) setError(error.message)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const refreshToken = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error
      setSession(session)
      return session
    } catch (error) {
      setError(error.message)
      return null
    }
  }

  return {
    session,
    loading,
    error,
    refreshToken
  }
}