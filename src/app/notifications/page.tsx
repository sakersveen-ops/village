'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ACTION_TYPES = ['loan_request', 'friend_request', 'join_request']

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [tab, setTab] = useState<'actions' | 'updates'>('actions')
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
    if (type === 'join_accepted') return '✅'
    if (type === 'join_declined') return '❌'
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
    if (n.type === 'join_request' && n.loans?.community_id) return `/community/${n.loans.community_id}`
    if (n.loans?.item_id) return `/items/${n.loans.item_id}`
    return '#'
  }

  const groupByDate = (list: any[]) => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const groups: Record<string, any[]> = {}
    for (const n of list) {
      const d = new Date(n.created_at).toDateString()
      const label = d === today ? 'I dag'
        : d === yesterday ? 'I går'
        : new Date(n.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' })
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    }
    return groups
  }

  const actions = notifications.filter(n => ACTION_TYPES.includes(n.type))
  const updates = notifications.filter(n => !ACTION_TYPES.includes(n.type))
  const unreadActions = actions.filter(n => !n.read).length
  const unreadUpdates = updates.filter(n => !n.read).length

  const current = tab === 'actions' ? actions : updates
  const groups = groupByDate(current)

  const NotifCard = ({ n }: { n: any }) => (
    <Link href={linkFor(n)}>
      <div className={`bg-white rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm ${!n.read ? 'border-l-4 border-[#C4673A]' : ''}`}>
        <span className="text-xl mt-0.5 flex-shrink-0">{icon(n.type)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#2C1A0E] text-sm">{n.title}</p>
          <p className="text-xs text-[#9C7B65] mt-0.5">{n.body}</p>
          {n.type === 'loan_request' && n.loans?.communities && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs">{n.loans.communities.avatar_emoji}</span>
              <span className="text-xs text-[#C4673A] font-medium">
                Funnet via {n.loans.communities.name}
              </span>
            </div>
          )}
          {n.loans?.items?.name && (
            <p className="text-xs text-[#9C7B65] mt-0.5 italic">{n.loans.items.name}</p>
          )}
          <p className="text-xs text-[#9C7B65] mt-1">{formatDate(n.created_at)}</p>
        </div>
        {!n.read && (
          <div className="w-2 h-2 rounded-full bg-[#C4673A] flex-shrink-0 mt-1.5" />
        )}
      </div>
    </Link>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <h1 className="text-xl font-bold text-[#2C1A0E] mb-3">Varsler</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('actions')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tab === 'actions' ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
            }`}
          >
            Handlinger
            {unreadActions > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === 'actions' ? 'bg-white/20 text-white' : 'bg-[#FFF0E6] text-[#C4673A]'}`}>
                {unreadActions}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('updates')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tab === 'updates' ? 'bg-[#C4673A] text-white border-transparent' : 'bg-white text-[#6B4226] border-[#E8DDD0]'
            }`}
          >
            Oppdateringer
            {unreadUpdates > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === 'updates' ? 'bg-white/20 text-white' : 'bg-[#FFF0E6] text-[#C4673A]'}`}>
                {unreadUpdates}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />
          ))
        ) : current.length === 0 ? (
          <div className="text-center py-16 text-[#9C7B65]">
            <div className="text-4xl mb-2">{tab === 'actions' ? '✅' : '🔔'}</div>
            <p>{tab === 'actions' ? 'Ingen handlinger å gjøre' : 'Ingen oppdateringer'}</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">{label}</p>
              <div className="flex flex-col gap-2">
                {items.map(n => <NotifCard key={n.id} n={n} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}