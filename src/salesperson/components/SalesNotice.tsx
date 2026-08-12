type SalesNoticeProps = { tone?: 'error' | 'warning' | 'success'; children: React.ReactNode }

export function SalesNotice({ tone = 'error', children }: SalesNoticeProps) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-800'
    : tone === 'warning'
      ? 'border-orange-200 bg-orange-50 text-orange-800'
      : 'border-red-200 bg-red-50 text-red-800'
  return <div className={`rounded-xl border p-3 text-sm leading-5 ${styles}`} role="status">{children}</div>
}
