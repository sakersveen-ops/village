'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CommunitiesPage() {
  const [user, setUser] = useState<any>(null)
  const [myCommunities, setMyCommunities] = useState<any[]>([])
  const [friendCommunities, setFriendCommunities] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Mine communities
      const { data: mine } = await supabase
        .from('community_members')
        .select('role, status, communities(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
      setMyCommunities(mine || [])

      // Venners communities (public)
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b')
        .eq('user_a', user.id)

      const friendIds = (friendships || []).map((f: any) => f.user_b)

      if (friendIds.length > 0) {
        const { data: friendMembers } = await supabase
          .from('community_members')
          .select('communities(*), profiles(name, email)')
          .in('user_id', friendIds)
          .eq('status', 'active')

        // Filtrer ut communities man allerede er med i og duplikater
        const myIds = new Set((mine || []).map((m: any) => m.communities?.id))
        const seen = new Set<string>()
        const unique = (friendMembers || []).filter((m: any) => {
          const cid = m.communities?.id
          if (!cid || myIds.has(cid) || seen.has(cid) || !m.communities?.is_public) return false
          seen.add(cid)
          return true
        })
        setFriendCommunities(unique)
      }

      setLoading(false)
    }
    load()
  }, [])

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('communities')
      .select('*')
      .ilike('name', `%${q}%`)
      .eq('is_public', true)
      .limit(10)
    setSearchResults(data || [])
  }

  const CommunityCard = ({ community, role, status }: { community: any, role?: string, status?: string }) => (
    <Link href={`/community/${community.id}`}>
      <div className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] flex items-center justify-center text-2xl flex-shrink-0">
          {community.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#2C1A0E] truncate">{community.name}</p>
            {!community.is_public && <span className="text-xs bg-[#E8DDD0] text-[#6B4226] px-2 py-0.5 rounded-full flex-shrink-0">Privat</span>}
          </div>
          {community.description && (
            <p className="text-xs text-[#9C7B65] mt-0.5 truncate">{community.description}</p>
          )}
          {role && (
            <p className="text-xs mt-0.5">
              {status === 'pending'
                ? <span className="text-[#C4673A]">⏳ Venter på godkjenning</span>
                : <span className="text-[#4A7C59]">{role === 'admin' ? '⭐ Admin' : 'Medlem'}</span>
              }
            </p>
          )}
        </div>
        <span className="text-[#C4673A] text-sm flex-shrink-0">→</span>
      </div>
    </Link>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E8DDD0] px-4 pt-10 pb-4 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[#2C1A0E]">Kretser</h1>
          <Link href="/community/new">
            <button className="text-sm text-[#C4673A] font-medium border border-[#C4673A] rounded-full px-3 py-1.5">
              + Ny krets
            </button>
          </Link>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
          <input
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="Søk på navn…"
            className="w-full bg-white border border-[#E8DDD0] rounded-xl pl-10 pr-4 py-2.5 text-[#2C1A0E] outline-none focus:border-[#C4673A] text-sm"
          />
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-6">

        {/* Søkeresultater */}
        {query.length >= 2 && (
          <div>
            <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">Søkeresultater</p>
            {searchResults.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 text-center text-sm text-[#9C7B65]">
                Ingen treff på "{query}"
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {searchResults.map(c => <CommunityCard key={c.id} community={c} />)}
              </div>
            )}
          </div>
        )}

        {/* Mine kretser */}
        {!query && (
          <>
            <div>
              <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">
                Mine kretser {myCommunities.length > 0 && `(${myCommunities.length})`}
              </p>
              {loading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
                </div>
              ) : myCommunities.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 text-center text-sm text-[#9C7B65]">
                  Du er ikke med i noen kretser ennå
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {myCommunities.map((m: any) => (
                    <CommunityCard
                      key={m.communities?.id}
                      community={m.communities}
                      role={m.role}
                      status={m.status}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Venners kretser */}
            {friendCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">
                  Utforsk kretser — venner er med
                </p>
                <div className="flex flex-col gap-2">
                  {friendCommunities.map((m: any) => (
                    <CommunityCard key={m.communities?.id} community={m.communities} />
                  ))}
                </div>
              </div>
            )}

            {/* Opprett ny */}
            <Link href="/community/new">
              <div className="bg-[#C4673A] rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">Start en ny krets</p>
                  <p className="text-white/70 text-sm mt-0.5">For nabolaget, vennegjengen eller familien</p>
                </div>
                <span className="text-white text-xl">→</span>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}