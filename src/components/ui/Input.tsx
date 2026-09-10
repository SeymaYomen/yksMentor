import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function Input(props: Props) {
  return (
    <input
      {...props}
      className={`min-w-0 w-full min-h-11 px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed aria-[invalid=true]:border-red-500 transition-colors ${props.className || ''}`}
    />
  )
}
