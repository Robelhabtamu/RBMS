import { useReport } from './useReport'
import type { ReportFilters } from '../types/reports'
export const useMonthlyReport=(filters:ReportFilters)=>useReport(filters)
