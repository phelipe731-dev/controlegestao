import clsx from 'clsx'
import { statusLabel } from '../lib/format'

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        value === 'ACTIVE' && 'bg-teal/10 text-teal',
        value === 'INACTIVE' && 'bg-slate-200 text-slate-700',
        value === 'ARCHIVED' && 'bg-amber/15 text-amber',
        value === 'ANONYMIZED' && 'bg-rose/10 text-rose',
      )}
    >
      {statusLabel(value)}
    </span>
  )
}
