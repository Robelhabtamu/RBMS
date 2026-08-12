import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import type {
  AdminDashboardData,
  AdminDashboardFilters,
  BoothDashboardStatus,
  DashboardAlert,
  DashboardLocation,
} from '../types/dashboard'

const supabase = () => getSupabaseClient()

function safeError(error: PostgrestError | null, fallback: string) {
  if (!error) return fallback
  if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) return 'You do not have permission to load Admin dashboard data.'
  if (error.message.toLowerCase().includes('jwt')) return 'Your session has expired. Please sign in again.'
  return fallback
}

function amount(value: unknown) { return Number(value ?? 0) }

function isPastBusinessDate(date: string) {
  return date < getRedBoothBusinessDate()
}

export async function getAdminDashboard(filters: AdminDashboardFilters): Promise<AdminDashboardData> {
  const { data: locationRows, error: locationError } = await supabase().from('locations').select('id, name').eq('status', 'ACTIVE').order('name')
  if (locationError) throw new Error(safeError(locationError, 'Locations could not be loaded.'))
  const locations = (locationRows ?? []).map((row) => ({ id: String(row.id), name: String(row.name) })) as DashboardLocation[]

  let boothQuery = supabase().from('booths').select('id, name, location_id').eq('status', 'ACTIVE').order('name')
  if (filters.locationId) boothQuery = boothQuery.eq('location_id', filters.locationId)
  const { data: boothRows, error: boothError } = await boothQuery
  if (boothError) throw new Error(safeError(boothError, 'Booths could not be loaded.'))
  const booths = boothRows ?? []
  const boothIds = booths.map((row) => String(row.id))
  const locationNames = new Map(locations.map((location) => [location.id, location.name]))

  const { data: methodRows, error: methodError } = await supabase().from('payment_methods').select('code, display_name, requires_proof').eq('active', true).order('sort_order')
  if (methodError) throw new Error(safeError(methodError, 'Payment methods could not be loaded.'))

  if (boothIds.length === 0) {
    return {
      locations,
      kpis: { revenue: 0, printsSold: 0, transactions: 0, balancedBooths: 0 },
      booths: [],
      paymentTotals: (methodRows ?? []).map((row) => ({ code: String(row.code), label: String(row.display_name), amount: 0 })),
      alerts: [],
    }
  }

  const [daysResult, assignmentsResult] = await Promise.all([
    supabase().from('business_days').select('*').eq('business_date', filters.businessDate).in('booth_id', boothIds),
    supabase().from('booth_assignments').select('booth_id, salesperson_id').in('booth_id', boothIds).eq('active', true).lte('start_date', filters.businessDate).or(`end_date.is.null,end_date.gte.${filters.businessDate}`),
  ])
  if (daysResult.error) throw new Error(safeError(daysResult.error, 'Business-day status could not be loaded.'))
  if (assignmentsResult.error) throw new Error(safeError(assignmentsResult.error, 'Booth assignments could not be loaded.'))

  const dayRows = daysResult.data ?? []
  const dayIds = dayRows.map((row) => String(row.id))
  const salespersonIds = [...new Set([
    ...dayRows.map((row) => String(row.salesperson_id)),
    ...(assignmentsResult.data ?? []).map((row) => String(row.salesperson_id)),
  ])]

  const transactionsPromise = dayIds.length
    ? supabase().from('transactions').select('id, business_day_id, booth_id, quantity, total_amount, payment_method, status').in('business_day_id', dayIds).eq('status', 'COMPLETED')
    : Promise.resolve({ data: [], error: null })
  const reconciliationPromise = dayIds.length
    ? supabase().from('business_day_reconciliation').select('*').in('business_day_id', dayIds)
    : Promise.resolve({ data: [], error: null })
  const profilesPromise = salespersonIds.length
    ? supabase().from('profiles').select('id, full_name').in('id', salespersonIds)
    : Promise.resolve({ data: [], error: null })
  const [transactionsResult, reconciliationResult, profilesResult] = await Promise.all([
    transactionsPromise, reconciliationPromise, profilesPromise,
  ])
  if (transactionsResult.error) throw new Error(safeError(transactionsResult.error, 'Transactions could not be loaded.'))
  if (reconciliationResult.error) throw new Error(safeError(reconciliationResult.error, 'Reconciliation status could not be loaded.'))
  if (profilesResult.error) throw new Error(safeError(profilesResult.error, 'Salesperson names could not be loaded.'))

  const transactions = transactionsResult.data ?? []
  const proofMethods = new Set((methodRows ?? []).filter((row) => row.requires_proof).map((row) => String(row.code)))
  const proofTransactionIds = transactions.filter((row) => proofMethods.has(String(row.payment_method))).map((row) => String(row.id))
  const proofsResult = proofTransactionIds.length
    ? await supabase().from('transaction_proofs').select('transaction_id').in('transaction_id', proofTransactionIds)
    : { data: [], error: null }
  if (proofsResult.error) throw new Error(safeError(proofsResult.error, 'Proof verification status could not be loaded.'))

  const verifiedTransactions = new Set((proofsResult.data ?? []).map((row) => String(row.transaction_id)))
  const profiles = new Map((profilesResult.data ?? []).map((row) => [String(row.id), String(row.full_name)]))
  const assignments = new Map((assignmentsResult.data ?? []).map((row) => [String(row.booth_id), String(row.salesperson_id)]))
  const daysByBooth = new Map(dayRows.map((row) => [String(row.booth_id), row]))
  const reconciliationByDay = new Map((reconciliationResult.data ?? []).map((row) => [String(row.business_day_id), row]))

  const revenue = transactions.reduce((sum, row) => sum + amount(row.total_amount), 0)
  const printsSold = transactions.reduce((sum, row) => sum + amount(row.quantity), 0)

  const alerts: DashboardAlert[] = []
  const boothStatuses: BoothDashboardStatus[] = booths.map((booth) => {
    const boothId = String(booth.id)
    const day = daysByBooth.get(boothId)
    const reconciliation = day ? reconciliationByDay.get(String(day.id)) : undefined
    const boothTransactions = transactions.filter((row) => String(row.booth_id) === boothId)
    const boothRevenue = boothTransactions.reduce((sum, row) => sum + amount(row.total_amount), 0)
    const boothPrints = boothTransactions.reduce((sum, row) => sum + amount(row.quantity), 0)
    const paperDifference = day?.paper_difference === null || day?.paper_difference === undefined ? null : amount(day.paper_difference)
    const revenueDifference = day?.revenue_difference === null || day?.revenue_difference === undefined ? null : amount(day.revenue_difference)

    if (paperDifference) alerts.push({ id: `paper-${day.id}`, boothId, severity: Math.abs(paperDifference) >= 5 ? 'serious' : 'warning', message: `Paper difference of ${paperDifference} at ${booth.name}` })
    if (revenueDifference) alerts.push({ id: `revenue-${day.id}`, boothId, severity: 'serious', message: `Revenue difference of ${revenueDifference.toLocaleString()} ETB at ${booth.name}` })
    const missingProofs = boothTransactions.filter((row) => proofMethods.has(String(row.payment_method)) && !verifiedTransactions.has(String(row.id))).length
    if (missingProofs) alerts.push({ id: `proof-${boothId}`, boothId, severity: 'warning', message: `${missingProofs} digital transaction${missingProofs === 1 ? '' : 's'} missing verification proof at ${booth.name}` })
    if (day?.status === 'OPEN' && isPastBusinessDate(filters.businessDate)) alerts.push({ id: `open-${day.id}`, boothId, severity: 'serious', message: `${booth.name} business day is still open` })
    if (day?.status === 'PENDING_REVIEW') alerts.push({ id: `review-${day.id}`, boothId, severity: 'warning', message: `${booth.name} business day is pending review` })
    if (day?.status === 'CLOSED_WITH_DISCREPANCY' && !paperDifference && !revenueDifference) alerts.push({ id: `closed-${day.id}`, boothId, severity: 'warning', message: `${booth.name} closed with a discrepancy` })

    const state = day ? String(day.status) as BoothDashboardStatus['state'] : 'NOT_STARTED'
    const assignedId = day ? String(day.salesperson_id) : assignments.get(boothId)
    const attention = state === 'CLOSED_WITH_DISCREPANCY' || (state === 'OPEN' && isPastBusinessDate(filters.businessDate))
      ? 'serious' : state === 'PENDING_REVIEW' ? 'warning' : 'healthy'
    const paperLabel = !day ? 'Not started'
      : state === 'OPEN' ? `${amount(reconciliation?.expected_remaining_paper)} expected`
        : paperDifference ? `Difference ${paperDifference > 0 ? '+' : ''}${paperDifference}` : 'Balanced'

    return {
      boothId,
      boothName: String(booth.name),
      locationName: locationNames.get(String(booth.location_id)) ?? 'Unknown location',
      salespersonName: assignedId ? profiles.get(assignedId) ?? null : null,
      state,
      revenue: boothRevenue,
      printsSold: boothPrints,
      paperLabel,
      attention,
    }
  })


  const paymentTotals = (methodRows ?? []).map((method) => ({
    code: String(method.code),
    label: String(method.display_name),
    amount: transactions.filter((row) => row.payment_method === method.code).reduce((sum, row) => sum + amount(row.total_amount), 0),
  }))

  return {
    locations,
    kpis: { revenue, printsSold, transactions: transactions.length, balancedBooths: boothStatuses.filter((booth) => booth.state === 'CLOSED' && booth.attention === 'healthy').length },
    booths: boothStatuses,
    paymentTotals,
    alerts,
  }
}
