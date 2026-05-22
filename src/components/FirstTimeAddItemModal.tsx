'use client'
import { useState } from 'react'

const TOP_SUGGESTIONS: Record<string, string[]> = {
  Barn:      ['Babynest', 'Babybilstol', 'Babygym', 'Balansesykkel', 'Sykkel med pedaler', 'Skiutstyr'],
  Verktøy:   ['Drill', 'Høytrykkspyler', 'Gressklipper', 'Stige', 'Sirkelsag', 'Sliper'],
  Sport:     ['Ski (voksen)', 'Sykkel', 'Telt', 'Kajakk', 'Sovepose', 'Ryggsekk'],
  Bøker:     ['Brettspill', 'Puslespill', 'Fagbøker', 'Barnebøker', 'Kokebøker', 'Romaner'],
  Matlaging: ['Kjøkkenmaskin', 'Vaffelsjern', 'Is-maskin', 'Espressomaskin', 'Sous vide', 'Iskremmaskin'],
  Musikk:    ['Gitar', 'Piano/keyboard', 'Mikrofon', 'Høyttaler', 'Ukulele', 'Forsterker'],
  Hage:      ['Hagesett', 'Paraply/paviljong', 'Hengekøye', 'Gressklipper', 'Kompostbeholder', 'Trillebår'],
}

// Default beskrivelser per gjenstand — brukes som pre-fill i add-skjemaet
export const ITEM_DEFAULT_DESCRIPTIONS: Record<string, string> = {
  'Babynest':            'Myk og trygg babynest, god stand.',
  'Babybilstol':         'Godkjent babybilstol. Rengjort og klar til bruk.',
  'Babygym':             'Aktivitetsgym for de minste. Inkluderer hengende leker.',
  'Balansesykkel':       'Balansesykkel uten pedaler. Passer for barn 2–5 år.',
  'Sykkel med pedaler':  'Barnesykkel med pedaler og støttehjul. God stand.',
  'Skiutstyr':           'Komplett skiutstyr for barn. Oppgi størrelse ved forespørsel.',
  'Drill':               'Elektrisk drill med bor. Lades via medfølgende lader.',
  'Høytrykkspyler':      'Høytrykkspyler, egnet for terrasse, bil og uteplass.',
  'Gressklipper':        'Elektrisk gressklipper. God til mellomstore hager.',
  'Stige':               'Aluminiumsstige. Oppgi ønsket høyde ved forespørsel.',
  'Sirkelsag':           'Sirkelsag med justerbar skjæredybde. Husk verneutstyr.',
  'Sliper':              'Eksentersliper med sandpapir i ulike korn.',
  'Ski (voksen)':        'Alpinski / langrennski. Oppgi ønsket lengde og type.',
  'Sykkel':              'Voksen sykkel, god stand. Oppgi om du ønsker herre/dame.',
  'Telt':                'Telt for X personer. Lett å sette opp, god stand.',
  'Kajakk':              'Kajakk med åre og flytevest. Passer for rolig farvann.',
  'Sovepose':            'Sovepose, egnet ned til X grader.',
  'Ryggsekk':            'Turyggsekk med god støtte og plass til dagsturer.',
  'Kjøkkenmaskin':       'Kjøkkenmaskin med standard tilbehør. God stand.',
  'Vaffelsjern':         'Vaffelsjern, passer standard vaffelmiks.',
  'Is-maskin':           'Ismaskin, lager is på ca. 10 minutter.',
  'Espressomaskin':      'Espressomaskin med dampdyse for melkeskum.',
  'Sous vide':           'Sous vide-stav med stativ. Enkel å bruke.',
  'Iskremmaskin':        'Iskremmaskin, lag hjemmelaget is på 20 minutter.',
  'Gitar':               'Akustisk/elektrisk gitar med bag. God stand.',
  'Piano/keyboard':      'Keyboard med X tangenter og medfølgende strømadapter.',
  'Mikrofon':            'Kondensatormikrofon med kabel/holder.',
  'Høyttaler':           'Bærbar Bluetooth-høyttaler med lang batteritid.',
  'Ukulele':             'Sopran-ukulele, stemt og spilleklar.',
  'Forsterker':          'Gitarforsterker, X watt. Passer øvingsrom.',
  'Hagesett':            'Komplett hagesett med spade, rive og gaffel.',
  'Paraply/paviljong':   'Stor hagepaply / paviljong med stativ.',
  'Hengekøye':           'Hengekøye med opphengssett. Tåler X kg.',
  'Kompostbeholder':     'Kompostbeholder i plast, passer til liten/stor hage.',
  'Trillebår':           'Trillebår i stål med luftgummihjul.',
  'Brettspill':          'Komplett brettspill med alle brikker. God stand.',
  'Puslespill':          'X-brikkers puslespill. Alle brikker til stede.',
  'Fagbøker':            'Fagbøker innen X-fagområde. God stand.',
  'Barnebøker':          'Utvalg barnebøker, ulike aldre.',
  'Kokebøker':           'Kokebøker i god stand.',
  'Romaner':             'Romaner i god stand. Oppgi ønsket sjanger.',
}

