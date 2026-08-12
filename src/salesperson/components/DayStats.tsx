import type { BusinessDay, DayTotals } from '../types'
import { formatEtb } from '../utils/format'

export function DayStats({ day, totals }: { day: BusinessDay; totals: DayTotals }) {
  const stats = [
    ['Transactions', totals.total_transactions],
    ['Prints sold', totals.sold_print_count],
    ['Revenue', formatEtb(totals.revenue_total)],
    ['Paper estimate', totals.expected_remaining_paper],
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
        </div>
      ))}
      <span className="sr-only">Day {day.status}</span>
    </div>
  )
}
