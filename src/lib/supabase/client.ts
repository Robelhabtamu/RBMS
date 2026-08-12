import { createClient } from '@supabase/supabase-js'
import { getPublicEnv } from '../env'

let client: ReturnType<typeof createClient> | undefined

export function getSupabaseClient() {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv()
    client = createClient(supabaseUrl, supabaseAnonKey)
  }

  return client
}
