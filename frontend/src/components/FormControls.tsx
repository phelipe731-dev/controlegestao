import clsx from 'clsx'

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="label-base">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-rose">{error}</span> : null}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...props} className={clsx('field-base', props.className)} />
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('field-base', props.className)} />
}

export function TextAreaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('field-base min-h-28', props.className)} />
}

export function CheckboxInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal" />
}
