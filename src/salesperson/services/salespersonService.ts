import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import type {
  BoothAssignment,
  BusinessDay,
  DayTotals,
  PaymentMethod,
  ProofResult,
  SaleTransaction,
  SalesDayContext,
  TransactionType,
} from '../types'

const supabase = () => getSupabaseClient()

function friendlyError(error: PostgrestError | Error | null, fallback: string) {
  if (!error) return fallback
  const message = error.message.toLowerCase()
  if ('code' in error && (error.code === '42501' || message.includes('permission denied'))) return 'You do not have permission to perform this action.'
  if (message.includes('jwt') || message.includes('session')) return 'Your session has expired. Please sign in again.'
  if (message.includes('already been closed')) return "Today's business day has already been closed."
  if (message.includes('already exists') || ('code' in error && error.code === '23505')) return "Today's business day is already open."
  if (message.includes('business day') && message.includes('not found')) return 'No open business day is available.'
  return fallback
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function normalizeTotals(row: Record<string, unknown>): DayTotals {
  return {
    total_transactions: numberValue(row.total_transactions),
    sold_print_count: numberValue(row.sold_print_count),
    revenue_total: numberValue(row.revenue_total),
    revenue_by_payment_method: (row.revenue_by_payment_method ?? {}) as Record<string, number>,
    total_added_paper: numberValue(row.total_added_paper),
    total_faulty_paper: numberValue(row.total_faulty_paper),
    expected_remaining_paper: numberValue(row.expected_remaining_paper),
    paper_difference: row.paper_difference === null ? null : numberValue(row.paper_difference),
    expected_revenue: numberValue(row.expected_revenue),
    recorded_revenue: numberValue(row.recorded_revenue),
    revenue_difference: numberValue(row.revenue_difference),
    fully_balanced: Boolean(row.fully_balanced),
  }
}

async function getAssignments(userId: string): Promise<BoothAssignment[]> {
  const today = getRedBoothBusinessDate()
  const { data: assignmentRows, error } = await supabase()
    .from('booth_assignments')
    .select('booth_id')
    .eq('salesperson_id', userId)
    .eq('active', true)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (error) throw new Error(friendlyError(error, 'Assigned booths could not be loaded.'))
  const boothIds = (assignmentRows ?? []).map((row) => String(row.booth_id))
  if (boothIds.length === 0) return []

  const { data: boothRows, error: boothError } = await supabase()
    .from('booths')
    .select('id, name, code, location_id')
    .in('id', boothIds)
    .eq('status', 'ACTIVE')
  if (boothError) throw new Error(friendlyError(boothError, 'Assigned booth details could not be loaded.'))

  const locationIds = [...new Set((boothRows ?? []).map((row) => String(row.location_id)))]
  const { data: locationRows, error: locationError } = await supabase()
    .from('locations')
    .select('id, name')
    .in('id', locationIds)
  if (locationError) throw new Error(friendlyError(locationError, 'Booth location could not be loaded.'))
  const locations = new Map((locationRows ?? []).map((row) => [String(row.id), String(row.name)]))

  return (boothRows ?? []).map((row) => ({
    boothId: String(row.id),
    boothName: String(row.name),
    boothCode: String(row.code),
    locationName: locations.get(String(row.location_id)) ?? 'Location unavailable',
  }))
}

export async function getSalesDayContext(userId: string): Promise<SalesDayContext> {
  const assignments = await getAssignments(userId)
  // OPEN is the operational source of truth. Do not constrain it with the
  // OPEN is queried without a date constraint so an in-progress day remains
  // recoverable. Closed-day fallback uses the shared Addis Ababa business date.
  const { data: openDayData, error: openDayError } = await supabase()
    .from('business_days')
    .select('*')
    .eq('salesperson_id', userId)
    .eq('status', 'OPEN')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (openDayError) throw new Error(friendlyError(openDayError, 'The open business day could not be loaded.'))

  let dayData = openDayData
  if (!dayData) {
    // Preserve the existing closed-day result UI when there is no active day.
    const { data: todayData, error: todayError } = await supabase()
      .from('business_days')
      .select('*')
      .eq('salesperson_id', userId)
      .eq('business_date', getRedBoothBusinessDate())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (todayError) throw new Error(friendlyError(todayError, "Today's business day could not be loaded."))
    dayData = todayData
  }

  const day = dayData ? dayData as BusinessDay : null
  const totals = day ? await getDayTotals(day.id) : null
  return { assignments, day, totals }
}

export async function getDayTotals(businessDayId: string): Promise<DayTotals> {
  const { data, error } = await supabase().rpc('business_day_totals', { p_business_day_id: businessDayId })
  if (error) throw new Error(friendlyError(error, 'Business-day totals could not be loaded.'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Business-day totals are unavailable.')
  return normalizeTotals(row as Record<string, unknown>)
}

export async function startBusinessDay(boothId: string, startingPaper: number): Promise<BusinessDay> {
  const { data, error } = await supabase().rpc('start_business_day', {
    p_booth_id: boothId,
    p_starting_paper: startingPaper,
  })
  if (error) throw new Error(friendlyError(error, 'The business day could not be started.'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('The day was started, but its record was not returned. Reloading may recover it.')
  return row as BusinessDay
}

export async function getCurrentPrintPrice(): Promise<number> {
  const { data, error } = await supabase().rpc('current_print_price')
  if (error) throw new Error(friendlyError(error, 'The current print price could not be loaded.'))
  return numberValue(data)
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase()
    .from('payment_methods')
    .select('code, display_name, requires_proof')
    .eq('active', true)
    .order('sort_order')
  if (error) throw new Error(friendlyError(error, 'Payment methods could not be loaded.'))
  return (data ?? []) as PaymentMethod[]
}

export async function createSale(input: {
  businessDayId: string
  transactionType: TransactionType
  quantity: number
  paymentMethod: string
}): Promise<SaleTransaction> {
  const { data, error } = await supabase().rpc('create_transaction', {
    p_business_day_id: input.businessDayId,
    p_transaction_type: input.transactionType,
    p_quantity: input.quantity,
    p_payment_method: input.paymentMethod,
  })
  if (error) throw new Error(friendlyError(error, 'The transaction could not be saved. Please try again.'))
  return data as SaleTransaction
}

function safeExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'jpg'
}

export async function attachTransactionProof(
  transactionId: string,
  userId: string,
  file?: File,
  pendingStoragePath?: string,
): Promise<ProofResult> {
  let storagePath = pendingStoragePath
  if (!storagePath) {
    if (!file) return { verified: false, error: 'Choose a verification image.' }
    storagePath = `${transactionId}/${crypto.randomUUID()}.${safeExtension(file)}`
    const { error: uploadError } = await supabase().storage.from('transaction-proofs').upload(storagePath, file, {
      cacheControl: '3600', upsert: false,
    })
    if (uploadError) return { verified: false, error: 'Sale recorded, but verification photo could not be uploaded.', pendingStoragePath: undefined }
  }

  const { error: recordError } = await supabase().from('transaction_proofs').insert({
    transaction_id: transactionId,
    storage_path: storagePath,
    uploaded_by: userId,
  })
  if (recordError) return { verified: false, error: 'Proof uploaded, but verification could not be recorded. Retry to finish.', pendingStoragePath: storagePath }
  return { verified: true }
}

export async function getTodayTransactions(businessDayId: string): Promise<SaleTransaction[]> {
  const { data, error } = await supabase()
    .from('transactions')
    .select('id, transaction_number, business_day_id, transaction_type, quantity, price_per_print, total_amount, payment_method, status, created_at')
    .eq('business_day_id', businessDayId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(friendlyError(error, "Today's transactions could not be loaded."))

  const transactions = (data ?? []) as SaleTransaction[]
  if (transactions.length === 0) return []
  const [{ data: proofs, error: proofError }, { data: methods, error: methodError }] = await Promise.all([supabase()
    .from('transaction_proofs')
    .select('transaction_id')
    .in('transaction_id', transactions.map((transaction) => transaction.id)), supabase().from('payment_methods').select('code, requires_proof').eq('active', true)])
  if (proofError || methodError) throw new Error(friendlyError(proofError ?? methodError, 'Transaction verification status could not be loaded.'))
  const verifiedIds = new Set((proofs ?? []).map((proof) => String(proof.transaction_id)))
  const proofRules = new Map((methods ?? []).map((item) => [String(item.code), Boolean(item.requires_proof)]))
  return transactions.map((transaction) => ({ ...transaction, verified: verifiedIds.has(transaction.id), payment_requires_proof: proofRules.get(transaction.payment_method) ?? false }))
}

async function uploadPaperProof(businessDayId: string, file: File) {
  const storagePath = `${businessDayId}/${crypto.randomUUID()}.${safeExtension(file)}`
  const { error } = await supabase().storage.from('paper-proofs').upload(storagePath, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error('The paper verification photo could not be uploaded.')
  return storagePath
}

export async function addPaper(userId: string, businessDayId: string, quantity: number, proof?: File) {
  const storagePath = proof ? await uploadPaperProof(businessDayId, proof) : null
  const { error } = await supabase().from('paper_movements').insert({
    business_day_id: businessDayId,
    movement_type: 'ADDITION',
    quantity,
    storage_path: storagePath,
    created_by: userId,
  })
  if (error) throw new Error(friendlyError(error, 'The paper addition could not be saved.'))
}

export async function recordFaultyPaper(input: {
  userId: string
  businessDayId: string
  quantity: number
  reason: string
  notes?: string
  proof?: File
}) {
  const storagePath = input.proof ? await uploadPaperProof(input.businessDayId, input.proof) : null
  const { error } = await supabase().from('faulty_paper_records').insert({
    business_day_id: input.businessDayId,
    quantity: input.quantity,
    reason: input.reason.trim(),
    notes: input.notes?.trim() || null,
    storage_path: storagePath,
    created_by: input.userId,
  })
  if (error) throw new Error(friendlyError(error, 'The faulty paper record could not be saved.'))
}

export async function closeBusinessDay(
  businessDayId: string,
  actualRemainingPaper: number,
  closingNotes?: string,
): Promise<BusinessDay> {
  const { data, error } = await supabase().rpc('close_business_day', {
    p_business_day_id: businessDayId,
    p_actual_remaining_paper: actualRemainingPaper,
    p_closing_notes: closingNotes?.trim() || null,
  })
  if (error) throw new Error(friendlyError(error, 'The business day could not be closed.'))
  return data as BusinessDay
}
