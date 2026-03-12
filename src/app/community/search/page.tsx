'use client'
console.log('search page rendrer')
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CommunitiesPage() {
  const [user, setUser] = useState<any>(null)
  const [adminCommunities, setAdminCommunities] = useState<any[]>([])
  const [memberCommunities, setMemberCommunities] = useState<any[]>([])
  const [friendCommunities, setFriendCommunities] = useState<any[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [closeFriends, setCloseFriends] = useState<any[]>([])
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

      const { data: mine } = await supabase
        .from('community_members')
        .select('role, status, communities(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const admins = (mine || []).filter((m: any) => m.role === 'admin')
      const members = (mine || []).filter((m: any) => m.role === 'member')
      setAdminCommunities(admins)
      setMemberCommunities(members)

      const { data: favs } = await supabase
        .from('community_favorites')
        .select('community_id')
        .eq('user_id', user.id)
      setFavorites(new Set((favs || []).map((f: any) => f.community_id)))

      const { data: cf } = await supabase
        .from('close_friends')
        .select('friend_id, profiles!close_friends_friend_id_fkey(id, name, email, avatar_url)')
        .eq('user_id', user.id)
      setCloseFriends(cf || [])

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

  const toggleFavorite = async (communityId: string) => {
    const supabase = createClient()
    if (favorites.has(communityId)) {
      await supabase.from('community_favorites').delete()
        .eq('user_id', user.id).eq('community_id', communityId)
      setFavorites(prev => { const n = new Set(prev); n.delete(communityId); return n })
    } else {
      await supabase.from('community_favorites').insert({ user_id: user.id, community_id: communityId })
      setFavorites(prev => new Set([...prev, communityId]))
    }
  }

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

  const sortByFavorite = (list: any[]) =>
    [...list].sort((a, b) => {
      const aF = favorites.has(a.communities?.id) ? 0 : 1
      const bF = favorites.has(b.communities?.id) ? 0 : 1
      return aF - bF
    })

  const CommunityCard = ({ community, role, showFavorite = false }: {
    community: any, role?: string, showFavorite?: boolean
  }) => (
    <div className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm">
      <Link href={`/community/${community.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] flex items-center justify-center text-2xl flex-shrink-0">
          {community.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#2C1A0E] truncate">{community.name}</p>
            {!community.is_public && (
              <span className="text-xs bg-[#E8DDD0] text-[#6B4226] px-2 py-0.5 rounded-full flex-shrink-0">Privat</span>
            )}
          </div>
          {community.description && (
            <p className="text-xs text-[#9C7B65] mt-0.5 truncate">{community.description}</p>
          )}
          {role && (
            <p className="text-xs mt-0.5 text-[#4A7C59] font-medium">
              {role === 'admin' ? '⭐ Administrator' : 'Medlem'}
            </p>
          )}
        </div>
      </Link>
      {showFavorite && (
        <button
          onClick={() => toggleFavorite(community.id)}
          className={`text-lg flex-shrink-0 transition-transform active:scale-90 ${favorites.has(community.id) ? 'opacity-100' : 'opacity-25'}`}
        >
          ⭐
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">
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
              <div className="bg-white rounded-2xl p-5 text-center text-sm text-[#9C7B65]">Ingen treff</div>
            ) : (
              <div className="flex flex-col gap-2">
                {searchResults.map(c => {
                  const isMine = [...adminCommunities, ...memberCommunities].some((m: any) => m.communities?.id === c.id)
                  return (
                    <div key={c.id} className="relative">
                      <CommunityCard community={c} />
                      {isMine && (
                        <span className="absolute top-2 right-2 text-xs bg-[#EEF4F0] text-[#4A7C59] px-2 py-0.5 rounded-full font-medium">
                          Du er medlem
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!query && (
          <>
            {/* Nære venner */}
            <div className="bg-gradient-to-br from-[#FFF0E6] to-[#FAF7F2] rounded-3xl p-4 border border-[#E8DDD0]">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-bold text-[#2C1A0E]">❤️ Nære venner</p>
                  <p className="text-xs text-[#9C7B65] mt-0.5">{closeFriends.length} personer</p>
                </div>
                <Link href="/close-friends">
                  <button className="text-xs text-[#C4673A] border border-[#C4673A] rounded-full px-3 py-1">Rediger</button>
                </Link>
              </div>
              {closeFriends.length === 0 ? (
                <p className="text-sm text-[#9C7B65]">Legg til nære venner for å dele eksklusivt innhold</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {closeFriends.map((cf: any) => (
                    <div key={cf.friend_id} className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm">
                      <div className="w-6 h-6 rounded-full bg-[#E8DDD0] flex items-center justify-center text-xs font-bold text-[#6B4226] overflow-hidden">
                        {cf.profiles?.avatar_url
                          ? <img src={cf.profiles.avatar_url} className="w-full h-full object-cover" />
                          : (cf.profiles?.name || cf.profiles?.email)?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs text-[#2C1A0E] font-medium">
                        {cf.profiles?.name || cf.profiles?.email?.split('@')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kretser jeg administrerer */}
            {adminCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">
                  Jeg administrerer ({adminCommunities.length})
                </p>
                <div className="flex flex-col gap-2">
                  {sortByFavorite(adminCommunities).map((m: any) => (
                    <CommunityCard key={m.communities?.id} community={m.communities} role="admin" showFavorite />
                  ))}
                </div>
              </div>
            )}

            {/* Kretser jeg er medlem av */}
            {memberCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">
                  Jeg er med i ({memberCommunities.length})
                </p>
                <div className="flex flex-col gap-2">
                  {sortByFavorite(memberCommunities).map((m: any) => (
                    <CommunityCard key={m.communities?.id} community={m.communities} role="member" showFavorite />
                  ))}
                </div>
              </div>
            )}

            {/* Tom state */}
            {adminCommunities.length === 0 && memberCommunities.length === 0 && !loading && (
              <div className="bg-white rounded-2xl p-6 text-center text-[#9C7B65] text-sm">
                Du er ikke med i noen kretser ennå
              </div>
            )}

            {/* Venners kretser */}
            {friendCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-2">
                  Utforsk — venner er med
                </p>
                <div className="flex flex-col gap-2">
                  {friendCommunities.map((m: any) => (
                    <CommunityCard key={m.communities?.id} community={m.communities} />
                  ))}
                </div>
              </div>
            )}

            {/* Start ny */}
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