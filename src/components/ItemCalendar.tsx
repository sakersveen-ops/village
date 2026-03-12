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
  const [selectStart, setSelectStart] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]
  const today = toDateStr(new Date())

  const isBlocked = (dateStr: string) => blockedDates.includes(dateStr)

  // Separate active vs pending loans for different colours
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

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FAF7F2] text-[#6B4226]">←</button>
        <p className="font-semibold text-[#2C1A0E] capitalize">{monthName}</p>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FAF7F2] text-[#6B4226]">→</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
          <div key={d} className="text-center text-xs text-[#9C7B65] font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />
          const past = isPast(dateStr)
          const active = isActiveLoan(dateStr)
          const pending = isPendingLoan(dateStr)
          const blocked = isBlocked(dateStr)
          const requested = isRequested(dateStr)
          const inRange = isInSelectRange(dateStr)
          const isStart = dateStr === selectStart
          const isToday = dateStr === today

          let bg = ''
          let text = 'text-[#2C1A0E]'
          let cursor = 'cursor-pointer'

          if (past) {
            text = 'text-[#D0C4B8]'; cursor = 'cursor-default'
          } else if (active) {
            // Confirmed loan – red
            bg = 'bg-red-100'; text = 'text-red-400'; cursor = 'cursor-default'
          } else if (pending) {
            // Pending/awaiting confirmation – amber
            bg = 'bg-amber-100'; text = 'text-amber-600'; cursor = 'cursor-default'
          } else if (requested) {
            // Borrower's own pending request – yellow
            bg = 'bg-[#FDE68A]'; text = 'text-[#92400E]'; cursor = 'cursor-default'
          } else if (blocked) {
            bg = 'bg-[#E8DDD0]'; text = 'text-[#9C7B65]'
          } else if (isStart) {
            bg = 'bg-[#C4673A]'; text = 'text-white'
          } else if (inRange) {
            bg = 'bg-[#FFF0E6]'; text = 'text-[#C4673A]'
          }

          return (
            <div
              key={dateStr}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => !isOwner && selectStart && setHover(dateStr)}
              className={`relative flex items-center justify-center h-8 rounded-lg text-xs font-medium ${bg} ${text} ${cursor} transition-colors`}
            >
              {dateStr.split('-')[2].replace(/^0/, '')}
              {isToday && !past && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#C4673A]" />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100" />
          <span className="text-xs text-[#9C7B65]">Utlånt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100" />
          <span className="text-xs text-[#9C7B65]">Venter bekreftelse</span>
        </div>
        {requestedRange && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#FDE68A]" />
            <span className="text-xs text-[#9C7B65]">Forespurt</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#E8DDD0]" />
          <span className="text-xs text-[#9C7B65]">Blokkert</span>
        </div>
        {!isOwner && !requestedRange && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#FFF0E6]" />
            <span className="text-xs text-[#9C7B65]">
              {selectStart ? 'Trykk på sluttdato' : 'Trykk på startdato'}
            </span>
          </div>
        )}
        {isOwner && <p className="text-xs text-[#9C7B65] ml-auto">Trykk for å blokkere/åpne</p>}
      </div>
    </div>
  )
}
