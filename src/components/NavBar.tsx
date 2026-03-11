'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function NavBar() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnread(count || 0)
    }
    load()

    // Poll hvert 30 sek
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DDD0] flex justify-around items-center py-3 z-20">
      <Link href="/" className="flex flex-col items-center gap-1">
        <span className="text-xl">🏠</span>
        <span className="text-xs text-[#9C7B65]">Feed</span>
      </Link>
      <Link href="/community/search" className="flex flex-col items-center gap-1">
        <span className="text-xl">🏘️</span>
        <span className="text-xs text-[#9C7B65]">Kretser</span>
      </Link>
      <Link href="/add" className="flex flex-col items-center gap-1">
        <div className="w-10 h-10 rounded-full bg-[#C4673A] flex items-center justify-center border-4 border-white ring-2 ring-[#C4673A] -mt-5 shadow-lg">
          <span className="text-white font-bold text-xl leading-none">+</span>
        </div>
        <span className="text-xs text-[#9C7B65]">Legg ut</span>
      </Link>
      <Link href="/notifications" className="flex flex-col items-center gap-1 relative">
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#C4673A] text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <span className="text-xs text-[#9C7B65]">Varsler</span>
      </Link>
      <Link href="/profile" className="flex flex-col items-center gap-1">
        <span className="text-xl">👤</span>
        <span className="text-xs text-[#9C7B65]">Profil</span>
      </Link>
    </nav>
  )
}