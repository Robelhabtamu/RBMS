export type BusinessDayStatus = 'OPEN' | 'CLOSED' | 'CLOSED_WITH_DISCREPANCY' | 'PENDING_REVIEW'
export type TransactionType = 'STANDARD' | 'REPRINT'

export type BoothAssignment = {
  boothId: string
  boothName: string
  boothCode: string
  locationName: string
}

export type BusinessDay = {
  id: string
  booth_id: string
  salesperson_id: string
  business_date: string
  started_at: string
  closed_at: string | null
  status: BusinessDayStatus
  starting_paper: number
  actual_remaining_paper: number | null
  paper_difference: number | null
  expected_revenue: number | null
  recorded_revenue: number | null
  revenue_difference: number | null
  closing_status: 'BALANCED' | 'DISCREPANCY' | null
  closing_notes: string | null
}

export type DayTotals = {
  total_transactions: number
  sold_print_count: number
  revenue_total: number
  revenue_by_payment_method: Record<string, number>
  total_added_paper: number
  total_faulty_paper: number
  expected_remaining_paper: number
  paper_difference: number | null
  expected_revenue: number
  recorded_revenue: number
  revenue_difference: number
  fully_balanced: boolean
}

export type PaymentMethod = { code: string; display_name: string; requires_proof: boolean }

export type SaleTransaction = {
  id: string
  transaction_number: string
  business_day_id: string
  transaction_type: TransactionType
  quantity: number
  price_per_print: number
  total_amount: number
  payment_method: string
  status: 'COMPLETED' | 'CANCELLED' | 'CORRECTED' | 'REFUNDED'
  created_at: string
  verified?: boolean
  payment_requires_proof?: boolean
}

export type SalesDayContext = {
  assignments: BoothAssignment[]
  day: BusinessDay | null
  totals: DayTotals | null
}

export type ProofResult = {
  verified: boolean
  pendingStoragePath?: string
  error?: string
}
