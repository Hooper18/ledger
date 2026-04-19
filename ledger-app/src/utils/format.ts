export function formatExchangeRate(
  rate: number | null | undefined,
  mode: 'display' | 'export' | 'full'
): string {
  if (rate == null) return mode === 'export' ? '' : '-'
  if (mode === 'display') return rate.toFixed(4)
  if (mode === 'export') return rate.toFixed(8)
  return String(rate)
}
