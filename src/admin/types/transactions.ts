export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'CORRECTED' | 'REFUNDED'
export type TransactionSort = 'NEWEST' | 'OLDEST' | 'HIGHEST_AMOUNT' | 'LOWEST_AMOUNT'
export type VerificationFilter = '' | 'VERIFIED' | 'MISSING_PROOF'

export type AdminTransactionFilters = {
  businessDayId: string
  dateFrom: string
  dateTo: string
  locationId: string
  boothId: string
  salespersonId: string
  paymentMethod: string
  transactionType: string
  status: string
  verification: VerificationFilter
  search: string
}

export type AdminTransaction = {
  id: string
  transaction_number: string
  business_day_id: string
  business_date: string
  created_at: string
  updated_at: string
  booth_id: string
  booth_name: string
  booth_code: string
  location_id: string
  location_name: string
  salesperson_id: string
  salesperson_name: string
  transaction_type: 'STANDARD' | 'REPRINT'
  quantity: number
  price_per_print: number
  total_amount: number
  payment_method: string
  payment_requires_proof: boolean
  status: TransactionStatus
  proof_id: string | null
  proof_storage_path: string | null
  proof_created_at: string | null
}

export type TransactionSummary = { transactionCount: number; printCount: number; revenueTotal: number }
export type FilterOption = { id: string; label: string }
export type TransactionFilterOptions = {
  locations: FilterOption[]
  booths: Array<FilterOption & { locationId: string }>
  salespersons: FilterOption[]
  paymentMethods: FilterOption[]
}

export type TransactionAuditEntry = {
  id: number
  action: string
  actorName: string
  reason: string | null
  createdAt: string
}

export type TransactionDetail = {
  transaction: AdminTransaction
  proofSignedUrl: string | null
  audit: TransactionAuditEntry[]
}
