'use client'
import { useState } from 'react'

interface Props {
  url: string
  title?: string
}

export default function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const fullUrl = `https://village-jade.vercel.app${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title: title ?? 'Village', url: fullUrl })
      } catch { /* avbrutt */ }
    } else {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={share}
      aria-label="Del"
      className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
      style={{
        background: copied ? 'rgba(94,154,120,0.12)' : 'rgba(252,254,255,0.65)',
        border: '1px solid var(--glass-border)',
        color: copied ? 'var(--terra-green)' : 'var(--terra-mid)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      )}
    </button>
  )
}
