import { useEffect, useState } from 'react'
import { getAdminTransactionDetail } from '../services/adminTransactionsService'
import type { AdminTransaction, TransactionDetail } from '../types/transactions'
import { formatAdminEtb } from '../utils/format'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function TransactionDetailDrawer({ transaction, onClose }: { transaction: AdminTransaction; onClose: () => void }) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getAdminTransactionDetail(transaction).then((result) => { if (active) setDetail(result) }).catch(() => {
      if (active) setError('Some transaction details could not be loaded.')
    })
    return () => { active = false }
  }, [transaction])

  const needsProof = transaction.payment_requires_proof
  return <div className="fixed inset-0 z-40 bg-gray-950/35" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-gray-50 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><p className="text-[10px] font-bold tracking-[.18em] text-redbooth-600">TRANSACTION INFORMATION</p><h2 id="transaction-detail-title" className="mt-1 text-xl font-bold">{transaction.transaction_number}</h2></div><button type="button" onClick={onClose} aria-label="Close transaction details" className="grid size-10 place-items-center rounded-full hover:bg-gray-100">✕</button></div>
      <div className="space-y-5 p-5">
        {error && <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">{error}</div>}
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border bg-white p-5 shadow-sm">{[
          ['Transaction ID', transaction.transaction_number], ['Date / Time', formatDateTime(transaction.created_at)], ['Location', transaction.location_name], ['Booth', transaction.booth_name], ['Salesperson', transaction.salesperson_name], ['Type', transaction.transaction_type === 'STANDARD' ? 'Standard' : 'Reprint'], ['Print Quantity', transaction.quantity], ['Price Per Print', formatAdminEtb(transaction.price_per_print)], ['Total Amount', formatAdminEtb(transaction.total_amount)], ['Payment Method', transaction.payment_method], ['Status', transaction.status],
        ].map(([label, value]) => <div key={label} className={label === 'Transaction ID' || label === 'Date / Time' ? 'col-span-2' : ''}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">Verification Proof</h3>
          {!needsProof && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Verification proof is not required for this payment method.</p>}
          {needsProof && !transaction.proof_id && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-800">Verification proof missing.</p>}
          {needsProof && transaction.proof_id && !detail && !error && <div className="mt-3 h-48 animate-pulse rounded-xl bg-gray-200" />}
          {detail?.proofSignedUrl && <div className="mt-4"><a href={detail.proofSignedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-gray-100"><img src={detail.proofSignedUrl} alt={`Verification proof for ${transaction.transaction_number}`} className="h-64 w-full object-contain" /></a><a href={detail.proofSignedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold">Open image</a><p className="mt-2 text-xs text-gray-400">Private signed access expires after five minutes.</p></div>}
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">History</h3>{!detail && !error ? <p className="mt-3 text-sm text-gray-500">Loading history...</p> : detail?.audit.length ? <ol className="mt-4 space-y-4">{detail.audit.map((entry) => <li key={entry.id} className="border-l-2 border-gray-200 pl-4"><p className="text-sm font-semibold capitalize">{entry.action.toLowerCase()}</p><p className="mt-1 text-xs text-gray-500">{entry.actorName} · {formatDateTime(entry.createdAt)}</p>{entry.reason && <p className="mt-1 text-sm text-gray-600">{entry.reason}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-gray-500">No sensitive changes recorded.</p>}</section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">Admin Actions</h3><p className="mt-2 text-sm text-gray-500">Trusted cancellation and correction RPCs are not available yet.</p><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" disabled className="min-h-11 rounded-xl border px-3 text-sm font-semibold opacity-50">Cancel Transaction</button><button type="button" disabled className="min-h-11 rounded-xl border px-3 text-sm font-semibold opacity-50">Correct Transaction</button></div></section>
      </div>
    </aside>
  </div>
}
