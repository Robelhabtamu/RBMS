import { useEffect, useState } from 'react'
import { getAdminReport } from '../services/adminReportsService'
import type { AdminReport, ReportFilters } from '../types/reports'
export function useReport(filters:ReportFilters){const [report,setReport]=useState<AdminReport|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);useEffect(()=>{let active=true;setLoading(true);setError(null);void getAdminReport(filters).then(v=>{if(active)setReport(v)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load report.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[filters]);return{report,loading,error}}