const HIDE_MODAL_KEY = 'village_hide_followup_modal'

interface Props {
  ownedItems: string[]
  listedItems?: string[]
  onDismiss: () => void
  // Now receives array of selected items + their default descriptions
  onSelectItems: (items: Array<{ name: string; description: string }>) => void
  isFollowUp?: boolean
}

export default function FirstTimeAddItemModal({
  ownedItems,
  listedItems = [],
  onDismiss,
  onSelectItems,
  isFollowUp = false,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ownedItems.filter(i => !listedItems.includes(i)))
  )
  const [hideForever, setHideForever] = useState(false)

  const remaining = ownedItems.filter(i => !listedItems.includes(i))
  const allSuggestions = Object.values(TOP_SUGGESTIONS).flat()
  const extraSuggestions = allSuggestions
    .filter(i => !remaining.includes(i) && !listedItems.includes(i))
  const combined = [...remaining, ...extraSuggestions]
  const suggestions = combined.slice(0, 8)

  const toggle = (item: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(item) ? next.delete(item) : next.add(item)
      return next
    })
  }

  const handleConfirm = () => {
    if (hideForever) localStorage.setItem(HIDE_MODAL_KEY, '1')
    if (selected.size === 0) {
      onDismiss()
      return
    }
    const items = [...selected].map(name => ({
      name,
      description: ITEM_DEFAULT_DESCRIPTIONS[name] || '',
    }))
    onSelectItems(items)
  }

  const handleDismiss = () => {
    if (hideForever) localStorage.setItem(HIDE_MODAL_KEY, '1')
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center px-4 pb-6">
      <div className="modal-backdrop absolute inset-0" onClick={handleDismiss} />
      <div className="glass-heavy relative w-full max-w-sm flex flex-col gap-5 p-6"
        style={{ borderRadius: 24, zIndex: 61, maxHeight: '85vh', overflowY: 'auto' }}>

        <div className="text-center">
          <span className="text-4xl">🏡</span>
          <h2 className="font-display text-xl font-bold mt-3"
            style={{ color: 'var(--terra-dark)', letterSpacing: '-0.025em' }}>
            {isFollowUp
              ? 'Gjenstand registrert til glede for venner og kjente!'
              : 'Legg ut din første gjenstand'}
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--terra-mid)' }}>
            {isFollowUp
              ? 'Har du flere skatter på lur? Velg det du vil dele videre.'
              : 'Velg en eller flere ting du vil dele med nabolaget.'}
          </p>
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--terra-mid)' }}>
              Velg én eller flere
            </p>
            {suggestions.map(item => {
              const isSelected = selected.has(item)
              return (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className="glass flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                  style={{
                    borderRadius: 12,
                    borderColor: isSelected ? 'rgba(196,103,58,0.5)' : undefined,
                    background: isSelected ? 'rgba(196,103,58,0.08)' : undefined,
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--terra-dark)' }}>{item}</span>
                  <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                    style={{
                      background: isSelected ? 'var(--terra)' : 'transparent',
                      border: isSelected ? 'none' : '2px solid rgba(196,103,58,0.3)',
                    }}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Ikke vis igjen */}
        <button
          onClick={() => setHideForever(prev => !prev)}
          className="flex items-center gap-2.5 text-left"
        >
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{
              background: hideForever ? 'var(--terra)' : 'transparent',
              border: hideForever ? 'none' : '2px solid rgba(46,98,113,0.25)',
            }}>
            {hideForever && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="text-xs" style={{ color: 'var(--terra-mid)' }}>Ikke vis denne igjen</span>
        </button>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            className="btn-primary w-full"
            style={{ borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600 }}
          >
            {selected.size > 0
              ? `Legg ut ${selected.size} gjenstand${selected.size > 1 ? 'er' : ''} →`
              : 'Legg til noe nytt →'}
          </button>
          <button onClick={handleDismiss} className="text-sm py-2 text-center"
            style={{ color: 'var(--terra-mid)' }}>
            {isFollowUp ? 'Nei takk, jeg er ferdig' : 'Avbryt'}
          </button>
        </div>
      </div>
    </div>
  )
}
