'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track } from '@/lib/track'

export default function CommunitiesPage() {
  const [user, setUser] = useState<any>(null)
  const [adminCommunities, setAdminCommunities] = useState<any[]>([])
  const [memberCommunities, setMemberCommunities] = useState<any[]>([])
  const [friendCommunities, setFriendCommunities] = useState<any[]>([])
  const [popularCommunities, setPopularCommunities] = useState<any[]>([])
  const [hasFriends, setHasFriends] = useState(true)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterAdminOnly, setFilterAdminOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)
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

      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_b')
        .eq('user_a', user.id)
      const friendIds = (friendships || []).map((f: any) => f.user_b)
      setHasFriends(friendIds.length > 0)

      // Build set of community IDs the user is already a member of — used to exclude from friend/popular lists
      const myIds = new Set(
        (mine || [])
          .map((m: any) => m.communities?.id)
          .filter(Boolean)
      )

      if (friendIds.length > 0) {
        const { data: friendMembers } = await supabase
          .from('community_members')
          .select('communities(*)')
          .in('user_id', friendIds)
          .eq('status', 'active')

        const seen = new Set<string>()
        const unique = (friendMembers || []).filter((m: any) => {
          const cid = m.communities?.id
          // Exclude communities the user is already a member of
          if (!cid || myIds.has(cid) || seen.has(cid) || !m.communities?.is_public) return false
          seen.add(cid)
          return true
        })
        setFriendCommunities(unique)
      } else {
        // No friends — show popular public communities as fallback
        const { data: popular } = await supabase
          .from('communities')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(6)
        setPopularCommunities((popular || []).filter((c: any) => !myIds.has(c.id)))
      }

      setLoading(false)
      track('communities_page_viewed')
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

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
    setSearchResults([])
  }

  const sortByFavorite = (list: any[]) =>
    [...list].sort((a, b) => {
      const aF = favorites.has(a.communities?.id) ? 0 : 1
      const bF = favorites.has(b.communities?.id) ? 0 : 1
      return aF - bF
    })

  const allMyCommunities = [
    ...sortByFavorite(adminCommunities).map((m: any) => ({ ...m, derivedRole: 'admin' })),
    ...sortByFavorite(memberCommunities).map((m: any) => ({ ...m, derivedRole: 'member' })),
  ]
  const displayedCommunities = filterAdminOnly
    ? allMyCommunities.filter(m => m.derivedRole === 'admin')
    : allMyCommunities

  const CommunityCardGraphic = ({ entry, showFavorite = false }: { entry: any; showFavorite?: boolean }) => {
    const community = entry.communities || entry
    const isAdmin = entry.derivedRole === 'admin'

    // Cards WITH a cover photo — keep the image-dominant overlay style
    if (community.cover_image_url) {
      return (
        <Link href={`/community/${community.id}`}>
          <div className="relative overflow-hidden rounded-[20px] aspect-[4/3] cursor-pointer group"
            style={{ border: '1px solid rgba(196,103,58,0.18)', boxShadow: '0 2px 20px rgba(44,26,14,0.08)' }}>
            <img src={community.cover_image_url} alt={community.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(44,26,14,0.82) 0%, rgba(44,26,14,0.2) 55%, transparent 100%)' }} />
            {/* Top row */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div />
              <div className="flex items-center gap-1.5">
                {!community.is_public && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(255,248,243,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: 'var(--terra-dark)' }}>
                    🔒
                  </span>
                )}
                {showFavorite && (
                  <button onClick={e => { e.preventDefault(); toggleFavorite(community.id) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: 'rgba(255,248,243,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                    <span style={{ opacity: favorites.has(community.id) ? 1 : 0.4 }}>⭐</span>
                  </button>
                )}
              </div>
            </div>
            {/* Bottom text */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
              <p className="font-display text-white font-semibold truncate"
                style={{ fontSize: '15px', letterSpacing: '-0.02em', textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
                {community.name}
              </p>
              {community.description && (
                <p className="text-white/70 text-xs truncate mt-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  {community.description}
                </p>
              )}
              {isAdmin && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5"
                  style={{ background: 'rgba(196,103,58,0.85)', color: 'white' }}>
                  🔑 Admin
                </span>
              )}
            </div>
          </div>
        </Link>
      )
    }

    // Cards WITHOUT cover photo — glass-card pattern matching design system item cards
    return (
      <Link href={`/community/${community.id}`}>
        <div className="item-card glass-hover rounded-[20px] overflow-hidden cursor-pointer"
          style={{ border: '1px solid rgba(196,103,58,0.18)', boxShadow: '0 2px 16px rgba(44,26,14,0.06)' }}>
          {/* Emoji placeholder area */}
          <div className="relative flex items-center justify-center"
            style={{ height: '100px', background: 'linear-gradient(135deg, rgba(255,240,230,0.9) 0%, rgba(232,221,208,0.7) 100%)' }}>
            <span style={{ fontSize: '44px' }}>{community.avatar_emoji}</span>
            {/* Top-right badges */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {!community.is_public && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,248,243,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: 'var(--terra-dark)', fontSize: '11px' }}>
                  🔒
                </span>
              )}
              {showFavorite && (
                <button onClick={e => { e.preventDefault(); toggleFavorite(community.id) }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ background: 'rgba(255,248,243,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  <span style={{ fontSize: '13px', opacity: favorites.has(community.id) ? 1 : 0.35 }}>⭐</span>
                </button>
              )}
            </div>
          </div>
          {/* Text body — glass-card */}
          <div className="glass-card px-3 py-2.5">
            <p className="font-display font-semibold truncate"
              style={{ fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--terra-dark)' }}>
              {community.name}
            </p>
            {community.description && (
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--terra-mid)' }}>
                {community.description}
              </p>
            )}
            {isAdmin && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5"
                style={{ background: 'rgba(196,103,58,0.12)', color: 'var(--terra)', border: '1px solid rgba(196,103,58,0.2)' }}>
                🔑 Admin
              </span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  const CommunityRow = ({ community }: { community: any }) => (
    <Link href={`/community/${community.id}`}>
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ borderRadius: '16px' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(196,103,58,0.1)', border: '1px solid rgba(196,103,58,0.12)' }}>
          {community.cover_image_url
            ? <img src={community.cover_image_url} alt={community.name} className="w-full h-full object-cover" />
            : community.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-sm" style={{ letterSpacing: '-0.01em', color: 'var(--terra-dark)' }}>
            {community.name}
          </p>
          {community.description && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--terra-mid)' }}>{community.description}</p>
          )}
        </div>
        {!community.is_public && (
          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(232,221,208,0.7)', color: 'var(--terra-dark)' }}>Privat</span>
        )}
      </div>
    </Link>
  )

  return (
    <div className="max-w-lg mx-auto">

      {/* Search + filter subbar — sits below NavBar's header */}
      <div
        className="glass"
        style={{ position: 'sticky', top: 64, zIndex: 30, borderRadius: '16px', margin: '8px 16px 0' }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="flex items-center overflow-hidden transition-all duration-300 rounded-full"
            style={{
              width: searchOpen ? '100%' : '40px',
              minWidth: searchOpen ? '0' : '40px',
              flexShrink: searchOpen ? 1 : 0,
              background: 'rgba(255,248,243,0.7)',
              border: '1px solid rgba(196,103,58,0.2)',
              backdropFilter: 'blur(10px)',
            }}>
            <button onClick={searchOpen ? undefined : openSearch}
              className="w-10 h-9 flex items-center justify-center flex-shrink-0" aria-label="Søk">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
              </svg>
            </button>
            {searchOpen && (
              <>
                <input ref={searchInputRef} type="text" value={query}
                  onChange={e => search(e.target.value)}
                  placeholder="Søk etter kretser…"
                  className="flex-1 bg-transparent text-sm text-[#2C1A0E] outline-none placeholder:text-[#C4A882] pr-2"
                  style={{ minWidth: 0 }} />
                <button onClick={closeSearch}
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0 text-[#9C7B65] text-xl pr-1">×</button>
              </>
            )}
          </div>

          {!searchOpen && adminCommunities.length > 0 && (
            <button onClick={() => setFilterAdminOnly(f => !f)}
              className="flex-1 h-9 rounded-full text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: filterAdminOnly ? 'var(--terra)' : 'rgba(255,248,243,0.7)',
                border: `1px solid ${filterAdminOnly ? 'var(--terra)' : 'rgba(196,103,58,0.2)'}`,
                backdropFilter: 'blur(10px)',
                color: filterAdminOnly ? 'white' : 'var(--terra)',
                letterSpacing: '-0.01em',
                outline: 'none',
              }}>
              {filterAdminOnly ? '🔑 Jeg administrerer' : 'Alle kretser'}
            </button>
          )}

          {!searchOpen && (
            <Link href="/community/new" className="flex-shrink-0">
              <div className="h-9 px-4 flex items-center justify-center rounded-full text-xs font-medium whitespace-nowrap"
                style={{ background: 'var(--terra)', color: 'white', letterSpacing: '-0.01em' }}>
                + Opprett
              </div>
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-28 flex flex-col gap-8">

        {query.length >= 2 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Søkeresultater</p>
            {searchResults.length === 0 ? (
              <div className="glass rounded-2xl p-5 text-center text-sm text-[#9C7B65]">Ingen treff for «{query}»</div>
            ) : (
              <div className="flex flex-col gap-2">
                {searchResults.map(c => {
                  const isMine = [...adminCommunities, ...memberCommunities].some((m: any) => m.communities?.id === c.id)
                  return (
                    <div key={c.id} className="relative">
                      <CommunityRow community={c} />
                      {isMine && (
                        <span className="absolute top-3.5 right-4 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(74,124,89,0.12)', color: 'var(--terra-green)' }}>
                          Du er med
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
            {displayedCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>
                  {filterAdminOnly
                    ? `Kretser jeg administrerer (${displayedCommunities.length})`
                    : `Dine kretser (${displayedCommunities.length})`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {displayedCommunities.map((m: any) => (
                    <CommunityCardGraphic key={m.communities?.id} entry={m} showFavorite />
                  ))}
                </div>
              </div>
            )}

            {allMyCommunities.length === 0 && !loading && (
              <div className="glass rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">🏘️</div>
                <p className="font-semibold text-[#2C1A0E] mb-1" style={{ letterSpacing: '-0.01em' }}>Ingen kretser ennå</p>
                <p className="text-sm text-[#9C7B65] mb-5">Opprett en krets eller bli invitert av en venn</p>
                <Link href="/community/new">
                  <button className="btn-primary w-full">+ Opprett din første krets</button>
                </Link>
              </div>
            )}

            {friendCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>
                  Utforsk — venners kretser
                </p>
                <div className="flex flex-col gap-2">
                  {friendCommunities.map((m: any) => (
                    <CommunityRow key={m.communities?.id} community={m.communities} />
                  ))}
                </div>
              </div>
            )}

            {!hasFriends && popularCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--terra-mid)' }}>
                  Populære kretser nær deg
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--terra-mid)' }}>Legg til venner for å se kretser de er med i</p>
                <div className="flex flex-col gap-2">
                  {popularCommunities.map((c: any) => (
                    <CommunityRow key={c.id} community={c} />
                  ))}
                </div>
              </div>
            )}

            {allMyCommunities.length > 0 && (
              <Link href="/community/new">
                <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--terra)' }}>
                  <div>
                    <p className="text-white font-semibold" style={{ letterSpacing: '-0.01em' }}>Start en ny krets</p>
                    <p className="text-white/70 text-sm mt-0.5">For nabolaget, vennegjengen eller familien</p>
                  </div>
                  <span className="text-white text-xl">→</span>
                </div>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}
