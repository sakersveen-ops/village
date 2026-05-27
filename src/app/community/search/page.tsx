// Path of this file: src/app/community/search/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { track } from '@/lib/track'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function communityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// ─── First-time modal ─────────────────────────────────────────────────────────
function FirstTimeKretserModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" onClick={onDismiss} />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-5 p-6" style={{ borderRadius: 24, zIndex: 61 }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(46,98,113,0.1)', border: '1px solid rgba(46,98,113,0.14)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            Hva er kretser?
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {[
            {
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              title: 'Grupper du stoler på',
              desc: 'Nabolag, barnehage, idrettslag, vennegjengen – du bestemmer hvem som er med.',
            },
            {
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              title: 'Del på dine premisser',
              desc: 'Du velger hvilke gjenstander som er synlige i hvilken krets.',
            },
            {
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
              title: 'Få relevante varsler',
              desc: 'Kun ting fra kretser du er med i dukker opp i feeden din.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(46,98,113,0.08)' }}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--terra-dark)' }}>{title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--terra-mid)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/community/new" onClick={onDismiss}>
            <button className="btn-primary w-full" style={{ borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600 }}>
              + Opprett din første krets
            </button>
          </Link>
          <button onClick={onDismiss} className="text-sm py-2 text-center" style={{ color: 'var(--terra-mid)' }}>
            Utforsk først
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [showFirstTime, setShowFirstTime] = useState(false)
  // IDs of "utforsk"-communities the user has dismissed
  const [dismissedExplore, setDismissedExplore] = useState<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Load dismissed explore IDs from localStorage
      const dismissedKey = `village_dismissed_explore_${user.id}`
      const stored = localStorage.getItem(dismissedKey)
      const dismissed = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
      setDismissedExplore(dismissed)

      const { data: mine } = await supabase
        .from('community_members')
        .select('role, status, communities(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const admins = (mine || []).filter((m: any) => m.role === 'admin')
      const members = (mine || []).filter((m: any) => m.role === 'member')
      setAdminCommunities(admins)
      setMemberCommunities(members)

      const hasSeenKey = `village_kretser_intro_${user.id}`
      if ((mine || []).length === 0 && !localStorage.getItem(hasSeenKey)) {
        setShowFirstTime(true)
      }

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

      const myIds = new Set((mine || []).map((m: any) => m.communities?.id).filter(Boolean))

      if (friendIds.length > 0) {
        const { data: friendMembers } = await supabase
          .from('community_members')
          .select('communities(*)')
          .in('user_id', friendIds)
          .eq('status', 'active')
        const seen = new Set<string>()
        const unique = (friendMembers || []).filter((m: any) => {
          const cid = m.communities?.id
          if (!cid || myIds.has(cid) || seen.has(cid) || !m.communities?.is_public) return false
          seen.add(cid)
          return true
        })
        setFriendCommunities(unique)
      } else {
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

  const dismissFirstTime = () => {
    if (user) localStorage.setItem(`village_kretser_intro_${user.id}`, '1')
    setShowFirstTime(false)
    track('kretser_first_time_dismissed')
  }

  const dismissExplore = (communityId: string) => {
    const updated = new Set(dismissedExplore)
    updated.add(communityId)
    setDismissedExplore(updated)
    if (user) {
      localStorage.setItem(`village_dismissed_explore_${user.id}`, JSON.stringify([...updated]))
    }
    track('explore_community_dismissed', { community_id: communityId })
  }

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

  // Filtered explore lists — hide dismissed entries
  const visibleFriendCommunities = friendCommunities.filter(
    (m: any) => !dismissedExplore.has(m.communities?.id)
  )
  const visiblePopularCommunities = popularCommunities.filter(
    (c: any) => !dismissedExplore.has(c.id)
  )

  // ─── Community avatar — initials fallback, no emoji ────────────────────────
  const CommunityAvatar = ({ community, size = 44 }: { community: any; size?: number }) => {
    if (community.cover_image_url) {
      return (
        <img
          src={community.cover_image_url}
          alt={community.name}
          className="w-full h-full object-cover"
        />
      )
    }
    const initials = communityInitials(community.name)
    // Generate a deterministic hue from the community name
    const hue = community.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
    return (
      <div
        className="w-full h-full flex items-center justify-center font-display font-bold"
        style={{
          background: `hsl(${hue}, 28%, 88%)`,
          color: `hsl(${hue}, 30%, 32%)`,
          fontSize: size * 0.38,
          letterSpacing: '-0.02em',
        }}
      >
        {initials}
      </div>
    )
  }

  // ─── Card (grid) ──────────────────────────────────────────────────────────
  const CommunityCardGraphic = ({ entry, showFavorite = false }: { entry: any; showFavorite?: boolean }) => {
    const community = entry.communities || entry
    const isAdmin = entry.derivedRole === 'admin'

    if (community.cover_image_url) {
      return (
        <Link href={`/community/${community.id}`}>
          <div className="relative overflow-hidden rounded-[20px] aspect-[4/3] cursor-pointer group"
            style={{ border: '1px solid rgba(46,98,113,0.18)', boxShadow: '0 2px 20px rgba(26,37,48,0.08)' }}>
            <img src={community.cover_image_url} alt={community.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(26,37,48,0.82) 0%, rgba(26,37,48,0.2) 55%, transparent 100%)' }} />
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div />
              <div className="flex items-center gap-1.5">
                {!community.is_public && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(252,254,255,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: 'var(--terra-dark)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                )}
                {showFavorite && (
                  <button onClick={e => { e.preventDefault(); toggleFavorite(community.id) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: 'rgba(252,254,255,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24"
                      fill={favorites.has(community.id) ? 'var(--terra)' : 'none'}
                      stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
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
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1.5"
                  style={{ background: 'rgba(46,98,113,0.85)', color: 'white' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                  Admin
                </span>
              )}
            </div>
          </div>
        </Link>
      )
    }

    // No cover image — clean initials card
    const initials = communityInitials(community.name)
    const hue = community.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360

    return (
      <Link href={`/community/${community.id}`}>
        <div className="item-card glass-hover rounded-[20px] overflow-hidden cursor-pointer"
          style={{ border: '1px solid rgba(46,98,113,0.18)', boxShadow: '0 2px 16px rgba(26,37,48,0.06)' }}>
          <div className="relative flex items-center justify-center"
            style={{ height: '100px', background: `hsl(${hue}, 22%, 92%)` }}>
            <span className="font-display font-bold select-none"
              style={{ fontSize: '32px', color: `hsl(${hue}, 28%, 38%)`, letterSpacing: '-0.03em' }}>
              {initials}
            </span>
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {!community.is_public && (
                <span className="w-6 h-6 flex items-center justify-center rounded-full"
                  style={{ background: 'rgba(252,254,255,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
              )}
              {showFavorite && (
                <button onClick={e => { e.preventDefault(); toggleFavorite(community.id) }}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ background: 'rgba(252,254,255,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24"
                    fill={favorites.has(community.id) ? 'var(--terra)' : 'none'}
                    stroke="var(--terra)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="glass-card px-3 py-2.5">
            <p className="font-display font-semibold truncate"
              style={{ fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--terra-dark)' }}>
              {community.name}
            </p>
            {community.description && (
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--terra-mid)' }}>{community.description}</p>
            )}
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1.5"
                style={{ background: 'rgba(46,98,113,0.1)', color: 'var(--terra)', border: '1px solid rgba(46,98,113,0.18)' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                Admin
              </span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // ─── Row (list) ───────────────────────────────────────────────────────────
  const CommunityRow = ({
    community,
    dismissible = false,
  }: {
    community: any
    dismissible?: boolean
  }) => (
    <div className="relative group">
      <Link href={`/community/${community.id}`}>
        <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 pr-10"
          style={{ borderRadius: '16px' }}>
          <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden"
            style={{ border: '1px solid rgba(46,98,113,0.12)' }}>
            <CommunityAvatar community={community} size={44} />
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--terra-mid)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
        </div>
      </Link>
      {dismissible && (
        <button
          onClick={() => dismissExplore(community.id)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-opacity opacity-40 hover:opacity-100 active:scale-90"
          style={{ background: 'rgba(46,98,113,0.08)' }}
          aria-label="Skjul denne kretsen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--terra-dark)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      {/* Search + filter subbar */}
      <div className="glass" style={{ position: 'sticky', top: 64, zIndex: 30, borderRadius: '16px', margin: '8px 16px 0' }}>
        <div className="px-4 py-3 flex items-center gap-2">
          {/* Search pill */}
          <div className="flex items-center overflow-hidden transition-all duration-300 rounded-full"
            style={{
              width: searchOpen ? '100%' : '40px',
              minWidth: searchOpen ? '0' : '40px',
              flexShrink: searchOpen ? 1 : 0,
              background: 'rgba(252,254,255,0.7)',
              border: '1px solid rgba(46,98,113,0.2)',
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
                  className="flex-1 bg-transparent text-sm outline-none pr-2"
                  style={{ color: 'var(--terra-dark)', minWidth: 0 }} />
                <button onClick={closeSearch}
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ color: 'var(--terra-mid)', fontSize: 20 }}>×</button>
              </>
            )}
          </div>

          {/* Filter button — only when user has admin communities */}
          {!searchOpen && adminCommunities.length > 0 && (
            <button
              onClick={() => setFilterAdminOnly(f => !f)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium transition-all flex-shrink-0"
              style={{
                background: filterAdminOnly ? 'var(--terra)' : 'rgba(252,254,255,0.7)',
                border: `1px solid ${filterAdminOnly ? 'var(--terra)' : 'rgba(46,98,113,0.2)'}`,
                backdropFilter: 'blur(10px)',
                color: filterAdminOnly ? 'white' : 'var(--terra)',
                letterSpacing: '-0.01em',
                outline: 'none',
              }}>
              {/* Filter icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              {filterAdminOnly ? 'Mine' : 'Filter'}
            </button>
          )}

          {/* Opprett */}
          {!searchOpen && (
            <Link href="/community/new" className="flex-shrink-0 ml-auto">
              <div className="h-9 px-4 flex items-center justify-center rounded-full text-xs font-medium whitespace-nowrap"
                style={{ background: 'var(--terra)', color: 'white', letterSpacing: '-0.01em' }}>
                + Opprett
              </div>
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-28 flex flex-col gap-8">

        {/* Search results */}
        {query.length >= 2 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>Søkeresultater</p>
            {searchResults.length === 0 ? (
              <div className="glass rounded-2xl p-5 text-center text-sm" style={{ color: 'var(--terra-mid)' }}>
                Ingen treff for «{query}»
              </div>
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
            {/* Mine kretser */}
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

            {/* Empty state */}
            {allMyCommunities.length === 0 && !loading && (
              <div className="glass rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(46,98,113,0.08)', border: '1px solid rgba(46,98,113,0.12)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <p className="font-semibold mb-1" style={{ color: 'var(--terra-dark)', letterSpacing: '-0.01em' }}>Ingen kretser ennå</p>
                <p className="text-sm mb-5" style={{ color: 'var(--terra-mid)' }}>Opprett en krets eller bli invitert av en venn</p>
                <Link href="/community/new">
                  <button className="btn-primary w-full">+ Opprett din første krets</button>
                </Link>
              </div>
            )}

            {/* Utforsk — venners kretser (dismissible rows) */}
            {visibleFriendCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--terra-mid)' }}>
                  Utforsk — venners kretser
                </p>
                <div className="flex flex-col gap-2">
                  {visibleFriendCommunities.map((m: any) => (
                    <CommunityRow key={m.communities?.id} community={m.communities} dismissible />
                  ))}
                </div>
              </div>
            )}

            {/* Populære kretser (no friends, dismissible) */}
            {!hasFriends && visiblePopularCommunities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--terra-mid)' }}>
                  Populære kretser nær deg
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--terra-mid)' }}>Legg til venner for å se kretser de er med i</p>
                <div className="flex flex-col gap-2">
                  {visiblePopularCommunities.map((c: any) => (
                    <CommunityRow key={c.id} community={c} dismissible />
                  ))}
                </div>
              </div>
            )}

            {/* CTA — start ny krets */}
            {allMyCommunities.length > 0 && (
              <Link href="/community/new">
                <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: 'var(--terra)' }}>
                  <div>
                    <p className="text-white font-semibold" style={{ letterSpacing: '-0.01em' }}>Start en ny krets</p>
                    <p className="text-white/70 text-sm mt-0.5">For nabolaget, vennegjengen eller familien</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            )}
          </>
        )}
      </div>

      {showFirstTime && <FirstTimeKretserModal onDismiss={dismissFirstTime} />}
    </div>
  )
}
