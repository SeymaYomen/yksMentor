export function formatNumber(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
export const formatPercent = (value: number | null) => value == null ? '—' : `%${formatNumber(value, 0)}`
export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Tarih belirtilmedi' : new Intl.DateTimeFormat('tr-TR', options).format(date)
}
export function meetingCountdown(value: string, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tarih belirtilmedi'
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((day(date) - day(now)) / 86400000)
  return days === 0 ? 'Bugün' : days > 0 ? `${days} gün kaldı` : 'Tarih geçti'
}
