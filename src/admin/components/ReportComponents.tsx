import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AdminReport, Comparison, ReportOptions, ReportTrend } from '../types/reports'
import { formatAdminEtb } from '../utils/format'
import { formatReportDate } from '../utils/reportDates'

const card = 'rounded-2xl border bg-white p-5 shadow-sm'

export function ReportHeader({ title, subtitle, period, children }: { title: string; subtitle: string; period: string; children?: ReactNode }) {
  return <header className="border-b pb-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Reports</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><p className="mt-2 text-sm text-gray-500">{subtitle}</p><p className="mt-2 text-sm font-semibold">{period}</p></div>{children && <div className="report-controls flex flex-wrap gap-3">{children}</div>}</div></header>
}

export function ReportFilters({ options, locationId, boothId, onLocation, onBooth, children }: { options: ReportOptions; locationId: string; boothId: string; onLocation: (value: string) => void; onBooth: (value: string) => void; children?: ReactNode }) {
  const booths = locationId ? options.booths.filter((booth) => booth.locationId === locationId) : options.booths
  return <section className="report-controls mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">{children}<label className="min-w-48 flex-1 text-xs font-semibold">Location<select value={locationId} onChange={(event) => { onLocation(event.target.value); onBooth('') }} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">All locations</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="min-w-48 flex-1 text-xs font-semibold">Booth<select value={boothId} onChange={(event) => onBooth(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">All booths</option>{booths.map((booth) => <option key={booth.id} value={booth.id}>{booth.name}</option>)}</select></label></section>
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <p className="mt-2 text-xs text-gray-400">No previous data</p>
  return <p className={`mt-2 text-xs font-semibold ${value >= 0 ? 'text-green-700' : 'text-red-700'}`}>{value >= 0 ? '+' : ''}{value.toFixed(1)}% vs previous period</p>
}

