'use client'

import { useSession } from '@clerk/nextjs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

export function useSupabaseClient(): SupabaseClient {
  const { session } = useSession()

  return useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: async (input, init = {}) => {
            const token = await session?.getToken()
            const headers = new Headers(init.headers)
            if (token) {
              headers.set('Authorization', `Bearer ${token}`)
            }
            return fetch(input, { ...init, headers })
          },
        },
      }
    )
  }, [session])
}