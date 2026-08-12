export type AdminDashboardFilters = { businessDate: string; locationId: string }

export type DashboardKpis = {
  revenue: number
  printsSold: number
  transactions: number
  balancedBooths: number
}

export type BoothDashboardStatus = {
  boothId: string
  boothName: string
  locationName: string
  salespersonName: string | null
  state: 'OPEN' | 'CLOSED' | 'CLOSED_WITH_DISCREPANCY' | 'PENDING_REVIEW' | 'NOT_STARTED'
  revenue: number
  printsSold: number
  paperLabel: string
  attention: 'healthy' | 'warning' | 'serious'
}

export type DashboardAlert = {
  id: string
  message: string
  severity: 'warning' | 'serious'
  boothId?: string
}

export type PaymentTotal = { code: string; label: string; amount: number }
export type DashboardLocation = { id: string; name: string }

export type AdminDashboardData = {
  locations: DashboardLocation[]
  kpis: DashboardKpis
  booths: BoothDashboardStatus[]
  paymentTotals: PaymentTotal[]
  alerts: DashboardAlert[]
}
