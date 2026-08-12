import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { formatRedBoothTime, getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import { useAdminDailyOperations } from '../hooks/useAdminDailyOperations'
import type { DailyOperationsFilters, OperationStatus } from '../types/dailyOperations'
import { formatAdminEtb } from '../utils/format'

export function AdminDailyOperationsPage() {
  const [params, setParams] = useSearchParams()
  const [businessDate, setBusinessDate] = useState(params.get('date') ?? getRedBoothBusinessDate())
  const [locationId, setLocationId] = useState(params.get('location') ?? '')
  const [boothId, setBoothId] = useState(params.get('booth') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [salespersonId, setSalespersonId] = useState(params.get('salesperson') ?? '')
  const filters = useMemo<DailyOperationsFilters>(() => ({ businessDate, locationId, boothId, status, salespersonId }), [boothId, businessDate, locationId, salespersonId, status])
  const { items, options, loading, error } = useAdminDailyOperations(filters)
  const visibleBooths = locationId ? options.booths.filter((booth) => booth.locationId === locationId) : options.booths

  useEffect(() => { const next: Record<string, string> = { date: businessDate }; if (locationId) next.location = locationId; if (boothId) next.booth = boothId; if (status) next.status = status; if (salespersonId) next.salesperson = salespersonId; setParams(next, { replace: true }) }, [boothId, businessDate, locationId, salespersonId, setParams, status])
  const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium'

  return <div className="mx-auto max-w-7xl">
    <header className="border-b pb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Admin</p><h1 className="mt-2 text-3xl font-bold">Daily Operations</h1><p className="mt-2 text-sm text-gray-500">Review each booth's complete business-day activity.</p></header>
    <section className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5" aria-label="Daily operation filters">
      <label className="text-xs font-semibold text-gray-600">Business Date<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className={fieldClass} /></label>
      <label className="text-xs font-semibold text-gray-600">Location<select value={locationId} onChange={(event) => { setLocationId(event.target.value); setBoothId('') }} className={fieldClass}><option value="">All Locations</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-gray-600">Booth<select value={boothId} onChange={(event) => setBoothId(event.target.value)} className={fieldClass}><option value="">All Booths</option>{visibleBooths.map((booth) => <option key={booth.id} value={booth.id}>{booth.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-gray-600">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}><option value="">All</option>{['OPEN', 'CLOSED', 'CLOSED_WITH_DISCREPANCY', 'PENDING_REVIEW', 'NOT_STARTED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="text-xs font-semibold text-gray-600">Salesperson<select value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)} className={fieldClass}><option value="">All Salespersons</option>{options.salespersons.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {loading ? <LoadingState label="Loading daily operations" /> : error ? <div className="p-10 text-center"><p className="font-semibold text-red-700">Unable to load daily operations.</p></div> : options.booths.length === 0 ? <p className="p-12 text-center text-sm text-gray-500">No active booths found.</p> : items.length === 0 ? <p className="p-12 text-center text-sm text-gray-500">No booth operations match these filters.</p> : <div className="divide-y">{items.map((item) => {
        const content = <div className="grid gap-5 p-5 lg:grid-cols-[minmax(180px,1.2fr)_minmax(150px,.8fr)_repeat(3,minmax(100px,.55fr))_minmax(170px,.8fr)] lg:items-center">
          <div><div className="flex items-center gap-2"><StatusDot status={item.status} /><h2 className="font-bold">{item.boothName}</h2></div><p className="mt-1 text-xs text-gray-500">{item.locationName}</p><p className="mt-2 text-sm text-gray-700">{item.salespersonName ?? 'No salesperson assigned'}</p></div>
          <div><p className="text-xs text-gray-500">Business Day</p><p className="mt-1 text-sm font-bold">{item.status.replaceAll('_', ' ')}</p><p className="mt-2 text-xs text-gray-500">{item.startedAt ? `Started ${formatRedBoothTime(item.startedAt)}` : 'No business day recorded'}</p>{item.closedAt && <p className="text-xs text-gray-500">Closed {formatRedBoothTime(item.closedAt)}</p>}</div>
          <Metric label="Transactions" value={item.transactions} /><Metric label="Prints" value={item.prints} /><Metric label="Revenue" value={formatAdminEtb(item.revenue)} />
          <div className="grid grid-cols-2 gap-3"><Metric label="Paper" value={item.paperStatus} /><Metric label="Money" value={item.revenueStatus} /></div>
        </div>
        return item.businessDayId ? <Link key={item.boothId} to={`/admin/daily-operations/${item.businessDayId}?date=${businessDate}`} className="block hover:bg-gray-50">{content}</Link> : <div key={item.boothId}>{content}</div>
      })}</div>}
    </section>
  </div>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div> }
function StatusDot({ status }: { status: OperationStatus }) { const color = status === 'CLOSED_WITH_DISCREPANCY' ? 'bg-red-500' : status === 'PENDING_REVIEW' ? 'bg-orange-400' : status === 'NOT_STARTED' ? 'bg-gray-300' : 'bg-green-500'; return <span className={`size-2.5 rounded-full ${color}`} /> }
