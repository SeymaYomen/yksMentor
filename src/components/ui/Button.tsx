import React from 'react'
import Spinner from './Spinner'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
  loading?: boolean
}

export default function Button({ variant = 'primary', className = '', loading = false, children, ...props }: Props & { children?: React.ReactNode }) {
  const base = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ease-out focus:ring-4 focus:outline-none focus:ring-blue-300 active:scale-95'
  const styles = variant === 'primary'
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:-translate-y-0.5'
    : 'bg-white/50 text-blue-600 hover:bg-white/80 hover:shadow-sm'
  return (
    <button className={`${base} ${styles} ${className}`.trim()} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={16} /> : children}
    </button>
  )
}
