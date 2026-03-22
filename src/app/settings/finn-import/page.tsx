'use client'

import { useRouter } from 'next/navigation'
import FinnImporter from '@/components/FinnImporter'

export default function FinnImportPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #FFF8F3)', padding: '0 0 24px' }}>
      {/* Page header */}
      <div className="page-header glass" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', color: 'var(--terra)' }}
          aria-label="Tilbake"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="page-header-title font-display">finn.no-import</h1>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ padding: '20px 16px' }}>
        <FinnImporter
          onImported={(count) => {
            // Navigate to profile/items after successful import
            setTimeout(() => router.push('/'), 1200)
          }}
        />
      </div>

      <div className="nav-spacer" />
    </div>
  )
}