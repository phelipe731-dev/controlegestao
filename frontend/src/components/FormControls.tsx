import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label-base">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose">{error}</span> : null}
    </label>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  function TextInput(props, ref) {
  const { error, className, ...rest } = props
  return (
    <input
      {...rest}
      ref={ref}
      className={clsx('field-base', error && 'border-rose focus:border-rose focus:ring-rose/20', className)}
    />
  )
  },
)

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput(props, ref) {
    return <select {...props} ref={ref} className={clsx('field-base', props.className)} />
  },
)

export const TextAreaInput = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaInput(props, ref) {
    return <textarea {...props} ref={ref} className={clsx('field-base min-h-28 resize-y', props.className)} />
  },
)

export const CheckboxInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CheckboxInput(props, ref) {
  return (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-teal accent-teal focus:ring-teal focus:ring-offset-0"
    />
  )
  },
)
