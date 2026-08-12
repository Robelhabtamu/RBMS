import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { getSalesDayContext } from '../services/salespersonService'
import type { SalesDayContext } from '../types'

export function useSalesDay() {
  const { user } = useAuth()
  const [context, setContext] = useState<SalesDayContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<SalesDayContext | null> => {
    if (!user) return null
    setLoading(true)
    setError(null)
    try {
      const nextContext = await getSalesDayContext(user.id)
      setContext(nextContext)
      return nextContext
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Sales data could not be loaded.')
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void refresh() }, [refresh])
  return { context, loading, error, refresh }
}
