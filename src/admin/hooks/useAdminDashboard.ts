import { useEffect, useState } from 'react'
import { getAdminDashboard } from '../services/adminDashboardService'
import type { AdminDashboardData, AdminDashboardFilters } from '../types/dashboard'

export function useAdminDashboard(filters: AdminDashboardFilters) {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    void getAdminDashboard(filters).then((result) => { if (active) setData(result) }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'The dashboard could not be loaded.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters.businessDate, filters.locationId])

  return { data, loading, error }
}
