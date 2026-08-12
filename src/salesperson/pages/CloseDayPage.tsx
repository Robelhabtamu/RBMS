import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { SalesNotice } from '../components/SalesNotice'
import { useSalesDay } from '../hooks/useSalesDay'
import { closeBusinessDay } from '../services/salespersonService'
import type { BusinessDay } from '../types'
import { formatEtb, formatTime } from '../utils/format'

export function CloseDayPage() {
  const { context, loading, error } = useSalesDay()
  const [actual, setActual] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [result, setResult] = useState<BusinessDay | null>(null)

  async function handleClose(event: FormEvent) {
    event.preventDefault()
    const amount = Number(actual)
    if (!Number.isInteger(amount) || amount < 0) return setActionError('Enter a valid remaining paper quantity of zero or more.')
    if (!context?.day || context.day.status !== 'OPEN') return setActionError('No open business day is available.')
    setSubmitting(true); setActionError(null)
    try { setResult(await closeBusinessDay(context.day.id, amount, notes)) }
    catch (closeError) { setActionError(closeError instanceof Error ? closeError.message : 'The business day could not be closed.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <LoadingState label="Preparing day close" />
  if (error) return <SalesNotice>{error}</SalesNotice>
  const day = context?.day
  const totals = context?.totals
  if (!day || !totals) return <div className="pt-4"><SalesNotice tone="warning">No business day exists for today.</SalesNotice></div>

  if (result) {
    const balanced = result.closing_status === 'BALANCED'
    return <div className="space-y-5 pt-5">
      <div className={`rounded-3xl border p-6 text-center ${balanced ? 'border-green-200 bg-green-50 text-green-900' : 'border-orange-200 bg-orange-50 text-orange-900'}`}><div className="mx-auto grid size-14 place-items-center rounded-full bg-white text-2xl">{balanced ? '✓' : '!'}</div><h1 className="mt-4 text-2xl font-bold">{balanced ? 'Day Closed & Balanced' : 'Day Closed With Discrepancy'}</h1></div>
      <dl className="divide-y rounded-2xl border bg-white px-5 shadow-sm">{[
        ['Prints', totals.sold_print_count], ['Revenue', formatEtb(totals.revenue_total)], ['Expected remaining', totals.expected_remaining_paper], ['Actual remaining', result.actual_remaining_paper ?? 0], ['Paper difference', result.paper_difference ?? 0], ['Revenue difference', formatEtb(result.revenue_difference ?? 0)], ['Closed time', result.closed_at ? formatTime(result.closed_at) : '—'],
      ].map(([label, value]) => <div key={label} className="flex justify-between py-3 text-sm"><dt className="text-gray-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
      {!balanced && result.closing_notes && <SalesNotice tone="warning"><span className="font-semibold">Closing notes:</span> {result.closing_notes}</SalesNotice>}
      <Link to="/sales" className="flex min-h-13 items-center justify-center rounded-2xl bg-gray-950 font-bold text-white">Return Home</Link>
    </div>
  }

  if (day.status !== 'OPEN') return <div className="space-y-4 pt-4"><SalesNotice tone="success">Today's business day is already closed.</SalesNotice><Link to="/sales" className="block text-center font-semibold text-redbooth-600">Return home</Link></div>

  return <form onSubmit={handleClose} className="space-y-5 pt-3">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-redbooth-600">Reconciliation</p><h1 className="mt-1 text-2xl font-bold">Close Day</h1><p className="mt-2 text-sm text-gray-500">Review the trusted totals, then count the paper physically remaining.</p></header>
    <dl className="grid grid-cols-2 gap-3">{[
      ['Starting Paper', day.starting_paper], ['Added Paper', totals.total_added_paper], ['Sold Prints', totals.sold_print_count], ['Faulty Paper', totals.total_faulty_paper], ['Expected Remaining', totals.expected_remaining_paper], ['Transactions', totals.total_transactions], ['Revenue', formatEtb(totals.revenue_total)], ['Prints', totals.sold_print_count],
    ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-lg font-bold">{value}</dd></div>)}</dl>
    <section className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm"><label className="block text-sm font-medium">Actual Remaining Paper<input inputMode="numeric" min="0" step="1" required value={actual} onChange={(event) => setActual(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border px-4 text-2xl font-bold" /></label><label className="block text-sm font-medium">Closing notes <span className="font-normal text-gray-400">(optional)</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label></section>
    <SalesNotice tone="warning">The database will calculate and decide the final reconciliation status.</SalesNotice>
    {actionError && <SalesNotice>{actionError}</SalesNotice>}
    <button disabled={submitting} className="min-h-14 w-full rounded-2xl bg-gray-950 text-lg font-bold text-white disabled:opacity-60">{submitting ? 'Closing Day...' : 'Close Day'}</button>
  </form>
}
