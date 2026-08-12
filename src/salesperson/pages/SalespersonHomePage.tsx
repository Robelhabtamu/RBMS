import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../shared/components/LoadingState'
import { DayStats } from '../components/DayStats'
import { SalesNotice } from '../components/SalesNotice'
import { useSalesDay } from '../hooks/useSalesDay'
import { startBusinessDay } from '../services/salespersonService'

export function SalespersonHomePage() {
  const { profile } = useAuth()
  const { context, loading, error, refresh } = useSalesDay()
  const [showStart, setShowStart] = useState(false)
  const [boothId, setBoothId] = useState('')
  const [startingPaper, setStartingPaper] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!boothId && context?.assignments[0]) setBoothId(context.assignments[0].boothId)
  }, [boothId, context])

  async function handleStart(event: FormEvent) {
    event.preventDefault()
    const quantity = Number(startingPaper)
    if (!Number.isInteger(quantity) || quantity < 0) return setActionError('Enter a valid starting paper quantity of zero or more.')
    if (!boothId) return setActionError('No active booth assignment is available.')
    if (submitting) return
    setSubmitting(true); setActionError(null); setRecoveryMessage(null)
    try {
      await startBusinessDay(boothId, quantity)
      setShowStart(false)
      setStartingPaper('')
      const refreshed = await refresh()
      if (!refreshed?.day || refreshed.day.status !== 'OPEN') {
        setActionError('The day was started, but the open day could not be reloaded. Please try refreshing once.')
      }
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'The day could not be started.'
      if (message === "Today's business day is already open.") {
        setShowStart(false)
        setStartingPaper('')
        setRecoveryMessage(message)
        const refreshed = await refresh()
        if (!refreshed?.day || refreshed.day.status !== 'OPEN') {
          setActionError('The existing open day could not be loaded. Please refresh and try again.')
        }
      } else {
        setActionError(message)
      }
    } finally { setSubmitting(false) }
  }

  if (loading) return <LoadingState label="Loading today's booth" />
  if (error) return <div className="pt-4"><SalesNotice>{error}</SalesNotice></div>

  const day = context?.day
  const assignment = context?.assignments.find((item) => item.boothId === day?.booth_id) ?? context?.assignments[0]

  return (
    <div className="space-y-6 pt-3">
      <header>
        <p className="text-sm text-gray-500">Good day</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-black">{profile?.full_name}</h1>
        {assignment && <p className="mt-2 text-sm text-gray-600"><span className="font-semibold text-gray-900">{assignment.boothName}</span> · {assignment.locationName}</p>}
      </header>

      {!assignment && <SalesNotice tone="warning">No active booth assignment was found. Ask an Admin to assign you before starting a day.</SalesNotice>}
      {recoveryMessage && <SalesNotice tone="success">{recoveryMessage}</SalesNotice>}
      {actionError && !showStart && <SalesNotice>{actionError}</SalesNotice>}

      {!day && assignment && !showStart && (
        <section className="rounded-3xl border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-redbooth-50 text-xl text-redbooth-600">●</div>
          <h2 className="mt-4 text-xl font-bold">Start Today's Day</h2>
          <p className="mt-2 text-sm text-gray-500">Enter the paper on hand before making the first sale.</p>
          <button type="button" onClick={() => setShowStart(true)} className="rb-primary mt-6 min-h-13 w-full rounded-2xl px-5 py-3 font-bold">START DAY</button>
        </section>
      )}

      {!day && showStart && (
        <form onSubmit={handleStart} className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Starting paper</h2>
          {context && context.assignments.length > 1 && <label className="mt-5 block text-sm font-medium">Assigned booth<select value={boothId} onChange={(event) => setBoothId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3">{context.assignments.map((item) => <option key={item.boothId} value={item.boothId}>{item.boothName} — {item.locationName}</option>)}</select></label>}
          <label className="mt-5 block text-sm font-medium">Paper quantity<input inputMode="numeric" min="0" step="1" required value={startingPaper} onChange={(event) => setStartingPaper(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border px-4 text-2xl font-bold outline-none focus:border-redbooth-500" /></label>
          {actionError && <div className="mt-4"><SalesNotice>{actionError}</SalesNotice></div>}
          <button disabled={submitting} className="rb-primary mt-5 min-h-13 w-full rounded-2xl px-5 py-3 font-bold disabled:opacity-60">{submitting ? 'Starting...' : 'Confirm & Start'}</button>
          <button type="button" onClick={() => setShowStart(false)} className="mt-2 min-h-12 w-full text-sm font-semibold text-gray-500">Cancel</button>
        </form>
      )}

      {day && context?.totals && (
        <>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${day.status === 'OPEN' ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>Today's day: {day.status.replaceAll('_', ' ')}</div>
          <DayStats day={day} totals={context.totals} />
          {day.status === 'OPEN' && <Link to="/sales/new-sale" className="rb-primary flex min-h-16 items-center justify-center rounded-2xl px-5 text-lg font-bold">+ New Sale</Link>}
          <div className="grid grid-cols-3 gap-3">
            <Link to="/sales/paper" className="rounded-2xl border bg-white p-4 text-center text-sm font-semibold shadow-sm">Paper</Link>
            <Link to="/sales/transactions" className="rounded-2xl border bg-white p-4 text-center text-sm font-semibold shadow-sm">Transactions</Link>
            <Link to="/sales/close-day" className={`rounded-2xl border bg-white p-4 text-center text-sm font-semibold shadow-sm ${day.status !== 'OPEN' ? 'pointer-events-none opacity-50' : ''}`}>Close Day</Link>
          </div>
        </>
      )}
    </div>
  )
}
