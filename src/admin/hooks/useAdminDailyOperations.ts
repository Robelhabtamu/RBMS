import { useEffect, useState } from 'react'
import { getDailyOperationDetail, getDailyOperations } from '../services/adminDailyOperationsService'
import type { DailyOperationDetail, DailyOperationListItem, DailyOperationsFilters, DailyOperationsOptions } from '../types/dailyOperations'

const emptyOptions: DailyOperationsOptions = { locations: [], booths: [], salespersons: [] }

export function useAdminDailyOperations(filters: DailyOperationsFilters) {
  const [items, setItems] = useState<DailyOperationListItem[]>([])
  const [options, setOptions] = useState(emptyOptions)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { let active = true; setLoading(true); setError(null); void getDailyOperations(filters).then((result) => { if (active) { setItems(result.items); setOptions(result.options) } }).catch(() => { if (active) setError('Unable to load daily operations.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [filters])
  return { items, options, loading, error }
}

export function useAdminDailyOperationDetail(id: string | undefined) {
  const [detail, setDetail] = useState<DailyOperationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!id) return; let active = true; setLoading(true); void getDailyOperationDetail(id).then((result) => { if (active) setDetail(result) }).catch(() => { if (active) setError('Unable to load daily operation.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [id])
  return { detail, loading, error }
}
