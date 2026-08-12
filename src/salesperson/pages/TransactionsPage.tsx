import { useEffect, useState } from 'react'
import { LoadingState } from '../../shared/components/LoadingState'
import { SalesNotice } from '../components/SalesNotice'
import { useSalesDay } from '../hooks/useSalesDay'
import { getTodayTransactions } from '../services/salespersonService'
import type { SaleTransaction } from '../types'
import { formatEtb, formatTime } from '../utils/format'

export function TransactionsPage() {
  const { context, loading: dayLoading, error: dayError } = useSalesDay()
  const [transactions, setTransactions] = useState<SaleTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!context?.day) return
    setLoading(true)
    void getTodayTransactions(context.day.id).then(setTransactions).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Transactions could not be loaded.')
    }).finally(() => setLoading(false))
  }, [context?.day])

  if (dayLoading || loading) return <LoadingState label="Loading transactions" />
  return (
    <div className="space-y-5 pt-3">
      <header><p className="text-xs font-semibold uppercase tracking-widest text-redbooth-600">Today</p><h1 className="mt-1 text-2xl font-bold">Transactions</h1></header>
      {(dayError || error) && <SalesNotice>{dayError ?? error}</SalesNotice>}
      {!context?.day && <SalesNotice tone="warning">No business day exists for today.</SalesNotice>}
      {context?.day && transactions.length === 0 && !error && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">No transactions yet</div>}
      <div className="space-y-3">
        {transactions.map((transaction) => {
          const needsProof = Boolean(transaction.payment_requires_proof)
          return <article key={transaction.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between"><div><p className="font-bold">{transaction.quantity} {transaction.quantity === 1 ? 'Print' : 'Prints'}</p><p className="mt-1 text-xs text-gray-500">{formatTime(transaction.created_at)} · {transaction.transaction_type === 'STANDARD' ? 'Standard' : 'Reprint'}</p></div><p className="font-bold">{formatEtb(transaction.total_amount)}</p></div>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span className="font-semibold">{transaction.payment_method}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${!needsProof || transaction.verified ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{needsProof ? (transaction.verified ? 'Verified' : 'Proof missing') : 'No proof required'}</span></div>
          </article>
        })}
      </div>
    </div>
  )
}
