const map: Record<string, string> = {
  draft: 'chip-draft',
  submitted: 'chip-submitted',
  posted: 'chip-posted',
  converted: 'chip-success',
  delivered: 'chip-success',
  received: 'chip-success',
  partially_delivered: 'chip-warning',
  partially_received: 'chip-warning',
  cancelled: 'chip-danger',
  overdue: 'chip-danger',
}

export function StatusChip({ status }: { status: string }) {
  const cls = map[status] ?? 'chip-draft'
  return <span className={`chip ${cls}`}>{status.replaceAll('_', ' ')}</span>
}
