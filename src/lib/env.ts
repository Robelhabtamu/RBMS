type PublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Copy .env.example to .env.local and add your project values.',
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    throw new Error('VITE_SUPABASE_URL is not a valid URL. Check .env.local and restart the development server.')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('VITE_SUPABASE_URL must use HTTP or HTTPS.')
  }

  if (!supabaseAnonKey.startsWith('sb_publishable_') && !supabaseAnonKey.startsWith('eyJ')) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not a recognized Supabase publishable or legacy anon key.')
  }

  return { supabaseUrl, supabaseAnonKey }
}
