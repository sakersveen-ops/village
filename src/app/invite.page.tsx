'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InvitePage() {
  const [user, setUser] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
    })
  }, [])

  const inviteUrl = user ? `${window.location.origin}/join/${user.id}` : ''

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-8">
      <button onClick={() => router.back()} className="text-[#C4673A] mb-6">← Tilbake</button>
      <h1 className="text-2xl font-bold text-[#2C1A0E] mb-2">Inviter venner</h1>
      <p className="text-[#9C7B65] mb-8">Del lenken under – når noen klikker den blir dere koblet som venner.</p>

      {user && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-[#9C7B65] mb-2">Din invitasjonslenke</p>
          <p className="text-[#2C1A0E] text-sm break-all mb-4 bg-[#FAF7F2] rounded-xl p-3">{inviteUrl}</p>
          <button
            onClick={copy}
            className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium"
          >
            {copied ? '✓ Kopiert!' : 'Kopier lenke'}
          </button>
        </div>
      )}
    </div>
  )
}
