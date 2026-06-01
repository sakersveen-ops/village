// Path of this file: src/lib/categories.ts
/**
 * Village — Master kategoridefinisjon
 * Importer herfra overalt. Aldri hardkod kategori-strenger.
 *
 * Brukes i:
 *   src/app/items/add/page.tsx
 *   src/app/items/[id]/page.tsx
 *   src/app/page.tsx (feed)
 *   src/app/search/page.tsx
 *   src/app/profile/[userId]/page.tsx
 *   src/app/schedule/page.tsx
 */

export type AgeGroup =
  | '0-3mnd' | '3-6mnd' | '6-12mnd'
  | '1-2år'  | '2-3år'  | '3-5år'
  | '5-8år'  | '8-12år'

export type Gender = 'dame' | 'herre' | 'barn'

export type Category = {
  id: string
  label: string
  gradient: string
  subcategories: { id: string; label: string }[]
  hasAge?: boolean      // barn
  hasSize?: boolean     // antrekk
  hasColor?: boolean    // barn + antrekk
  hasGenre?: boolean    // bøker
  subcategoryHint?: string // vises under underkategori-pillene
}

// ─── Toppnivå-kategorier ─────────────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  {
    id: 'baby-og-barn',
    label: 'Baby & barn',
    gradient: 'linear-gradient(135deg, #e07b4a 0%, #c4673a 100%)',
    hasAge: true,
    hasColor: true,
    subcategories: [
      { id: 'spise',  label: 'Spise'  },
      { id: 'leke',   label: 'Leke'   },
      { id: 'stelle', label: 'Stelle' },
      { id: 'sove',   label: 'Sove'   },
      { id: 'bade',   label: 'Bade'   },
      { id: 'ha-pa',  label: 'Ha-på'  },
      { id: 'reise',  label: 'Reise'  },
      { id: 'gravid', label: 'Gravid' },
      { id: 'annet',  label: 'Annet'  },
    ],
  },
  {
    id: 'klar-og-mote',
    label: 'Antrekk',
    gradient: 'linear-gradient(135deg, #b86ea0 0%, #7a3a6a 100%)',
    hasSize: true,
    hasColor: true,
    subcategories: [
      { id: 'bryllup',               label: 'Bryllup'               },
      { id: 'fest-og-ball',          label: 'Fest & ball'           },
      { id: 'konfirmasjon',          label: 'Konfirmasjon'          },
      { id: 'begravelse-og-seremoni',label: 'Begravelse & seremoni' },
      { id: 'hverdag-og-casual',     label: 'Hverdag & casual'      },
      { id: 'annet-klar',            label: 'Annet'                 },
    ],
  },
  {
    id: 'boker',
    label: 'Bøker',
    gradient: 'linear-gradient(135deg, #C4673A 0%, #8B3A1E 100%)',
    hasGenre: true,
    subcategories: [
      { id: 'skjonnlitteratur', label: 'Skjønnlitteratur' },
      { id: 'sakprosa',         label: 'Sakprosa'         },
      { id: 'barn-og-ungdom',   label: 'Barn & ungdom'    },
      { id: 'kokebok',          label: 'Kokebok'          },
      { id: 'biografi',         label: 'Biografi'         },
      { id: 'fagbok',           label: 'Fagbok'           },
      { id: 'annet-bok',        label: 'Annet'            },
    ],
  },
  {
    id: 'annet',
    label: 'Annet',
    gradient: 'linear-gradient(135deg, #9C7B65 0%, #6B4226 100%)',
    subcategoryHint: 'Flere kategorier kommer – dette er et tidlig utvalg.',
    subcategories: [
      { id: 'sport-og-fritid',  label: 'Sport & fritid'  },
      { id: 'elektronikk',      label: 'Elektronikk'     },
      { id: 'verktoy',          label: 'Verktøy'         },
      { id: 'kjokken-og-hjem',  label: 'Kjøkken & hjem'  },
      { id: 'hage',             label: 'Hage'            },
      { id: 'annet-annet',      label: 'Annet'           },
    ],
  },
]

// ─── Hjelpefunksjoner ─────────────────────────────────────────────────────────

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}

export function getCategoryLabel(id: string): string {
  return getCategoryById(id)?.label ?? id
}

export function getCategoryGradient(id: string): string {
  return getCategoryById(id)?.gradient
    ?? 'linear-gradient(135deg, #9C7B65 0%, #6B4226 100%)'
}

/** Mapper gamle DB-verdier til nye kategori-IDer */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'barn':     'baby-og-barn',
  'kjole':    'klar-og-mote',
  'verktøy':  'annet',
  'bok':      'boker',
  'annet':    'annet',
  'elektronikk': 'annet',
  'sport':    'annet',
  'hage':     'annet',
  'kjøkken':  'annet',
  'klær':     'klar-og-mote',
}

export function normalizeCategory(cat: string): string {
  return LEGACY_CATEGORY_MAP[cat] ?? cat
}

// ─── Størrelser per kjønn (antrekk) ──────────────────────────────────────────

export const SIZES_BY_GENDER: Record<Gender, string[]> = {
  dame:  ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  herre: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  barn:  ['86–92', '98–104', '110–116', '122–128', '134–140', '146–152', '158–164'],
}

// ─── Aldersgrupper (baby & barn) ──────────────────────────────────────────────

export const AGE_GROUPS: { id: AgeGroup; label: string }[] = [
  { id: '0-3mnd',  label: '0–3 mnd'  },
  { id: '3-6mnd',  label: '3–6 mnd'  },
  { id: '6-12mnd', label: '6–12 mnd' },
  { id: '1-2år',   label: '1–2 år'   },
  { id: '2-3år',   label: '2–3 år'   },
  { id: '3-5år',   label: '3–5 år'   },
  { id: '5-8år',   label: '5–8 år'   },
  { id: '8-12år',  label: '8–12 år'  },
]

// ─── Farger (barn + antrekk) ──────────────────────────────────────────────────

export const COLORS: { id: string; label: string; hex: string; border?: string }[] = [
  { id: 'hvit',      label: 'Hvit',      hex: '#ffffff', border: '#ccc' },
  { id: 'grå',       label: 'Grå',       hex: '#888888' },
  { id: 'svart',     label: 'Svart',     hex: '#222222' },
  { id: 'blå',       label: 'Blå',       hex: '#3a7fbf' },
  { id: 'grønn',     label: 'Grønn',     hex: '#4A7C59' },
  { id: 'rød',       label: 'Rød',       hex: '#e04040' },
  { id: 'rosa',      label: 'Rosa',      hex: '#e07ba0' },
  { id: 'gul',       label: 'Gul',       hex: '#f0c040' },
  { id: 'beige',     label: 'Beige',     hex: '#C4A882' },
  { id: 'flerfarge', label: 'Flerfarge', hex: 'conic-gradient(red,yellow,green,blue,red)' },
]
