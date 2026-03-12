'use client'
import { useState } from 'react'

type Props = {
  loans: { start_date: string; due_date: string; status: string }[]
  blockedDates: string[]
  onToggleBlock?: (date: string) => void
  onSelectRange?: (start: string, end: string) => void
  isOwner: boolean
}

export default function ItemCalendar({ loans, blockedDates, onToggleBlock, onSelectRange, isOwner }: Props) {
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

  const isLoaned = (dateStr: string) => {
    return loans.some(loan => {
      if (!loan.start_date) return false
      const start = loan.start_date
      const end = loan.due_date || loan.start_date
      return dateStr >= start && dateStr <= end
    })
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
    if (isOwner && onToggleBlock) {
      onToggleBlock(dateStr)
      return
    }
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

  const days = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    days.push(toDateStr(d))
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FAF7F2] text-[#6B4226]"
        >←</button>
        <p className="font-semibold text-[#2C1A0E] capitalize">{monthName}</p>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FAF7F2] text-[#6B4226]"
        >→</button>
      </div>

      {/* Ukedager */}
      <div className="grid grid-cols-7 mb-1">
        {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
          <div key={d} className="text-center text-xs text-[#9C7B65] font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Dager */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />
          const past = isPast(dateStr)
          const loaned = isLoaned(dateStr)
          const blocked = isBlocked(dateStr)
          const inRange = isInSelectRange(dateStr)
          const isToday = dateStr === today
          const isStart = dateStr === selectStart

          let bg = ''
          let text = 'text-[#2C1A0E]'
          let cursor = 'cursor-pointer'

          if (past) { bg = ''; text = 'text-[#D0C4B8]'; cursor = 'cursor-default' }
          else if (loaned) { bg = 'bg-red-100'; text = 'text-red-400'; cursor = 'cursor-default' }
          else if (blocked) { bg = 'bg-[#E8DDD0]'; text = 'text-[#9C7B65]' }
          else if (isStart) { bg = 'bg-[#C4673A]'; text = 'text-white' }
          else if (inRange) { bg = 'bg-[#FFF0E6]'; text = 'text-[#C4673A]' }

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

      {/* Forklaring */}
      <div className="flex gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100" />
          <span className="text-xs text-[#9C7B65]">Utlånt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#E8DDD0]" />
          <span className="text-xs text-[#9C7B65]">Blokkert</span>
        </div>
        {!isOwner && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#FFF0E6]" />
            <span className="text-xs text-[#9C7B65]">Valgt periode</span>
          </div>
        )}
        {isOwner && (
          <p className="text-xs text-[#9C7B65] ml-auto">Trykk for å blokkere/åpne</p>
        )}
      </div>
    </div>
  )
}