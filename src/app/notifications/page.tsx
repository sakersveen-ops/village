'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*, loans(item_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])

      // Marker alle som lest
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      setLoading(false)
    }
    load()
  }, [])

  const icon = (type: string) => {
    if (type === 'loan_request') return '📬'
    if (type === 'loan_accepted') return '✅'
    if (type === 'loan_declined') return '❌'
    return '🔔'
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <h1 className="text-xl font-bold text-[#2C1A0E]">Varsler</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />
          ))
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-[#9C7B65]">
            <div className="text-4xl mb-2">🔔</div>
            <p>Ingen varsler ennå</p>
          </div>
        ) : (
          notifications.map(n => (
            <Link key={n.id} href={n.loans?.item_id ? `/items/${n.loans.item_id}` : '#'}>
              <div className={`bg-white rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm ${!n.read ? 'border-l-4 border-[#C4673A]' : ''}`}>
                <span className="text-xl mt-0.5">{icon(n.type)}</span>
                <div className="flex-1">
                  <p className="font-medium text-[#2C1A0E] text-sm">{n.title}</p>
                  <p className="text-xs text-[#9C7B65] mt-0.5">{n.body}</p>
                  <p className="text-xs text-[#9C7B65] mt-1">{new Date(n.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}