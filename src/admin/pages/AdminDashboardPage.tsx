import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '../../shared/components/ErrorState'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import { formatAdminEtb } from '../utils/format'

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 rounded-2xl bg-gray-200" />)}</div><div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]"><div className="h-80 rounded-2xl bg-gray-200" /><div className="h-80 rounded-2xl bg-gray-200" /></div></div>
}

export function AdminDashboardPage() {
  const [businessDate, setBusinessDate] = useState(getRedBoothBusinessDate)
  const [locationId, setLocationId] = useState('')
  const filters = useMemo(() => ({ businessDate, locationId }), [businessDate, locationId])
  const { data, loading, error } = useAdminDashboard(filters)

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-5 border-b pb-7 lg:flex-row lg:items-end lg:justify-between">
        <header><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Admin</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1><p className="mt-2 text-sm text-gray-500">Today's business overview</p></header>
        <div className="grid gap-3 sm:grid-cols-2 lg:w-auto">
          <label className="text-xs font-semibold text-gray-600">Date<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium lg:w-44" /></label>
          <label className="text-xs font-semibold text-gray-600">Location<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium lg:w-52"><option value="">All Locations</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        </div>
      </div>

      {loading && <div className="mt-7"><DashboardSkeleton /></div>}
      {!loading && error && <ErrorState title="Dashboard unavailable" message={error} />}
      {!loading && data && <div className="mt-7 space-y-6">
        <section aria-labelledby="performance-heading">
          <h2 id="performance-heading" className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-gray-500">Today's Performance</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Revenue', value: formatAdminEtb(data.kpis.revenue), accent: 'text-gray-950' },
              { label: 'Prints Sold', value: data.kpis.printsSold.toLocaleString(), accent: 'text-gray-950' },
              { label: 'Transactions', value: data.kpis.transactions.toLocaleString(), accent: 'text-gray-950' },
              { label: 'Balanced Booths', value: data.kpis.balancedBooths.toLocaleString(), accent: 'text-green-700' },
            ].map((kpi) => <article key={kpi.label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-gray-500">{kpi.label}</p><p className={`mt-5 text-2xl font-bold tracking-tight tabular-nums ${kpi.accent}`}>{kpi.value}</p></article>)}
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="booth-status-heading">
            <div className="border-b px-5 py-4"><h2 id="booth-status-heading" className="font-bold">Booth Status</h2><p className="mt-1 text-xs text-gray-500">Operational state for the selected date</p></div>
            {data.booths.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No active booths found for this location.</p> : <div className="divide-y">{data.booths.map((booth) => {
              const tone = booth.attention === 'serious' ? 'bg-red-500' : booth.attention === 'warning' ? 'bg-orange-400' : 'bg-green-500'
              return <Link key={booth.boothId} to={`/admin/daily-operations?booth=${booth.boothId}&date=${businessDate}`} className="grid gap-4 p-5 transition hover:bg-gray-50 md:grid-cols-[minmax(180px,1fr)_140px_1fr] md:items-center">
                <div className="flex gap-3"><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${tone}`} /><div><h3 className="font-bold">{booth.boothName}</h3><p className="mt-1 text-xs text-gray-500">{booth.locationName}</p><p className="mt-2 text-sm text-gray-700">{booth.salespersonName ?? 'No salesperson assigned'}</p></div></div>
                <div><p className="text-xs font-medium text-gray-500">Status</p><p className="mt-1 text-sm font-bold">{booth.state.replaceAll('_', ' ')}</p></div>
                <div className="grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-gray-500">Revenue</p><p className="mt-1 font-semibold">{formatAdminEtb(booth.revenue)}</p></div><div><p className="text-xs text-gray-500">Prints</p><p className="mt-1 font-semibold">{booth.printsSold}</p></div><div><p className="text-xs text-gray-500">Paper</p><p className="mt-1 font-semibold">{booth.paperLabel}</p></div></div>
              </Link>
            })}</div>}
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm" aria-labelledby="money-heading">
            <h2 id="money-heading" className="font-bold">Today's Money</h2>
            <dl className="mt-5 space-y-3">{data.paymentTotals.map((payment) => <div key={payment.code} className="flex justify-between gap-4 text-sm"><dt className="text-gray-600">{payment.label}</dt><dd className="font-semibold tabular-nums">{formatAdminEtb(payment.amount)}</dd></div>)}</dl>
            <dl className="mt-5 border-t pt-5"><div className="flex justify-between"><dt className="font-bold">Total Revenue</dt><dd className="font-bold">{formatAdminEtb(data.kpis.revenue)}</dd></div></dl>
          </section>
        </div>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="attention-heading">
          <div className="border-b px-5 py-4"><h2 id="attention-heading" className="font-bold">Needs Attention</h2><p className="mt-1 text-xs text-gray-500">Exceptions requiring Admin review</p></div>
          {data.alerts.length === 0 ? <div className="flex items-center gap-3 p-6 text-sm font-medium text-green-800"><span className="grid size-9 place-items-center rounded-full bg-green-50 text-lg">✓</span>Everything is balanced. No issues require attention.</div> : <div className="divide-y">{data.alerts.map((alert) => {
            const content = <><span className={`mt-1 size-2.5 shrink-0 rounded-full ${alert.severity === 'serious' ? 'bg-red-500' : 'bg-orange-400'}`} /><span className="text-sm font-medium text-gray-800">{alert.message}</span><span className="ml-auto text-gray-400">→</span></>
            return alert.boothId ? <Link key={alert.id} to={`/admin/daily-operations?booth=${alert.boothId}&date=${businessDate}`} className="flex gap-3 p-4 hover:bg-gray-50">{content}</Link> : <div key={alert.id} className="flex gap-3 p-4">{content}</div>
          })}</div>}
        </section>
      </div>}
    </div>
  )
}
