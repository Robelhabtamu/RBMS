import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import { TransactionDetailDrawer } from '../components/TransactionDetailDrawer'
import { useAdminTransactions } from '../hooks/useAdminTransactions'
import { getTransactionFilterOptions, TRANSACTIONS_PAGE_SIZE } from '../services/adminTransactionsService'
import type { AdminTransaction, AdminTransactionFilters, TransactionFilterOptions, TransactionSort, VerificationFilter } from '../types/transactions'
import { formatAdminEtb } from '../utils/format'

const emptyOptions: TransactionFilterOptions = { locations: [], booths: [], salespersons: [], paymentMethods: [] }

function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function proofLabel(transaction: AdminTransaction) { return !transaction.payment_requires_proof ? 'Not Required' : transaction.proof_id ? 'Verified' : 'Missing Proof' }

export function AdminTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = getRedBoothBusinessDate()
  const initialDate = searchParams.get('date') ?? today
  const [businessDayId] = useState(searchParams.get('businessDay') ?? '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? initialDate)
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? initialDate)
  const [locationId, setLocationId] = useState(searchParams.get('location') ?? '')
  const [boothId, setBoothId] = useState(searchParams.get('booth') ?? '')
  const [salespersonId, setSalespersonId] = useState(searchParams.get('salesperson') ?? '')
  const [paymentMethod, setPaymentMethod] = useState(searchParams.get('payment') ?? '')
  const [transactionType, setTransactionType] = useState(searchParams.get('type') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [verification, setVerification] = useState<VerificationFilter>((searchParams.get('verification') as VerificationFilter) ?? '')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [sort, setSort] = useState<TransactionSort>('NEWEST')
  const [page, setPage] = useState(1)
  const [options, setOptions] = useState(emptyOptions)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminTransaction | null>(null)

  const filters = useMemo<AdminTransactionFilters>(() => ({ businessDayId, dateFrom, dateTo, locationId, boothId, salespersonId, paymentMethod, transactionType, status, verification, search }), [boothId, businessDayId, dateFrom, dateTo, locationId, paymentMethod, salespersonId, search, status, transactionType, verification])
  const { transactions, summary, count, loading, error } = useAdminTransactions(filters, page, sort)
  const pageCount = Math.max(1, Math.ceil(count / TRANSACTIONS_PAGE_SIZE))
  const visibleBooths = locationId ? options.booths.filter((booth) => booth.locationId === locationId) : options.booths

  useEffect(() => { void getTransactionFilterOptions().then(setOptions).catch(() => setOptionsError('Some filters could not be loaded.')) }, [])
  useEffect(() => {
    const params: Record<string, string> = {}
    if (dateFrom === dateTo) params.date = dateFrom; else { params.from = dateFrom; params.to = dateTo }
    if (locationId) params.location = locationId
    if (boothId) params.booth = boothId
    if (salespersonId) params.salesperson = salespersonId
    if (paymentMethod) params.payment = paymentMethod
    if (transactionType) params.type = transactionType
    if (status) params.status = status
    if (verification) params.verification = verification
    if (search) params.search = search
    if (businessDayId) params.businessDay = businessDayId
    setSearchParams(params, { replace: true })
    setPage(1)
  }, [boothId, businessDayId, dateFrom, dateTo, locationId, paymentMethod, salespersonId, search, setSearchParams, status, transactionType, verification])

  function resetFilters() {
    setDateFrom(today); setDateTo(today); setLocationId(''); setBoothId(''); setSalespersonId(''); setPaymentMethod(''); setTransactionType(''); setStatus(''); setVerification(''); setSearch(''); setSort('NEWEST'); setPage(1)
  }

  const fieldClass = 'mt-1 min-h-10 w-full rounded-lg border bg-white px-2.5 text-sm'
  return <div className="mx-auto max-w-[1500px]">
    <header className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Admin</p><h1 className="mt-2 text-3xl font-bold">Transactions</h1><p className="mt-2 text-sm text-gray-500">View and verify all recorded RedBooth sales.</p></div><dl className="flex gap-6 rounded-xl border bg-white px-5 py-3 shadow-sm">{[['Transactions', summary.transactionCount], ['Prints', summary.printCount], ['Revenue', formatAdminEtb(summary.revenueTotal)]].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-1 font-bold tabular-nums">{value}</dd></div>)}</dl></header>

    <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm" aria-label="Transaction filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="text-xs font-semibold text-gray-600">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={fieldClass} /></label>
        <label className="text-xs font-semibold text-gray-600">To<input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} className={fieldClass} /></label>
        <label className="text-xs font-semibold text-gray-600">Location<select value={locationId} onChange={(event) => { setLocationId(event.target.value); setBoothId('') }} className={fieldClass}><option value="">All Locations</option>{options.locations.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Booth<select value={boothId} onChange={(event) => setBoothId(event.target.value)} className={fieldClass}><option value="">All Booths</option>{visibleBooths.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Salesperson<select value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)} className={fieldClass}><option value="">All Salespersons</option>{options.salespersons.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Payment<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={fieldClass}><option value="">All Methods</option>{options.paymentMethods.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-600">Type<select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} className={fieldClass}><option value="">All Types</option><option value="STANDARD">Standard</option><option value="REPRINT">Reprint</option></select></label>
        <label className="text-xs font-semibold text-gray-600">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}><option value="">All Statuses</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="CORRECTED">Corrected</option><option value="REFUNDED">Refunded</option></select></label>
        <label className="text-xs font-semibold text-gray-600">Verification<select value={verification} onChange={(event) => setVerification(event.target.value as VerificationFilter)} className={fieldClass}><option value="">All</option><option value="VERIFIED">Verified</option><option value="MISSING_PROOF">Missing Proof</option></select></label>
        <label className="text-xs font-semibold text-gray-600 lg:col-span-2">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Transaction number" className={fieldClass} /></label>
        <label className="text-xs font-semibold text-gray-600">Sort<select value={sort} onChange={(event) => { setSort(event.target.value as TransactionSort); setPage(1) }} className={fieldClass}><option value="NEWEST">Newest</option><option value="OLDEST">Oldest</option><option value="HIGHEST_AMOUNT">Highest Amount</option><option value="LOWEST_AMOUNT">Lowest Amount</option></select></label>
        <button type="button" onClick={resetFilters} className="mt-auto min-h-10 rounded-lg border px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Reset Filters</button>
      </div>
      {optionsError && <p className="mt-3 text-sm text-orange-700">{optionsError}</p>}
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {loading ? <LoadingState label="Loading transactions" /> : error ? <div className="p-8 text-center"><p className="font-semibold text-red-700">Unable to load transactions.</p><p className="mt-2 text-sm text-gray-500">{error}</p></div> : transactions.length === 0 ? <div className="p-12 text-center"><p className="font-semibold">No transactions found.</p><p className="mt-2 text-sm text-gray-500">Try changing the date or filters.</p></div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b bg-gray-50 text-xs text-gray-500"><tr>{['Transaction', 'Date / Time', 'Location / Booth', 'Salesperson', 'Type', 'Prints', 'Payment', 'Amount', 'Verification', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y">{transactions.map((transaction) => <tr key={transaction.id} onClick={() => setSelected(transaction)} className="cursor-pointer hover:bg-gray-50"><td className="px-4 py-4 font-bold">{transaction.transaction_number}</td><td className="px-4 py-4 text-gray-600">{formatDateTime(transaction.created_at)}</td><td className="px-4 py-4"><p>{transaction.location_name}</p><p className="text-xs text-gray-500">{transaction.booth_name}</p></td><td className="px-4 py-4">{transaction.salesperson_name}</td><td className="px-4 py-4 capitalize">{transaction.transaction_type.toLowerCase()}</td><td className="px-4 py-4 font-semibold">{transaction.quantity}</td><td className="px-4 py-4">{transaction.payment_method}</td><td className="px-4 py-4 font-semibold">{formatAdminEtb(transaction.total_amount)}</td><td className="px-4 py-4"><VerificationBadge label={proofLabel(transaction)} /></td><td className="px-4 py-4"><StatusBadge status={transaction.status} /></td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{transactions.map((transaction) => <button type="button" key={transaction.id} onClick={() => setSelected(transaction)} className="block w-full p-4 text-left hover:bg-gray-50"><div className="flex justify-between gap-4"><div><p className="font-bold">{transaction.transaction_number}</p><p className="mt-1 text-xs text-gray-500">{formatDateTime(transaction.created_at)} · {transaction.booth_name}</p></div><p className="font-bold">{formatAdminEtb(transaction.total_amount)}</p></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span>{transaction.quantity} prints</span><span>·</span><span>{transaction.payment_method}</span><VerificationBadge label={proofLabel(transaction)} /><StatusBadge status={transaction.status} /></div></button>)}</div>
      </>}
      {!loading && !error && count > 0 && <div className="flex items-center justify-between border-t px-4 py-3"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><p className="text-sm text-gray-500">Page {page} of {pageCount}</p><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>}
    </section>
    {selected && <TransactionDetailDrawer transaction={selected} onClose={() => setSelected(null)} />}
  </div>
}

function VerificationBadge({ label }: { label: string }) { const style = label === 'Verified' ? 'bg-green-50 text-green-700' : label === 'Missing Proof' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span> }
function StatusBadge({ status }: { status: string }) { const style = status === 'COMPLETED' ? 'bg-green-50 text-green-700' : status === 'CANCELLED' || status === 'REFUNDED' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span> }
