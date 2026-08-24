const formatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
})

export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return formatter.format(amount)
}
