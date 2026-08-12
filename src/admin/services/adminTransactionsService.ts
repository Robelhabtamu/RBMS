import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import type {
  AdminTransaction,
  AdminTransactionFilters,
  TransactionDetail,
  TransactionFilterOptions,
  TransactionSort,
  TransactionSummary,
} from '../types/transactions'

export const TRANSACTIONS_PAGE_SIZE = 25
const supabase = () => getSupabaseClient()

function safeError(error: PostgrestError | null, fallback: string) {
  if (error?.code === '42501' || error?.message.toLowerCase().includes('permission denied')) return 'You do not have permission to view these transactions.'
  if (error?.message.toLowerCase().includes('jwt')) return 'Your session has expired. Please sign in again.'
  return fallback
}

function nullable(value: string) { return value || null }

export async function getTransactionFilterOptions(): Promise<TransactionFilterOptions> {
  const [locations, booths, profiles, methods] = await Promise.all([
    supabase().from('locations').select('id, name').eq('status', 'ACTIVE').order('name'),
    supabase().from('booths').select('id, name, location_id').order('name'),
    supabase().from('profiles').select('id, full_name').eq('role', 'SALESPERSON').order('full_name'),
    supabase().from('payment_methods').select('code, display_name').order('sort_order'),
  ])
  if (locations.error || booths.error || profiles.error || methods.error) throw new Error('Transaction filters could not be loaded.')
  return {
    locations: (locations.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name) })),
    booths: (booths.data ?? []).map((row) => ({ id: String(row.id), label: String(row.name), locationId: String(row.location_id) })),
    salespersons: (profiles.data ?? []).map((row) => ({ id: String(row.id), label: String(row.full_name) })),
    paymentMethods: (methods.data ?? []).map((row) => ({ id: String(row.code), label: String(row.display_name) })),
  }
}

export async function getAdminTransactions(
  filters: AdminTransactionFilters,
  page: number,
  sort: TransactionSort,
): Promise<{ transactions: AdminTransaction[]; count: number; summary: TransactionSummary }> {
  let query = supabase().from('admin_transaction_details').select('*', { count: 'exact' })
    .gte('business_date', filters.dateFrom).lte('business_date', filters.dateTo)

  // Apply common filters explicitly to retain Supabase builder typing.
  if (filters.businessDayId) query = query.eq('business_day_id', filters.businessDayId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.boothId) query = query.eq('booth_id', filters.boothId)
  if (filters.salespersonId) query = query.eq('salesperson_id', filters.salespersonId)
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters.transactionType) query = query.eq('transaction_type', filters.transactionType)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search.trim()) query = query.ilike('transaction_number', `%${filters.search.trim()}%`)
  if (filters.verification === 'VERIFIED') query = query.eq('payment_requires_proof', true).not('proof_id', 'is', null)
  if (filters.verification === 'MISSING_PROOF') query = query.eq('payment_requires_proof', true).is('proof_id', null)

  const sortConfig = sort === 'OLDEST' ? { column: 'created_at', ascending: true }
    : sort === 'HIGHEST_AMOUNT' ? { column: 'total_amount', ascending: false }
      : sort === 'LOWEST_AMOUNT' ? { column: 'total_amount', ascending: true }
        : { column: 'created_at', ascending: false }
  query = query.order(sortConfig.column, { ascending: sortConfig.ascending })
    .range((page - 1) * TRANSACTIONS_PAGE_SIZE, page * TRANSACTIONS_PAGE_SIZE - 1)

  const summaryPromise = supabase().rpc('admin_transaction_summary', {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_location_id: nullable(filters.locationId),
    p_booth_id: nullable(filters.boothId),
    p_salesperson_id: nullable(filters.salespersonId),
    p_payment_method: nullable(filters.paymentMethod),
    p_transaction_type: nullable(filters.transactionType),
    p_status: nullable(filters.status),
    p_verification: nullable(filters.verification),
    p_search: nullable(filters.search.trim()),
    p_business_day_id: nullable(filters.businessDayId),
  })

  const [rowsResult, summaryResult] = await Promise.all([query, summaryPromise])
  if (rowsResult.error) throw new Error(safeError(rowsResult.error, 'Unable to load transactions.'))
  if (summaryResult.error) throw new Error(safeError(summaryResult.error, 'Unable to load transaction totals. Apply the latest Supabase migration.'))
  const summaryRow = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data
  return {
    transactions: (rowsResult.data ?? []) as AdminTransaction[],
    count: rowsResult.count ?? 0,
    summary: {
      transactionCount: Number(summaryRow?.transaction_count ?? 0),
      printCount: Number(summaryRow?.print_count ?? 0),
      revenueTotal: Number(summaryRow?.revenue_total ?? 0),
    },
  }
}

export async function getAdminTransactionDetail(transaction: AdminTransaction): Promise<TransactionDetail> {
  let proofSignedUrl: string | null = null
  if (transaction.proof_storage_path) {
    const { data, error } = await supabase().storage.from('transaction-proofs').createSignedUrl(transaction.proof_storage_path, 300)
    if (error) throw new Error('The private verification image could not be loaded.')
    proofSignedUrl = data.signedUrl
  }

  const { data: auditRows, error: auditError } = await supabase().from('audit_logs')
    .select('id, actor_user_id, action, reason, created_at')
    .eq('entity_type', 'transactions').eq('entity_id', transaction.id).order('created_at')
  if (auditError) throw new Error(safeError(auditError, 'Transaction history could not be loaded.'))
  const actorIds = [...new Set((auditRows ?? []).flatMap((row) => row.actor_user_id ? [String(row.actor_user_id)] : []))]
  const actorsResult = actorIds.length ? await supabase().from('profiles').select('id, full_name').in('id', actorIds) : { data: [], error: null }
  if (actorsResult.error) throw new Error('Transaction history actors could not be loaded.')
  const actors = new Map((actorsResult.data ?? []).map((row) => [String(row.id), String(row.full_name)]))

  return {
    transaction,
    proofSignedUrl,
    audit: (auditRows ?? []).map((row) => ({
      id: Number(row.id),
      action: String(row.action),
      actorName: row.actor_user_id ? actors.get(String(row.actor_user_id)) ?? 'Admin user' : 'System',
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at),
    })),
  }
}
