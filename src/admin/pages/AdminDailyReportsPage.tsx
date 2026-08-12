import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
import { Attention, BoothTable, Drilldowns, HealthSections, MoneySections, ReportFilters, ReportHeader, SummaryCards } from '../components/ReportComponents'
import { useDailyReport } from '../hooks/useDailyReport'
import { getReportOptions } from '../services/adminReportsService'
import type { ReportOptions } from '../types/reports'
import { formatReportDate } from '../utils/reportDates'

const empty:ReportOptions={locations:[],booths:[]}
export function AdminDailyReportsPage(){const [params,setParams]=useSearchParams();const [date,setDate]=useState(params.get('date')??getRedBoothBusinessDate());const [locationId,setLocation]=useState(params.get('location')??'');const [boothId,setBooth]=useState(params.get('booth')??'');const [options,setOptions]=useState(empty);const filters=useMemo(()=>({dateFrom:date,dateTo:date,locationId,boothId}),[date,locationId,boothId]);const {report,loading,error}=useDailyReport(filters);useEffect(()=>{void getReportOptions().then(setOptions)},[]);useEffect(()=>{const next:Record<string,string>={date};if(locationId)next.location=locationId;if(boothId)next.booth=boothId;setParams(next,{replace:true})},[date,locationId,boothId,setParams]);return <div className="mx-auto max-w-[1500px]"><ReportHeader title="Daily Report" subtitle="Detailed summary of RedBooth operations for one business day." period={formatReportDate(date)}/><ReportFilters options={options} locationId={locationId} boothId={boothId} onLocation={setLocation} onBooth={setBooth}><label className="min-w-48 flex-1 text-xs font-semibold">Business Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm"/></label></ReportFilters>{loading?<LoadingState label="Loading daily report"/>:error||!report?<p className="mt-6 rounded-2xl border bg-white p-10 text-center font-semibold text-red-700">Unable to load report.</p>:<><SummaryCards report={report}/><MoneySections report={report}/><HealthSections report={report}/><BoothTable report={report} daily/><Attention report={report}/><Drilldowns {...filters}/></>}</div>}
