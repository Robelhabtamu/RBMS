import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { DailyOperationDetail, DailyOperationListItem, DailyOperationsFilters, DailyOperationsOptions, OperationStatus, PaperRecord, TimelineEvent } from '../types/dailyOperations'

const supabase = () => getSupabaseClient()
const value = (input: unknown) => Number(input ?? 0)

function safeError(error: PostgrestError | null, fallback: string) {
  if (error?.code === '42501' || error?.message.toLowerCase().includes('permission denied')) return 'You do not have permission to view daily operations.'
  return fallback
}

export async function getDailyOperations(filters: DailyOperationsFilters): Promise<{ items: DailyOperationListItem[]; options: DailyOperationsOptions }> {
  const [locationsResult, boothsResult, salespersonsResult] = await Promise.all([
    supabase().from('locations').select('id, name').eq('status', 'ACTIVE').order('name'),
    supabase().from('booths').select('id, name, location_id').eq('status', 'ACTIVE').order('name'),
    supabase().from('profiles').select('id, full_name').eq('role', 'SALESPERSON').order('full_name'),
  ])
  if (locationsResult.error || boothsResult.error || salespersonsResult.error) throw new Error('Unable to load daily operations.')
  const locations = (locationsResult.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))
  const allBooths = (boothsResult.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), locationId: String(row.location_id) }))
  const selectedBooths = allBooths.filter((booth) => (!filters.locationId || booth.locationId === filters.locationId) && (!filters.boothId || booth.id === filters.boothId))
  const boothIds = selectedBooths.map((booth) => booth.id)
  const options = { locations, booths: allBooths, salespersons: (salespersonsResult.data ?? []).map((row) => ({ id: String(row.id), name: String(row.full_name) })) }
  if (!boothIds.length) return { items: [], options }

  const { data: dayRows, error: dayError } = await supabase().from('business_days').select('*').eq('business_date', filters.businessDate).in('booth_id', boothIds)
  if (dayError) throw new Error(safeError(dayError, 'Unable to load daily operations.'))
  const dayIds = (dayRows ?? []).map((row) => String(row.id))
  const salespersonIds = [...new Set((dayRows ?? []).map((row) => String(row.salesperson_id)))]
  const [reconciliationResult, profilesResult, assignmentsResult] = await Promise.all([
    dayIds.length ? supabase().from('business_day_reconciliation').select('*').in('business_day_id', dayIds) : Promise.resolve({ data: [], error: null }),
    salespersonIds.length ? supabase().from('profiles').select('id, full_name').in('id', salespersonIds) : Promise.resolve({ data: [], error: null }),
    supabase().from('booth_assignments').select('booth_id, salesperson_id').in('booth_id', boothIds).eq('active', true).lte('start_date', filters.businessDate).or(`end_date.is.null,end_date.gte.${filters.businessDate}`),
  ])
  if (reconciliationResult.error || profilesResult.error || assignmentsResult.error) throw new Error('Unable to load daily operations.')

  const assignmentSalespersonIds = [...new Set((assignmentsResult.data ?? []).map((row) => String(row.salesperson_id)).filter((id) => !salespersonIds.includes(id)))]
  if (assignmentSalespersonIds.length) {
    const { data, error } = await supabase().from('profiles').select('id, full_name').in('id', assignmentSalespersonIds)
    if (error) throw new Error('Unable to load daily operations.')
    profilesResult.data?.push(...(data ?? []))
  }
  const profileNames = new Map((profilesResult.data ?? []).map((row) => [String(row.id), String(row.full_name)]))
  const assignments = new Map((assignmentsResult.data ?? []).map((row) => [String(row.booth_id), String(row.salesperson_id)]))
  const days = new Map((dayRows ?? []).map((row) => [String(row.booth_id), row]))
  const reconciliations = new Map((reconciliationResult.data ?? []).map((row) => [String(row.business_day_id), row]))
  const locationNames = new Map(locations.map((location) => [location.id, location.name]))

  const items = selectedBooths.map((booth): DailyOperationListItem => {
    const day = days.get(booth.id)
    if (!day) return {
      businessDayId: null, boothId: booth.id, boothName: booth.name, locationId: booth.locationId,
      locationName: locationNames.get(booth.locationId) ?? 'Unknown location',
      salespersonName: profileNames.get(assignments.get(booth.id) ?? '') ?? null, salespersonId: assignments.get(booth.id) ?? null,
      businessDate: filters.businessDate, startedAt: null, closedAt: null, status: 'NOT_STARTED',
      transactions: 0, prints: 0, revenue: 0, paperStatus: 'Not started', revenueStatus: 'Not started',
    }
    const totals = reconciliations.get(String(day.id))
    const paperDifference = day.paper_difference === null ? null : value(day.paper_difference)
    const revenueDifference = day.revenue_difference === null ? null : value(day.revenue_difference)
    const open = day.status === 'OPEN'
    return {
      businessDayId: String(day.id), boothId: booth.id, boothName: booth.name, locationId: booth.locationId,
      locationName: locationNames.get(booth.locationId) ?? 'Unknown location',
      salespersonName: profileNames.get(String(day.salesperson_id)) ?? null, salespersonId: String(day.salesperson_id),
      businessDate: String(day.business_date), startedAt: String(day.started_at), closedAt: day.closed_at ? String(day.closed_at) : null,
      status: String(day.status) as OperationStatus,
      transactions: value(totals?.total_transactions), prints: value(totals?.sold_print_count), revenue: value(totals?.revenue_total),
      paperStatus: open ? `${value(totals?.expected_remaining_paper)} expected` : paperDifference ? `Difference ${paperDifference > 0 ? '+' : ''}${paperDifference}` : 'Balanced',
      revenueStatus: open ? 'In progress' : revenueDifference ? `Difference ${revenueDifference}` : 'Balanced',
    }
  }).filter((item) => (!filters.status || item.status === filters.status) && (!filters.salespersonId || item.salespersonId === filters.salespersonId))

  return { items, options }
}

