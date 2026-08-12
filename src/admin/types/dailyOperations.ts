export type OperationStatus = 'OPEN' | 'CLOSED' | 'CLOSED_WITH_DISCREPANCY' | 'PENDING_REVIEW' | 'NOT_STARTED'
export type DailyOperationsFilters = { businessDate: string; locationId: string; boothId: string; status: string; salespersonId: string }

export type DailyOperationListItem = {
  businessDayId: string | null
  boothId: string
  boothName: string
  locationId: string
  locationName: string
  salespersonName: string | null
  salespersonId: string | null
  businessDate: string
  startedAt: string | null
  closedAt: string | null
  status: OperationStatus
  transactions: number
  prints: number
  revenue: number
  paperStatus: string
  revenueStatus: string
}

export type DailyOperationsOptions = {
  locations: Array<{ id: string; name: string }>
  booths: Array<{ id: string; name: string; locationId: string }>
  salespersons: Array<{ id: string; name: string }>
}

export type PaperRecord = {
  id: string
  kind: 'STARTING' | 'ADDITION' | 'FAULTY'
  quantity: number
  reason?: string
  notes?: string | null
  actorName: string
  createdAt: string
  proofUrl: string | null
}

export type TimelineEvent = { id: string; occurredAt: string; label: string; detail: string }

export type DailyOperationDetail = {
  businessDay: {
    id: string; businessDate: string; status: Exclude<OperationStatus, 'NOT_STARTED'>; startedAt: string; closedAt: string | null
    startingPaper: number; actualRemainingPaper: number | null; paperDifference: number | null
    expectedRevenue: number | null; recordedRevenue: number | null; revenueDifference: number | null
    closingStatus: string | null; closingNotes: string | null
  }
  booth: { id: string; name: string; locationName: string }
  salespersonName: string
  totals: {
    transactions: number; prints: number; revenue: number; addedPaper: number; faultyPaper: number
    expectedRemaining: number; paymentTotals: Array<{ code: string; amount: number }>
    digitalTransactions: number; verifiedProofs: number; missingProofs: number
  }
  paperRecords: PaperRecord[]
  faultyRecords: PaperRecord[]
  timeline: TimelineEvent[]
}
