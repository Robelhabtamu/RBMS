import { useCallback, useEffect, useState } from 'react'
import { getAdminSettings } from '../services/adminSettingsService'
import type { AdminSettings } from '../types/settings'

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setSettings(await getAdminSettings()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Settings could not be loaded.') } finally { setLoading(false) } }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { settings, loading, error, refresh }
}
