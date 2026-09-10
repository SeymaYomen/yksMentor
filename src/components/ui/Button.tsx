import React from 'react'
import Spinner from './Spinner'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export default function Button({ variant = 'primary', className = '', loading = false, children, ...props }: Props & { children?: React.ReactNode }) {
  const base = 'inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none'
  const styles = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm', secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50', ghost: 'text-indigo-700 hover:bg-indigo-50', danger: 'bg-red-600 text-white hover:bg-red-700' }[variant]
  return (
    <button type="button" className={`${base} ${styles} ${className}`.trim()} {...props} disabled={loading || props.disabled} aria-busy={loading}>
      {loading && <Spinner size={16} />}{children}
    </button>
  )
}
