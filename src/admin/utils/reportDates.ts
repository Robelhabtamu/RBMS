import { getRedBoothBusinessDate } from '../../shared/utils/businessDate'
const parse=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))}
const iso=(date:Date)=>date.toISOString().slice(0,10)
export function addReportDays(value:string,days:number){const date=parse(value);date.setUTCDate(date.getUTCDate()+days);return iso(date)}
export function startOfReportWeek(value=getRedBoothBusinessDate()){const date=parse(value);const day=date.getUTCDay();return addReportDays(value,-(day===0?6:day-1))}
export function endOfReportWeek(value:string){return addReportDays(value,6)}
export function monthRange(value=getRedBoothBusinessDate()){const [year,month]=value.slice(0,7).split('-').map(Number);return {from:`${year}-${String(month).padStart(2,'0')}-01`,to:iso(new Date(Date.UTC(year,month,0)))}}
export function previousMonthRange(value:string){const [year,month]=value.slice(0,7).split('-').map(Number);return monthRange(iso(new Date(Date.UTC(year,month-2,1))))}
export function formatReportDate(value:string,options?:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric',...options}).format(parse(value))}
