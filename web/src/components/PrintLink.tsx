import { Link } from 'react-router-dom'

export function PrintLink({
  type,
  id,
  label = 'PDF',
}: {
  type: string
  id: string
  label?: string
}) {
  return (
    <Link
      className="btn btn-secondary"
      to={`/print/${type}/${id}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open printable view — use Print / Save as PDF"
    >
      {label}
    </Link>
  )
}
