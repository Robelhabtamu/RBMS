import { useReport } from './useReport'
import type { ReportFilters } from '../types/reports'
export const useWeeklyReport=(filters:ReportFilters)=>useReport(filters)
