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
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [closeFriends, setCloseFriends] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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

  // Graphic community card — image-dominant with text overlay
  const CommunityCardGraphic = ({ entry, role, showFavorite = false }: {
    entry: any, role?: string, showFavorite?: boolean
  }) => {
    const community = entry.communities || entry
    const memberCount = community.member_count ?? null
    const itemCount = community.item_count ?? null

    return (
      <Link href={`/community/${community.id}`}>
        <div
          className="relative overflow-hidden rounded-[20px] aspect-[4/3] cursor-pointer group"
          style={{
            border: '1px solid rgba(196,103,58,0.15)',
            boxShadow: '0 2px 20px rgba(44,26,14,0.08)',
          }}
        >
          {/* Background image or gradient */}
          {community.cover_image_url ? (
            <img
              src={community.cover_image_url}
              alt={community.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255,240,230,1) 0%, rgba(232,221,208,1) 60%, rgba(196,103,58,0.15) 100%)',
              }}
            >
              <span style={{ fontSize: '52px', opacity: 0.35 }}>{community.avatar_emoji}</span>
            </div>
          )}

          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(44,26,14,0.82) 0%, rgba(44,26,14,0.25) 55%, transparent 100%)',
            }}
          />

          {/* Top row: emoji + favorite star */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {!community.cover_image_url && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(255,248,243,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)' }}
              >
                {community.avatar_emoji}
              </div>
            )}
            {community.cover_image_url && <div />}
            <div className="flex items-center gap-1.5">
              {!community.is_public && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,248,243,0.65)', backdropFilter: 'blur(10px)', color: 'var(--terra-dark)', border: '1px solid rgba(255,255,255,0.4)' }}
                >
                  🔒 Privat
                </span>
              )}
              {showFavorite && (
                <button
                  onClick={e => { e.preventDefault(); toggleFavorite(community.id) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ background: 'rgba(255,248,243,0.65)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)' }}
                >
                  <span style={{ opacity: favorites.has(community.id) ? 1 : 0.4 }}>⭐</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom text overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-5"
          >
            <p className="font-display text-white font-semibold truncate" style={{ fontSize: '15px', letterSpacing: '-0.02em', textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
              {community.name}
            </p>
            {community.description && (
              <p className="text-white/70 text-xs truncate mt-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                {community.description}
              </p>
            )}
            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5">
              {role && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: 'rgba(196,103,58,0.85)', color: 'white', backdropFilter: 'blur(6px)' }}
                >
                  {role === 'admin' ? '⭐ Admin' : 'Medlem'}
                </span>
              )}
              {memberCount !== null && (
                <span className="text-xs text-white/70 flex-shrink-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  👥 {memberCount}
                </span>
              )}
              {itemCount !== null && (
                <span className="text-xs text-white/70 flex-shrink-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  📦 {itemCount} ting
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Simple row card for search results & friend communities
  const CommunityRow = ({ community, role }: { community: any, role?: string }) => (
    <Link href={`/community/${community.id}`}>
      <div className="glass rounded-2xl px-4 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(255,240,230,0.7)' }}>
          {community.cover_image_url
            ? <img src={community.cover_image_url} alt={community.name} className="w-full h-full object-cover" />
            : community.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#2C1A0E] truncate" style={{ letterSpacing: '-0.01em' }}>{community.name}</p>
            {!community.is_public && (
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(232,221,208,0.7)', color: 'var(--terra-dark)' }}>Privat</span>
            )}
          </div>
          {community.description && (
            <p className="text-xs text-[#9C7B65] mt-0.5 truncate">{community.description}</p>
          )}
          {role && (
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--terra-green)' }}>
              {role === 'admin' ? '⭐ Administrator' : 'Medlem'}
            </p>
          )}
        </div>
      </div>
    </Link>
  )

  // All communities the user is part of (admin + member combined, admins first)
  const myCommunities = [...sortByFavorite(adminCommunities).map((m: any) => ({ ...m, derivedRole: 'admin' })), ...sortByFavorite(memberCommunities).map((m: any) => ({ ...m, derivedRole: 'member' }))]

  return (
    <div className="max-w-lg mx-auto pb-24">

      {/* Sticky top header */}
      <header className="page-header glass" style={{ borderRadius: '0 0 20px 20px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="flex items-center justify-between px-4 pt-10 pb-3">
          <h1 className="page-header-title font-display">Kretser</h1>
        </div>

        {/* Three action buttons */}
        <div className="px-4 pb-4 flex items-center gap-2">

          {/* Search button — expands horizontally */}
          <div
            className="flex items-center gap-2 overflow-hidden transition-all duration-300 rounded-full"
            style={{
              width: searchOpen ? '100%' : '44px',
              minWidth: searchOpen ? '0' : '44px',
              background: 'rgba(255,248,243,0.7)',
              border: '1px solid rgba(196,103,58,0.2)',
              backdropFilter: 'blur(10px)',
              flexShrink: searchOpen ? 1 : 0,
            }}
          >
            <button
              onClick={searchOpen ? undefined : openSearch}
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              aria-label="Søk"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
            {searchOpen && (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={e => search(e.target.value)}
                  placeholder="Søk etter kretser…"
                  className="flex-1 bg-transparent text-sm text-[#2C1A0E] outline-none placeholder:text-[#C4A882] pr-2"
                  style={{ minWidth: 0 }}
                />
                <button onClick={closeSearch} className="w-9 h-10 flex items-center justify-center flex-shrink-0 text-[#9C7B65] text-lg pr-1">
                  ×
                </button>
              </>
            )}
          </div>

          {/* "Kretser jeg administrerer" — only show if not search open */}
          {!searchOpen && (
            <>
              <Link href="#mine-admin" scroll={false} onClick={e => {
                e.preventDefault()
                document.getElementById('mine-admin')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
                className="flex-1"
              >
                <div
                  className="h-10 flex items-center justify-center rounded-full text-xs font-medium text-center px-2 transition-colors"
                  style={{
                    background: 'rgba(255,248,243,0.7)',
                    border: '1px solid rgba(196,103,58,0.2)',
                    backdropFilter: 'blur(10px)',
                    color: 'var(--terra)',
                    letterSpacing: '-0.01em',
                    lineHeight: '1.2',
                  }}
                >
                  Kun mine kretser
                </div>
              </Link>

              <Link href="/community/new" className="flex-shrink-0">
                <div
                  className="h-10 px-4 flex items-center justify-center rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    background: 'var(--terra)',
                    color: 'white',
                    letterSpacing: '-0.01em',
                  }}
                >
                  + Opprett krets
                </div>
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="px-4 pt-5 flex flex-col gap-8">

        {/* SEARCH RESULTS */}
        {query.length >= 2 && (
          <div>
            <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">Søkeresultater</p>
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
                        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium"
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
            {/* === KRETSER DU ER MED I (combined — most important section) === */}
            {myCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">
                  Dine kretser ({myCommunities.length})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {myCommunities.map((m: any) => (
                    <CommunityCardGraphic
                      key={m.communities?.id}
                      entry={m}
                      role={m.derivedRole}
                      showFavorite
                    />
                  ))}
                </div>
              </div>
            )}

            {/* === KRETSER JEG ADMINISTRERER (anchor target) === */}
            <div id="mine-admin">
              {adminCommunities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">
                    Kun kretser jeg administrerer ({adminCommunities.length})
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {sortByFavorite(adminCommunities).map((m: any) => (
                      <CommunityCardGraphic
                        key={m.communities?.id}
                        entry={m}
                        role="admin"
                        showFavorite
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* === NÆRE VENNER === */}
            <div
              className="rounded-3xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255,240,230,0.8) 0%, rgba(250,247,242,0.8) 100%)',
                border: '1px solid rgba(196,103,58,0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-semibold text-[#2C1A0E]" style={{ letterSpacing: '-0.01em' }}>❤️ Nære venner</p>
                  <p className="text-xs text-[#9C7B65] mt-0.5">{closeFriends.length} {closeFriends.length === 1 ? 'person' : 'personer'}</p>
                </div>
                <Link href="/close-friends">
                  <button className="btn-glass text-xs px-3 py-1.5 rounded-full" style={{ fontSize: '12px' }}>Rediger</button>
                </Link>
              </div>
              {closeFriends.length === 0 ? (
                <p className="text-sm text-[#9C7B65]">Legg til nære venner for å dele eksklusivt innhold</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {closeFriends.map((cf: any) => (
                    <div key={cf.friend_id} className="flex items-center gap-1.5 bg-white/60 rounded-full px-3 py-1.5" style={{ backdropFilter: 'blur(8px)' }}>
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

            {/* === TOM STATE === */}
            {adminCommunities.length === 0 && memberCommunities.length === 0 && !loading && (
              <div className="glass rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">🏘️</div>
                <p className="font-semibold text-[#2C1A0E] mb-1" style={{ letterSpacing: '-0.01em' }}>Ingen kretser ennå</p>
                <p className="text-sm text-[#9C7B65] mb-5">Opprett en krets eller bli invitert av en venn</p>
                <Link href="/community/new">
                  <button className="btn-primary w-full">+ Opprett din første krets</button>
                </Link>
              </div>
            )}

            {/* === VENNERS KRETSER === */}
            {friendCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C7B65] uppercase tracking-wide mb-3">
                  Utforsk — venner er med
                </p>
                <div className="flex flex-col gap-2">
                  {friendCommunities.map((m: any) => (
                    <CommunityRow key={m.communities?.id} community={m.communities} />
                  ))}
                </div>
              </div>
            )}

            {/* === START NY KRETS CTA (only if already member of some) === */}
            {myCommunities.length > 0 && (
              <Link href="/community/new">
                <div
                  className="rounded-2xl p-5 flex items-center justify-between"
                  style={{ background: 'var(--terra)' }}
                >
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
