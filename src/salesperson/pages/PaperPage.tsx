import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../shared/components/LoadingState'
import { SalesNotice } from '../components/SalesNotice'
import { useSalesDay } from '../hooks/useSalesDay'
import { addPaper, recordFaultyPaper } from '../services/salespersonService'

type FormMode = 'ADD' | 'FAULTY' | null

export function PaperPage() {
  const { user } = useAuth()
  const { context, loading, error, refresh } = useSalesDay()
  const [mode, setMode] = useState<FormMode>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [proof, setProof] = useState<File | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function resetForm() { setMode(null); setQuantity(''); setReason(''); setNotes(''); setProof(undefined) }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(quantity)
    if (!Number.isInteger(amount) || amount <= 0) return setActionError('Enter a whole-paper quantity greater than zero.')
    if (!context?.day || context.day.status !== 'OPEN' || !user) return setActionError('An open business day is required.')
    if (mode === 'FAULTY' && !reason.trim()) return setActionError('Enter a reason for the faulty paper.')
    setSubmitting(true); setActionError(null); setSuccess(null)
    try {
      if (mode === 'ADD') {
        await addPaper(user.id, context.day.id, amount, proof)
        setSuccess(`${amount} paper added.`)
      } else if (mode === 'FAULTY') {
        await recordFaultyPaper({ userId: user.id, businessDayId: context.day.id, quantity: amount, reason, notes, proof })
        setSuccess(`${amount} faulty paper recorded.`)
      }
      resetForm(); await refresh()
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'The paper record could not be saved.')
    } finally { setSubmitting(false) }
  }

  if (loading) return <LoadingState label="Loading paper status" />
  const totals = context?.totals
  const day = context?.day
  const available = day && totals ? day.starting_paper + totals.total_added_paper : 0
  return (
    <div className="space-y-5 pt-3">
      <header><p className="text-xs font-semibold uppercase tracking-widest text-redbooth-600">Inventory</p><h1 className="mt-1 text-2xl font-bold">Paper</h1></header>
      {error && <SalesNotice>{error}</SalesNotice>}
      {success && <SalesNotice tone="success">{success}</SalesNotice>}
      {!day && <SalesNotice tone="warning">Start today's business day to manage paper.</SalesNotice>}
      {day && totals && <dl className="grid grid-cols-2 gap-3">{[
        ['Starting Paper', day.starting_paper], ['Paper Added', totals.total_added_paper], ['Total Available', available], ['Sold Prints', totals.sold_print_count], ['Faulty Paper', totals.total_faulty_paper], ['Expected Remaining', totals.expected_remaining_paper],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>)}</dl>}
      {day?.status === 'OPEN' && !mode && <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setMode('ADD'); setSuccess(null) }} className="min-h-14 rounded-2xl bg-redbooth-600 px-3 font-bold text-white">ADD PAPER</button><button type="button" onClick={() => { setMode('FAULTY'); setSuccess(null) }} className="min-h-14 rounded-2xl border border-orange-300 bg-white px-3 font-bold text-orange-800">RECORD FAULTY</button></div>}
      {mode && <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">{mode === 'ADD' ? 'Add Paper' : 'Record Faulty Paper'}</h2>
        <label className="block text-sm font-medium">Quantity<input inputMode="numeric" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 min-h-13 w-full rounded-xl border px-4 text-xl font-bold" /></label>
        {mode === 'FAULTY' && <><label className="block text-sm font-medium">Reason<input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Jammed or damaged" className="mt-2 min-h-12 w-full rounded-xl border px-3" /></label><label className="block text-sm font-medium">Notes <span className="font-normal text-gray-400">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border p-3" /></label></>}
        <label className="block text-sm font-medium">Verification photo <span className="font-normal text-gray-400">(optional)</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setProof(event.target.files?.[0])} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2" /></label>
        {actionError && <SalesNotice>{actionError}</SalesNotice>}
        <button disabled={submitting} className="min-h-13 w-full rounded-2xl bg-redbooth-600 font-bold text-white disabled:opacity-60">{submitting ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={resetForm} className="min-h-11 w-full text-sm font-semibold text-gray-500">Cancel</button>
      </form>}
    </div>
  )
}
