import { useEffect, useState } from 'react'
import { getAdminTransactions } from '../services/adminTransactionsService'
import type { AdminTransaction, AdminTransactionFilters, TransactionSort, TransactionSummary } from '../types/transactions'

const emptySummary: TransactionSummary = { transactionCount: 0, printCount: 0, revenueTotal: 0 }

export function useAdminTransactions(filters: AdminTransactionFilters, page: number, sort: TransactionSort) {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    void getAdminTransactions(filters, page, sort).then((result) => {
      if (!active) return
      setTransactions(result.transactions); setCount(result.count); setSummary(result.summary)
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load transactions.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, sort])

  return { transactions, summary, count, loading, error }
}