async function signedPaperUrl(path: string | null) {
  if (!path) return null
  const { data, error } = await supabase().storage.from('paper-proofs').createSignedUrl(path, 300)
  return error ? null : data.signedUrl
}

export async function getDailyOperationDetail(businessDayId: string): Promise<DailyOperationDetail> {
  const { data: day, error: dayError } = await supabase().from('business_days').select('*').eq('id', businessDayId).single()
  if (dayError || !day) throw new Error(safeError(dayError, 'Unable to load daily operation.'))

  const [boothResult, salespersonResult, reconciliationResult, transactionsResult, paperResult, faultyResult] = await Promise.all([
    supabase().from('booths').select('id, name, location_id').eq('id', day.booth_id).single(),
    supabase().from('profiles').select('full_name').eq('id', day.salesperson_id).single(),
    supabase().from('business_day_reconciliation').select('*').eq('business_day_id', businessDayId).single(),
    supabase().from('transactions').select('id, transaction_number, quantity, price_per_print, total_amount, payment_method, status, created_at').eq('business_day_id', businessDayId).order('created_at'),
    supabase().from('paper_movements').select('*').eq('business_day_id', businessDayId).order('created_at'),
    supabase().from('faulty_paper_records').select('*').eq('business_day_id', businessDayId).order('created_at'),
  ])
  const firstError = [boothResult, salespersonResult, reconciliationResult, transactionsResult, paperResult, faultyResult].find((result) => result.error)?.error
  if (firstError || !boothResult.data || !reconciliationResult.data) throw new Error('Unable to load daily operation.')

  const booth = boothResult.data
  const creatorIds = [...new Set([...(paperResult.data ?? []).map((row) => String(row.created_by)), ...(faultyResult.data ?? []).map((row) => String(row.created_by))])]
  const methodsResult = await supabase().from('payment_methods').select('code, requires_proof')
  if (methodsResult.error) throw new Error('Unable to load payment verification rules.')
  const proofMethods = new Set((methodsResult.data ?? []).filter((row) => row.requires_proof).map((row) => String(row.code)))
  const digitalTransactions = (transactionsResult.data ?? []).filter((row) => row.status === 'COMPLETED' && proofMethods.has(String(row.payment_method)))
  const [locationResult, creatorsResult, proofsResult] = await Promise.all([
    supabase().from('locations').select('name').eq('id', booth.location_id).single(),
    creatorIds.length ? supabase().from('profiles').select('id, full_name').in('id', creatorIds) : Promise.resolve({ data: [], error: null }),
    digitalTransactions.length ? supabase().from('transaction_proofs').select('transaction_id').in('transaction_id', digitalTransactions.map((row) => String(row.id))) : Promise.resolve({ data: [], error: null }),
  ])
  if (locationResult.error || creatorsResult.error || proofsResult.error) throw new Error('Unable to load daily operation.')

  const creators = new Map((creatorsResult.data ?? []).map((row) => [String(row.id), String(row.full_name)]))
  const proofIds = new Set((proofsResult.data ?? []).map((row) => String(row.transaction_id)))
  const completed = (transactionsResult.data ?? []).filter((row) => row.status === 'COMPLETED')
  const paymentMap = new Map<string, number>()
  completed.forEach((row) => paymentMap.set(String(row.payment_method), (paymentMap.get(String(row.payment_method)) ?? 0) + value(row.total_amount)))

  const paperRecords: PaperRecord[] = await Promise.all((paperResult.data ?? []).map(async (row) => ({
    id: String(row.id), kind: String(row.movement_type) as 'STARTING' | 'ADDITION', quantity: value(row.quantity),
    actorName: creators.get(String(row.created_by)) ?? 'Staff member', createdAt: String(row.created_at),
    proofUrl: await signedPaperUrl(row.storage_path ? String(row.storage_path) : null),
  })))
  const faultyRecords: PaperRecord[] = await Promise.all((faultyResult.data ?? []).map(async (row) => ({
    id: String(row.id), kind: 'FAULTY', quantity: value(row.quantity), reason: String(row.reason), notes: row.notes ? String(row.notes) : null,
    actorName: creators.get(String(row.created_by)) ?? 'Staff member', createdAt: String(row.created_at),
    proofUrl: await signedPaperUrl(row.storage_path ? String(row.storage_path) : null),
  })))

  const timeline: TimelineEvent[] = [
    { id: 'started', occurredAt: String(day.started_at), label: 'Business day started', detail: `${value(day.starting_paper)} starting paper` },
    ...(transactionsResult.data ?? []).map((row) => ({ id: `transaction-${row.id}`, occurredAt: String(row.created_at), label: `Transaction · ${row.payment_method}`, detail: `${value(row.quantity)} prints · ${value(row.total_amount).toLocaleString()} ETB · ${row.status}` })),
    ...paperRecords.filter((row) => row.kind === 'ADDITION').map((row) => ({ id: `paper-${row.id}`, occurredAt: row.createdAt, label: 'Paper added', detail: `${row.quantity} sheets` })),
    ...faultyRecords.map((row) => ({ id: `faulty-${row.id}`, occurredAt: row.createdAt, label: 'Faulty paper recorded', detail: `${row.quantity} sheets · ${row.reason}` })),
    ...(day.closed_at ? [{ id: 'closed', occurredAt: String(day.closed_at), label: 'Business day closed', detail: String(day.closing_status ?? day.status) }] : []),
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

  const reconciliation = reconciliationResult.data
  return {
    businessDay: {
      id: String(day.id), businessDate: String(day.business_date), status: String(day.status) as DailyOperationDetail['businessDay']['status'],
      startedAt: String(day.started_at), closedAt: day.closed_at ? String(day.closed_at) : null, startingPaper: value(day.starting_paper),
      actualRemainingPaper: day.actual_remaining_paper === null ? null : value(day.actual_remaining_paper), paperDifference: day.paper_difference === null ? null : value(day.paper_difference),
      expectedRevenue: day.expected_revenue === null ? null : value(day.expected_revenue), recordedRevenue: day.recorded_revenue === null ? null : value(day.recorded_revenue),
      revenueDifference: day.revenue_difference === null ? null : value(day.revenue_difference), closingStatus: day.closing_status ? String(day.closing_status) : null, closingNotes: day.closing_notes ? String(day.closing_notes) : null,
    },
    booth: { id: String(booth.id), name: String(booth.name), locationName: String(locationResult.data?.name ?? 'Unknown location') },
    salespersonName: String(salespersonResult.data?.full_name ?? 'Unknown salesperson'),
    totals: {
      transactions: value(reconciliation.total_transactions), prints: value(reconciliation.sold_print_count), revenue: value(reconciliation.revenue_total),
      addedPaper: value(reconciliation.total_added_paper), faultyPaper: value(reconciliation.total_faulty_paper), expectedRemaining: value(reconciliation.expected_remaining_paper),
      paymentTotals: [...paymentMap].map(([code, amount]) => ({ code, amount })), digitalTransactions: digitalTransactions.length,
      verifiedProofs: digitalTransactions.filter((row) => proofIds.has(String(row.id))).length,
      missingProofs: digitalTransactions.filter((row) => !proofIds.has(String(row.id))).length,
    },
    paperRecords, faultyRecords,
    timeline,
  }
}
