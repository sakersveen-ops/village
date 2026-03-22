'use client'
import { useState } from 'react'

const APP_URL = 'https://village-jade.vercel.app'

function buildMessage(name: string, senderName: string, communityName?: string): string {
  const greeting = name.trim() ? `Hei ${name.trim()}! ` : 'Hei! '
  if (communityName) {
    return `${greeting}Jeg vil gjerne ha deg med i kretsen «${communityName}» på Village!\n\nPå Village deler vi gjenstander med venner og kretser, så det blir enkelt å låne og låne bort ting man ikke bruker til daglig.\n\nBli med her: ${APP_URL}\n\nHilsen ${senderName}`
  }
  return `${greeting}Jeg vil gjerne dele ting med deg!\n\nPå Village deler man gjenstander med venner og kretsene sine, så det blir enkelt å låne og låne bort ting når man ikke bruker dem. Jeg har allerede lagt ut noen ting du kanskje kan bruke.\n\nBli med her: ${APP_URL}\n\nHilsen ${senderName}`
}

export default function InviteComposer({
  senderName,
  communityName,
  onClose,
}: {
  senderName: string
  communityName?: string
  onClose: () => void
}) {
  const [recipientName, setRecipientName] = useState('')
  const [copied, setCopied] = useState(false)

  const message = buildMessage(recipientName, senderName, communityName)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: communityName
            ? `Bli med i «${communityName}» på Village!`
            : 'Bli med på Village – del ting med meg!',
          text: message,
          url: APP_URL,
        })
        onClose()
      } catch {
        // Bruker avbrøt
      }
    } else {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(44,26,14,0.6)' }}
      onClick={onClose}>
      <div className="glass-heavy w-full max-w-lg mx-auto"
        style={{ borderRadius: '24px 24px 0 0' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-8 flex flex-col gap-4">

          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--terra-dark)' }}>
              {communityName ? `Inviter til «${communityName}»` : 'Inviter en venn'}
            </h2>
            <button onClick={onClose} style={{ color: 'var(--terra-mid)' }}>✕</button>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>
              Hvem vil du invitere? (valgfritt)
            </label>
            <input
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="f.eks. Emma"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #E8DDD0', color: 'var(--terra-dark)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--terra)'}
              onBlur={e => e.currentTarget.style.borderColor = '#E8DDD0'}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--terra-mid)' }}>
              Melding
            </label>
            <textarea
              value={message}
              readOnly
              rows={communityName ? 6 : 7}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: '#FAF7F2',
                border: '1px solid #E8DDD0',
                color: 'var(--terra-dark)',
                lineHeight: 1.6,
              }}
            />
          </div>

          <button onClick={handleShare}
            className="btn-primary w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2">
            {canShare ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Del invitasjon
              </>
            ) : copied ? '✓ Kopiert!' : '📋 Kopiér melding'}
          </button>

        </div>
      </div>
    </div>
  )
}
