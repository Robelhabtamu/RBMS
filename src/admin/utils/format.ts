export function formatAdminEtb(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} ETB`
}
