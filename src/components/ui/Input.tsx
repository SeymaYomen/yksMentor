import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function Input(props: Props) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-50/50 hover:bg-gray-50 transition-colors ${props.className || ''}`}
    />
  )
}
