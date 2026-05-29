// Path: src/components/ShareButton.tsx
'use client'
import { useState } from 'react'
import { track, Events } from '@/lib/track'

type ShareVariant = 'own-profile' | 'other-profile' | 'item' | 'community'

interface ShareButtonProps {
  variant: ShareVariant
  profileName?: string
  profileUsername?: string
  profileId?: string
  itemName?: string
  itemId?: string
  communityName?: string
  communityId?: string
  className?: string
  style?: React.CSSProperties
  label?: string
}

const BASE = 'https://village-jade.vercel.app'

function buildUrl(props: ShareButtonProps): string {
  if (props.variant === 'own-profile' || props.variant === 'other-profile') {
    if (props.profileUsername) return `${BASE}/profiles/${props.profileUsername}`
    return `${BASE}/p/profile/${props.profileId}`
  }
  if (props.variant === 'item') return `${BASE}/p/item/${props.itemId}`
  if (props.variant === 'community') return `${BASE}/p/community/${props.communityId}`
  return BASE
}

function buildText(props: ShareButtonProps, url: string): { title: string; text: string } {
  switch (props.variant) {
    case 'own-profile':
      return {
        title: 'Min Village-profil',
        text: `Hei! Jeg bruker Village til å dele tingene mine med venner og familie. Legg meg til som venn da vel!\n\nMin profil: ${url}\n\nVennlig hilsen ${props.profileName || 'meg'}`,
      }
    case 'other-profile':
      return {
        title: `${props.profileName} på Village`,
        text: `Hei, sjekk ut ${props.profileName} sin profil på Village: ${url}`,
      }
    case 'item':
      return {
        title: `${props.itemName} på Village`,
        text: `Hei, sjekk ut ${props.itemName} på Village, plattformen der man enkelt kan dele ting med venner og familie!\n\n${url}`,
      }
    case 'community':
      return {
        title: `${props.communityName} på Village`,
        text: `Hei, sjekk ut ${props.communityName} på Village, der du kan låne og låne ut ting enkelt!\n\n${url}`,
      }
  }
}

export default function ShareLinkButton(props: ShareButtonProps) {
  const [toast, setToast] = useState<string | null>(null)

  const handleShare = async () => {
    const url = buildUrl(props)
    const { title, text } = buildText(props, url)

    if (props.variant === 'own-profile' || props.variant === 'other-profile') {
      track(Events.PROFILE_SHARED, { profile_id: props.profileId })
    } else if (props.variant === 'item') {
      track(Events.ITEM_SHARED, { item_id: props.itemId })
    } else if (props.variant === 'community') {
      track(Events.COMMUNITY_SHARED, { community_id: props.communityId })
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, text, url }); return } catch { return }
    }
    try {
      await navigator.clipboard.writeText(url)
      setToast('Lenke kopiert!')
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('Kunne ikke kopiere')
      setTimeout(() => setToast(null), 2500)
    }
  }

  const defaultStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(46,98,113,0.10)',
    border: '1px solid rgba(46,98,113,0.15)',
    color: 'var(--terra-dark)',
    cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleShare}
        aria-label="Del"
        className={props.className}
        style={props.className ? props.style : { ...defaultStyle, ...props.style }}
      >
        {props.label ?? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        )}
      </button>
      {toast && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--terra-dark)', color: '#fff',
          fontSize: 12, fontWeight: 500, padding: '5px 10px',
          borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