export function SummaryCards({ report, comparison }: { report: AdminReport; comparison?: Comparison | null }) {
  const items: Array<[string, string | number, keyof Comparison]> = [['Transactions', report.summary.transactions, 'transactions'], ['Prints Sold', report.summary.prints, 'prints'], ['Revenue', formatAdminEtb(report.summary.revenue), 'revenue']]
  return <section className="mt-6 grid gap-4 sm:grid-cols-3">{items.map(([label, value, key]) => <div key={label} className={card}><p className="text-xs font-semibold text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>{comparison && <Change value={comparison[key]} />}</div>)}</section>
}

export function MoneySections({ report }: { report: AdminReport }) {
  return <section className={`mt-5 ${card}`}><div className="flex items-center justify-between"><h2 className="font-bold">Payment Breakdown</h2><p className="font-bold">{formatAdminEtb(report.summary.revenue)}</p></div><div className="mt-4 divide-y">{report.payments.length ? report.payments.map((payment) => <div key={payment.code} className="flex justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{payment.name}</p><p className="text-xs text-gray-500">{payment.transactions} transactions · {payment.prints} prints</p></div><p className="font-bold">{formatAdminEtb(payment.amount)}</p></div>) : <p className="py-6 text-sm text-gray-500">No sales recorded for this period.</p>}</div></section>
}

export function HealthSections({ report }: { report: AdminReport }) {
  const groups = [['Operations', [['Expected Booth Days', report.operations.expectedBoothDays], ['Started', report.operations.started], ['Closed', report.operations.closed], ['Open', report.operations.open], ['Balanced', report.operations.balanced], ['Issues', report.operations.discrepant + report.operations.pendingReview + report.operations.pastOpen]]], ['Paper', [['Starting', report.paper.starting], ['Added', report.paper.added], ['Prints', report.paper.prints], ['Faulty', report.paper.faulty], ['Difference', report.paper.difference]]], ['Verification', [['Required', report.verification.required], ['Verified', report.verification.verified], ['Missing', report.verification.missing]]]] as const
  return <div className="mt-5 grid gap-5 lg:grid-cols-3">{groups.map(([title, rows]) => <section key={title} className={card}><h2 className="font-bold">{title}</h2><dl className="mt-4 divide-y">{rows.map(([label, value]) => <div key={label} className="flex justify-between py-2 text-sm"><dt className="text-gray-600">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl></section>)}</div>
}

export function TrendChart({ rows }: { rows: ReportTrend[] }) {
  const [metric, setMetric] = useState<'revenue' | 'prints'>('revenue')
  const max = Math.max(1, ...rows.map((row) => Number(row[metric])))
  return <section className={`mt-5 ${card}`}><div className="flex items-center justify-between"><div><h2 className="font-bold">Daily Trend</h2><p className="text-sm text-gray-500">Performance by RedBooth business date.</p></div><select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)} className="report-controls rounded-lg border bg-white px-3 py-2 text-sm"><option value="revenue">Revenue</option><option value="prints">Prints</option></select></div><div className="mt-6 flex h-52 items-end gap-1 overflow-x-auto border-b px-1">{rows.map((row) => { const value = Number(row[metric]); return <div key={row.date} className="group flex min-w-5 flex-1 flex-col items-center justify-end" title={`${row.date}: ${value.toLocaleString()}`}><div className="w-full max-w-8 rounded-t bg-redbooth-500" style={{ height: `${Math.max(value ? 3 : 0, value / max * 160)}px` }} /><span className="mt-2 text-[9px] text-gray-500">{row.date.slice(5)}</span></div> })}</div></section>
}

export function TrendTable({ rows, dailyLinks = true }: { rows: ReportTrend[]; dailyLinks?: boolean }) {
  return <section className={`mt-5 overflow-hidden ${card}`}><h2 className="font-bold">Day-by-Day</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr>{['Date', 'Transactions', 'Prints', 'Revenue', 'Balanced Booths', 'Issues'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.date}><td className="px-3 py-3 font-semibold">{dailyLinks ? <Link className="text-redbooth-700 hover:underline" to={`/admin/daily-reports?date=${row.date}`}>{formatReportDate(row.date)}</Link> : formatReportDate(row.date)}</td><td className="px-3 py-3">{row.transactions}</td><td className="px-3 py-3">{row.prints}</td><td className="px-3 py-3">{formatAdminEtb(row.revenue)}</td><td className="px-3 py-3">{row.balanced}</td><td className="px-3 py-3">{row.issues}</td></tr>)}</tbody></table></div></section>
}

export function BoothTable({ report, daily = false }: { report: AdminReport; daily?: boolean }) {
  return <section className={`mt-5 overflow-hidden ${card}`}><h2 className="font-bold">Booth Performance</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr>{['Location', 'Booth', 'Salesperson / Status', 'Transactions', 'Prints', 'Revenue', 'Faulty', 'Paper Difference', 'Revenue Difference', 'Verification', 'Closing', 'Issues'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{report.booths.map((booth) => <tr key={booth.boothId} className={daily && booth.businessDayId ? 'cursor-pointer hover:bg-gray-50' : ''} onClick={() => { if (daily && booth.businessDayId) location.href = `/admin/daily-operations/${booth.businessDayId}` }}><td className="px-3 py-3">{booth.locationName}</td><td className="px-3 py-3 font-semibold">{booth.boothName}</td><td className="px-3 py-3"><p>{booth.salesperson ?? 'Unassigned'}</p><p className="text-xs text-gray-500">{booth.status}</p></td><td className="px-3 py-3">{booth.transactions}</td><td className="px-3 py-3">{booth.prints}</td><td className="px-3 py-3">{formatAdminEtb(booth.revenue)}</td><td className="px-3 py-3">{booth.faulty}</td><td className="px-3 py-3">{booth.paperDifference}</td><td className="px-3 py-3">{formatAdminEtb(booth.revenueDifference)}</td><td className="px-3 py-3">{booth.proofRequired ? booth.missingProof ? `${booth.missingProof} missing` : 'Verified' : 'Not required'}</td><td className="px-3 py-3">{booth.closingStatus ?? '—'}</td><td className="px-3 py-3">{booth.discrepancies}</td></tr>)}</tbody></table></div></section>
}

export function Attention({ report }: { report: AdminReport }) {
  const issues: string[] = []
  if (report.verification.missing) issues.push(`${report.verification.missing} transaction(s) missing required proof`)
  if (report.operations.discrepant) issues.push(`${report.operations.discrepant} booth-day(s) closed with discrepancy`)
  if (report.operations.pendingReview) issues.push(`${report.operations.pendingReview} booth-day(s) pending review`)
  if (report.operations.pastOpen) issues.push(`${report.operations.pastOpen} past business day(s) still open`)
  return <section className={`mt-5 ${card}`}><h2 className="font-bold">Management Attention</h2>{issues.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{issues.map((issue) => <li key={issue} className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-800">{issue}</li>)}</ul> : <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">Everything is balanced. No issues require attention.</p>}</section>
}

export function Drilldowns({ dateFrom, dateTo, locationId, boothId }: { dateFrom: string; dateTo: string; locationId: string; boothId: string }) {
  const query = new URLSearchParams(dateFrom === dateTo ? { date: dateFrom } : { from: dateFrom, to: dateTo })
  if (locationId) query.set('location', locationId)
  if (boothId) query.set('booth', boothId)
  return <nav className="report-controls mt-5 flex flex-wrap gap-3" aria-label="Report drill-downs">{[['Transactions', 'transactions'], ['Daily Operations', 'daily-operations']].map(([label, path]) => <Link key={path} to={`/admin/${path}?${query}`} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">View {label}</Link>)}</nav>
}

export function WeeklyRollup({ rows }: { rows: ReportTrend[] }) {
  const groups = new Map<string, ReportTrend[]>()
  rows.forEach((row) => { const date = new Date(`${row.date}T00:00:00Z`); const day = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1)); const key = date.toISOString().slice(0, 10); groups.set(key, [...(groups.get(key) ?? []), row]) })
  return <section className={`mt-5 ${card}`}><h2 className="font-bold">Weekly Breakdown</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr>{['Week', 'Transactions', 'Prints', 'Revenue', 'Issues'].map((heading) => <th key={heading} className="border-b px-3 py-3 text-xs text-gray-500">{heading}</th>)}</tr></thead><tbody>{[...groups].map(([start, items], index) => { const sum = (key: 'transactions' | 'prints' | 'revenue' | 'issues') => items.reduce((total, row) => total + Number(row[key]), 0); return <tr key={start} className="border-b"><td className="px-3 py-3"><Link className="font-semibold text-redbooth-700" to={`/admin/weekly-reports?weekStart=${start}`}>Week {index + 1} · {formatReportDate(items[0].date)}–{formatReportDate(items.at(-1)!.date, { month: 'short', day: 'numeric' })}</Link></td><td className="px-3">{sum('transactions')}</td><td className="px-3">{sum('prints')}</td><td className="px-3">{formatAdminEtb(sum('revenue'))}</td><td className="px-3">{sum('issues')}</td></tr> })}</tbody></table></div></section>
}
