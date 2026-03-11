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
        .select(`
          *,
          loans(
            item_id,
            items(name),
            community_id,
            communities(name, avatar_emoji)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setNotifications(data || [])

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setLoading(false)
    }
    load()
  }, [])

  const icon = (type: string) => {
    if (type === 'loan_request') return '📬'
    if (type === 'loan_accepted') return '✅'
    if (type === 'loan_declined') return '❌'
    if (type === 'friend_request') return '👋'
    if (type === 'join_request') return '🏘️'
    return '🔔'
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('no-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const linkFor = (n: any) => {
    if (n.type === 'friend_request') return '/profile'
    if (n.type === 'join_request') return `/community/${n.loans?.community_id || ''}`
    if (n.loans?.item_id) return `/items/${n.loans.item_id}`
    return '#'
  }

  const groupByDate = (notifications: any[]) => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const groups: Record<string, any[]> = {}

    for (const n of notifications) {
      const d = new Date(n.created_at).toDateString()
      const label = d === today ? 'I dag' : d === yesterday ? 'I går' : new Date(n.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' })
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    }
    return groups
  }

  const groups = groupByDate(notifications)

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <h1 className="text-xl font-bold text-[#2C1A0E]">Varsler</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
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
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">{label}</p>
              <div className="flex flex-col gap-2">
                {items.map(n => (
                  <Link key={n.id} href={linkFor(n)}>
                    <div className={`bg-white rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm ${!n.read ? 'border-l-4 border-[#C4673A]' : ''}`}>
                      <span className="text-xl mt-0.5 flex-shrink-0">{icon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2C1A0E] text-sm">{n.title}</p>
                        <p className="text-xs text-[#9C7B65] mt-0.5">{n.body}</p>

                        {/* Community-info på låneforespørsler */}
                        {n.type === 'loan_request' && n.loans?.communities && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs">{n.loans.communities.avatar_emoji}</span>
                            <span className="text-xs text-[#C4673A] font-medium">
                              Funnet via {n.loans.communities.name}
                            </span>
                          </div>
                        )}

                        {/* Gjenstandsnavn */}
                        {n.loans?.items?.name && (
                          <p className="text-xs text-[#9C7B65] mt-0.5 italic">
                            {n.loans.items.name}
                          </p>
                        )}

                        <p className="text-xs text-[#9C7B65] mt-1">{formatDate(n.created_at)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#C4673A] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}