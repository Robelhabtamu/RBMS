import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../shared/components/LoadingState'
import { QuantityControl } from '../components/QuantityControl'
import { PaymentProofPicker } from '../components/PaymentProofPicker'
import { SalesNotice } from '../components/SalesNotice'
import { useSalesDay } from '../hooks/useSalesDay'
import { attachTransactionProof, createSale, getCurrentPrintPrice, getPaymentMethods } from '../services/salespersonService'
import type { PaymentMethod, SaleTransaction, TransactionType } from '../types'
import { formatEtb, formatTime } from '../utils/format'

export function NewSalePage() {
  const { user } = useAuth()
  const { context, loading, error } = useSalesDay()
  const [quantity, setQuantity] = useState(1)
  const [type, setType] = useState<TransactionType>('STANDARD')
  const [method, setMethod] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [price, setPrice] = useState<number | null>(null)
  const [proof, setProof] = useState<File | undefined>()
  const [transaction, setTransaction] = useState<SaleTransaction | null>(null)
  const [verified, setVerified] = useState(false)
  const [pendingStoragePath, setPendingStoragePath] = useState<string | undefined>()
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const lock = useRef(false)
  const selectedMethod = methods.find((item) => item.code === method)
  const proofRequired = Boolean(selectedMethod?.requires_proof)

  useEffect(() => {
    void Promise.all([getCurrentPrintPrice(), getPaymentMethods()]).then(([nextPrice, nextMethods]) => {
      setPrice(nextPrice); setMethods(nextMethods); setMethod((current) => current || nextMethods[0]?.code || '')
    }).catch((loadError) => setPageError(loadError instanceof Error ? loadError.message : 'Sale options could not be loaded.'))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !context?.day || !user) return
    if (context.day.status !== 'OPEN') return setPageError('No open business day is available.')
    if (proofRequired && !proof) return setPageError(`Payment verification proof is required for ${selectedMethod?.display_name ?? method}.`)
    lock.current = true; setSubmitting(true); setPageError(null)
    try {
      const saved = await createSale({ businessDayId: context.day.id, transactionType: type, quantity, paymentMethod: method })
      setTransaction({ ...saved, payment_requires_proof: proofRequired })
      if (proofRequired && proof) {
        const result = await attachTransactionProof(saved.id, user.id, proof)
        setVerified(result.verified); setPendingStoragePath(result.pendingStoragePath)
        if (result.error) setPageError(result.error)
      } else setVerified(true)
    } catch (saleError) {
      setPageError(saleError instanceof Error ? saleError.message : 'The transaction could not be saved.')
    } finally { setSubmitting(false); lock.current = false }
  }

  async function retryProof() {
    if (!transaction || !user || (!proof && !pendingStoragePath) || submitting) return
    setSubmitting(true); setPageError(null)
    const result = await attachTransactionProof(transaction.id, user.id, proof, pendingStoragePath)
    setVerified(result.verified); setPendingStoragePath(result.pendingStoragePath)
    if (result.error) setPageError(result.error)
    setSubmitting(false)
  }

  if (loading) return <LoadingState label="Preparing sale" />
  if (error) return <SalesNotice>{error}</SalesNotice>
  if (!context?.day || context.day.status !== 'OPEN') return <div className="space-y-4 pt-4"><SalesNotice tone="warning">Start a business day before recording a sale.</SalesNotice><Link to="/sales" className="block text-center font-semibold text-redbooth-600">Return home</Link></div>

  if (transaction) return (
    <div className="space-y-5 pt-5">
      <div className={`rounded-3xl border p-6 text-center ${pageError ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-white text-2xl">{pageError ? '!' : '✓'}</div>
        <h1 className="mt-4 text-2xl font-bold">Sale Completed</h1>
        <p className="mt-1 text-sm text-gray-600">{transaction.transaction_number}</p>
      </div>
      <dl className="divide-y rounded-2xl border bg-white px-5 shadow-sm">
        {[['Print quantity', transaction.quantity], ['Amount', formatEtb(transaction.total_amount)], ['Payment', transaction.payment_method], ['Time', formatTime(transaction.created_at)], ['Verification', transaction.payment_requires_proof ? (verified ? 'Verified' : 'Needs attention') : 'Not required']].map(([label, value]) => <div key={label} className="flex justify-between py-3 text-sm"><dt className="text-gray-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
      </dl>
      {pageError && <><SalesNotice tone="warning">{pageError}</SalesNotice><button type="button" disabled={submitting} onClick={() => void retryProof()} className="min-h-12 w-full rounded-xl border border-orange-300 bg-white font-semibold text-orange-800 disabled:opacity-60">{submitting ? 'Retrying...' : 'RETRY UPLOAD'}</button></>}
      <Link to="/sales/new-sale" onClick={() => { setTransaction(null); setVerified(false); setPageError(null); setProof(undefined); setPendingStoragePath(undefined); setQuantity(1) }} className="flex min-h-13 items-center justify-center rounded-2xl bg-redbooth-600 font-bold text-white">New Sale</Link>
      <Link to="/sales/transactions" className="block text-center text-sm font-semibold text-gray-600">View Today's Transactions</Link>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-3">
      <header><p className="text-xs font-semibold uppercase tracking-widest text-redbooth-600">Point of sale</p><h1 className="mt-1 text-2xl font-bold">New Sale</h1></header>
      <section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="mb-6 text-center text-sm font-medium text-gray-500">Number of Prints</p><QuantityControl value={quantity} onChange={setQuantity} /><div className="mt-7 rounded-2xl bg-gray-50 p-4 text-center"><p className="text-sm text-gray-500">Current price: {price === null ? 'Loading...' : formatEtb(price)}</p><p className="mt-1 text-xl font-bold">Estimated total: {price === null ? '—' : formatEtb(price * quantity)}</p></div></section>
      <fieldset><legend className="mb-2 text-sm font-semibold">Transaction type</legend><div className="grid grid-cols-2 gap-3">{(['STANDARD', 'REPRINT'] as const).map((item) => <label key={item} className={`flex min-h-12 items-center justify-center rounded-xl border font-semibold ${type === item ? 'border-redbooth-500 bg-redbooth-50 text-redbooth-700' : 'bg-white'}`}><input type="radio" className="sr-only" checked={type === item} onChange={() => setType(item)} />{item === 'STANDARD' ? 'Standard' : 'Reprint'}</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">Payment method</legend><div className="grid grid-cols-3 gap-2">{methods.map((item) => <label key={item.code} className={`flex min-h-12 items-center justify-center rounded-xl border px-2 text-sm font-semibold ${method === item.code ? 'border-redbooth-500 bg-redbooth-50 text-redbooth-700' : 'bg-white'}`}><input type="radio" className="sr-only" checked={method === item.code} onChange={() => { setMethod(item.code); setProof(undefined); setPageError(null) }} />{item.display_name}</label>)}</div></fieldset>
      {proofRequired
        ? <PaymentProofPicker file={proof} onChange={setProof} onError={setPageError} />
        : method && <div className="rounded-2xl border bg-gray-50 p-4 text-sm font-medium text-gray-600">No payment proof required for {selectedMethod?.display_name ?? method}.</div>}
      {pageError && <SalesNotice>{pageError}</SalesNotice>}
      <button disabled={submitting || price === null || !method} className="min-h-14 w-full rounded-2xl bg-redbooth-600 px-5 text-lg font-bold text-white disabled:opacity-60">{submitting ? 'Saving Sale...' : 'Confirm Sale'}</button>
    </form>
  )
}
