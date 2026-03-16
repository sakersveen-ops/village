// src/lib/sliderFill.ts
// Call this on mount + oninput for all range sliders so the
// glass gradient tracks the thumb position correctly.
//
// Usage:
//   import { initSlider, updateSlider } from '@/lib/sliderFill'
//   useEffect(() => initSlider(sliderRef.current), [])
//   <input onInput={(e) => updateSlider(e.currentTarget)} ... />

export function updateSlider(el: HTMLInputElement) {
  const min = Number(el.min) || 0
  const max = Number(el.max) || 100
  const val = Number(el.value)
  const pct = ((val - min) / (max - min)) * 100
  el.style.setProperty('--slider-val', `${pct}%`)
}

export function initSlider(el: HTMLInputElement | null) {
  if (!el) return
  updateSlider(el)
  el.addEventListener('input', () => updateSlider(el))
}

// If you want a React hook:
// import { useEffect, useRef } from 'react'
// export function useSliderFill() {
//   const ref = useRef<HTMLInputElement>(null)
//   useEffect(() => { initSlider(ref.current) }, [])
//   return ref
// }


/* ─── ItemCalendar.tsx patch notes ────────────────────────────
   In ItemCalendar.tsx, replace the outer wrapper div with:

   <div className="calendar-wrapper glass">
     ...existing content...
   </div>

   Replace day cell className logic — example for the day cell:

   function dayClass(day: string): string {
     const classes = ['cal-day']
     if (isPast(day))                    classes.push('past')
     else if (isActiveLoan(day))         classes.push('active-loan')
     else if (isPendingLoan(day))        classes.push('pending-loan')
     else if (isRequested(day))          classes.push('requested')
     else if (isBlocked(day))            classes.push('blocked')
     else if (day === selectStart)       classes.push('selected')
     else if (isInRange(day))            classes.push('in-range')
     else if (day === hoverRangeEnd)     classes.push('range-end')
     return classes.join(' ')
   }

   Replace nav month title:
   <h2 className="cal-month-title font-display">
     {format(currentMonth, 'MMMM yyyy', { locale: nb })}
   </h2>
──────────────────────────────────────────────────────────── */


/* ─── LoanThread.tsx patch notes ──────────────────────────────
   System messages:
   <div className="flex justify-center my-2">
     <span className="system-message-pill">{msg.body}</span>
   </div>

   Theirs bubble:
   <div className="bubble-theirs">{msg.body}</div>

   Mine bubble:
   <div className="bubble-mine">{msg.body}</div>

   Proposal card:
   <div className="proposal-card">...</div>
──────────────────────────────────────────────────────────── */


/* ─── layout.tsx / BottomNav patch notes ──────────────────────
   <nav className="bottom-nav glass">
     {items.map(item => (
       <button
         key={item.href}
         className={`nav-item ${pathname === item.href ? 'active' : ''}`}
         onClick={() => router.push(item.href)}
       >
         <span className="nav-icon">{item.icon}</span>
         <span className="nav-label">{item.label}</span>
       </button>
     ))}
   </nav>
   <div className="nav-spacer" />

   Add to <head> in layout.tsx for Google Fonts:
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
   <link
     href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap"
     rel="stylesheet"
   />
──────────────────────────────────────────────────────────── */
