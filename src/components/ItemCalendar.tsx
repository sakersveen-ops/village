'use client'
import { useState } from 'react'

type Props = {
  loans: { start_date: string; due_date: string; status: string }[]
  blockedDates: string[]
  requestedRange?: { start: string; end: string } | null
  onToggleBlock?: (date: string) => void
  onSelectRange?: (start: string, end: string) => void
  isOwner: boolean
}

export default function ItemCalendar({ loans, blockedDates, requestedRange, onToggleBlock, onSelectRange, isOwner }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectStart, setSelectStart]   = useState<string | null>(null)
  const [hover, setHover]               = useState<string | null>(null)

  const year        = currentMonth.getFullYear()
  const month       = currentMonth.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]
  const today     = toDateStr(new Date())

  const isActiveLoan = (dateStr: string) =>
    loans.some(loan => {
      if (!loan.start_date || loan.status !== 'active') return false
      const end = loan.due_date || loan.start_date
      return dateStr >= loan.start_date && dateStr <= end
    })

  const isPendingLoan = (dateStr: string) =>
    loans.some(loan => {
      if (!loan.start_date || !['pending', 'change_proposed'].includes(loan.status)) return false
      const end = loan.due_date || loan.start_date
      return dateStr >= loan.start_date && dateStr <= end
    })

  const isRequested = (dateStr: string) => {
    if (!requestedRange) return false
    return dateStr >= requestedRange.start && dateStr <= requestedRange.end
  }

  const isInSelectRange = (dateStr: string) => {
    if (!selectStart) return false
    const end = hover || selectStart
    const [a, b] = selectStart <= end ? [selectStart, end] : [end, selectStart]
    return dateStr >= a && dateStr <= b
  }

  const isPast = (dateStr: string) => dateStr < today

  const handleDayClick = (dateStr: string) => {
    if (isPast(dateStr)) return
    if (isOwner && onToggleBlock) { onToggleBlock(dateStr); return }
    if (!isOwner && onSelectRange) {
      if (!selectStart) {
        setSelectStart(dateStr)
      } else {
        const [a, b] = selectStart <= dateStr ? [selectStart, dateStr] : [dateStr, selectStart]
        onSelectRange(a, b)
        setSelectStart(null)
        setHover(null)
      }
    }
  }

  const monthName = currentMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })

  const days: (string | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(toDateStr(new Date(year, month, i)))

  const selectionHint = !isOwner && onSelectRange
    ? (selectStart ? 'Klikk på sluttdato' : 'Klikk på startdato')
    : null

  // Day class logic per design system §5
  const getDayClass = (dateStr: string): string => {
    const base = 'cal-day'
    if (isPast(dateStr))                             return `${base} past`
    if (isActiveLoan(dateStr))                       return `${base} active-loan`
    if (isPendingLoan(dateStr))                      return `${base} pending-loan`
    if (isRequested(dateStr))                        return `${base} requested`
    if (blockedDates.includes(dateStr))              return `${base} blocked`
    if (dateStr === selectStart)                     return `${base} selected`
    if (isInSelectRange(dateStr))                    return `${base} in-range`
    return base
  }

  return (
    <div className="calendar-wrapper glass">

      {/* Header with hint for borrowers */}
      <div className="mb-2">
        <p className="text-sm font-medium" style={{ color: 'var(--terra-dark)' }}>Tilgjengelighet</p>
        {selectionHint && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{selectionHint}</p>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))}
          className="btn-glass" style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        <h2 className="cal-month-title font-display capitalize">{monthName}</h2>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))}
          className="btn-glass" style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          →
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--terra-mid)' }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />
          const isToday = dateStr === today
          const past    = isPast(dateStr)

          return (
            <div
              key={dateStr}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => !isOwner && selectStart && setHover(dateStr)}
              className={`${getDayClass(dateStr)} ${isToday && !past ? 'ring-2 ring-offset-1' : ''}`}
              style={isToday && !past ? { '--tw-ring-color': 'var(--terra)' } as React.CSSProperties : {}}
            >
              {dateStr.split('-')[2].replace(/^0/, '')}
            </div>
          )
        })}
      </div>

      {/* Legend — 12px filled circles, 12px text, jevnt spacing */}
      <div className="flex gap-4 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="rounded-full flex-shrink-0" style={{ width: 12, height: 12, background: 'rgba(239,68,68,0.25)' }} />
          <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>Utlånt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-full flex-shrink-0" style={{ width: 12, height: 12, background: 'rgba(245,158,11,0.3)' }} />
          <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>Venter bekreftelse</span>
        </div>
        {requestedRange && (
          <div className="flex items-center gap-1.5">
            <div className="rounded-full flex-shrink-0" style={{ width: 12, height: 12, background: '#FDE68A' }} />
            <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>Forespurt</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="rounded-full flex-shrink-0" style={{ width: 12, height: 12, background: 'rgba(196,103,58,0.2)' }} />
          <span style={{ fontSize: 12, color: 'var(--terra-mid)' }}>Blokkert</span>
        </div>
        {/* "Trykk for å blokkere/åpne" kun for eier */}
        {isOwner && (
          <p className="ml-auto" style={{ fontSize: 12, color: 'var(--terra-mid)' }}>Trykk for å blokkere/åpne</p>
        )}
      </div>
    </div>
  )
}
