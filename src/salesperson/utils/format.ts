export function formatEtb(amount: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ETB`
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
