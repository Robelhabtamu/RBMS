import { useReport } from './useReport'
import type { ReportFilters } from '../types/reports'
export const useDailyReport=(filters:ReportFilters)=>useReport(filters)
