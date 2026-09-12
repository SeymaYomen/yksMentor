import React, { useId, useState } from 'react'
import { filterGoalSuggestions, nextGoalOption } from '../../lib/goalSuggestions'
import { GOAL_FIELD_LIMITS } from '../../lib/goalProgress'
import Input from '../ui/Input'

export default function GoalAutocomplete({ label, value, onChange, options, onSelected }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  onSelected?: (selected: boolean) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = filterGoalSuggestions(options, value)
  const expanded = open && suggestions.length > 0

  function select(option: string) {
    onChange(option)
    onSelected?.(true)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>
      <Input id={id} className="mt-1" role="combobox" autoComplete="off"
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-list`}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        maxLength={GOAL_FIELD_LIMITS.textLength.max} value={value}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }}
        onChange={event => { onChange(event.target.value); onSelected?.(!event.target.value.trim()); setOpen(true); setActive(-1) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const index = nextGoalOption(expanded ? active : -1, suggestions.length, event.key === 'ArrowDown' ? 1 : -1)
            setActive(index)
            requestAnimationFrame(() => document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' }))
          } else if (event.key === 'Enter' && expanded) {
            event.preventDefault()
            if (active >= 0) select(suggestions[active])
            else setOpen(false)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            setActive(-1)
          }
        }} />
      {/* In-flow list remains inside narrow cards and scrollable forms without clipping. */}
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} önerileri`} hidden={!expanded}
        className="relative z-20 mt-1 max-h-48 w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {suggestions.map((option, index) => (
          <li key={option} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
            className={`min-h-11 cursor-pointer break-words rounded-lg px-3 py-3 text-sm text-slate-900 ${active === index ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
            onPointerDown={event => event.preventDefault()}
            onClick={() => select(option)}>{option}</li>
        ))}
      </ul>
    </div>
  )
}
