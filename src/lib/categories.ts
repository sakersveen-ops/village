// src/lib/categories.ts
// Single source of truth for all category taxonomy in Village.
// Used in: item listing, onboarding, search filters, profile filters, schedule filters, VillageStore.

export type AgeRange =
  | '0-3 mnd'
  | '3-6 mnd'
  | '6-12 mnd'
  | '1-2 år'
  | '2-3 år'
  | '3-5 år'
  | '5-8 år'
  | '8-12 år'

export type ClothesSizeDame = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type ClothesSizeHerre = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type ClothesSizeBarn =
  | '86-92'
  | '98-104'
  | '110-116'
  | '122-128'
  | '134-140'
  | '146-152'
  | '158-164'

export type ClothesSize = ClothesSizeDame | ClothesSizeHerre | ClothesSizeBarn

export type SizeGroup = 'dame' | 'herre' | 'barn'

export interface Category {
  id: string
  label: string
  subcategories?: Subcategory[]
  filters?: CategoryFilter[]
}

export interface Subcategory {
  id: string
  label: string
}

export interface CategoryFilter {
  id: string
  label: string
  type: 'age' | 'size'
  options: { id: string; label: string }[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'hjem-og-hage',
    label: 'Hjem & hage',
    subcategories: [
      { id: 'verktoy-og-maskiner', label: 'Verktøy & maskiner' },
      { id: 'hage-og-uteomrader', label: 'Hage & uteområder' },
      { id: 'hjem-generelt', label: 'Hjem generelt' },
      { id: 'annet-hjem', label: 'Annet' },
    ],
  },
  {
    id: 'baby-og-barn',
    label: 'Baby & barn',
    subcategories: [
      { id: 'spise', label: 'Spise' },
      { id: 'leke', label: 'Leke' },
      { id: 'stelle', label: 'Stelle' },
      { id: 'sove', label: 'Sove' },
      { id: 'bade', label: 'Bade' },
      { id: 'ha-pa', label: 'Ha på' },
      { id: 'reise', label: 'Reise' },
      { id: 'gravid', label: 'Gravid' },
    ],
    filters: [
      {
        id: 'alder',
        label: 'Alder',
        type: 'age',
        options: [
          { id: '0-3-mnd', label: '0–3 mnd' },
          { id: '3-6-mnd', label: '3–6 mnd' },
          { id: '6-12-mnd', label: '6–12 mnd' },
          { id: '1-2-ar', label: '1–2 år' },
          { id: '2-3-ar', label: '2–3 år' },
          { id: '3-5-ar', label: '3–5 år' },
          { id: '5-8-ar', label: '5–8 år' },
          { id: '8-12-ar', label: '8–12 år' },
        ],
      },
    ],
  },
  {
    id: 'fest-og-arrangement',
    label: 'Fest & arrangement',
    subcategories: [
      { id: 'dekketoy-og-duker', label: 'Dekketøy & duker' },
      { id: 'bord-stol-og-bar', label: 'Bord, stol & bar' },
      { id: 'telt', label: 'Telt' },
      { id: 'grill', label: 'Grill' },
      { id: 'lyd-lys-scene-og-varme', label: 'Lyd, lys, scene & varme' },
    ],
  },
  {
    id: 'friluft-og-sport',
    label: 'Friluft & sport',
    subcategories: [
      { id: 'skisport', label: 'Skisport' },
      { id: 'jakt-fiske-og-friluftsliv', label: 'Jakt, fiske & friluftsliv' },
      { id: 'sykkelsport', label: 'Sykkelsport' },
      { id: 'vannsport', label: 'Vannsport' },
      { id: 'musikkinstrumenter', label: 'Musikkinstrumenter' },
      { id: 'golf', label: 'Golf' },
      { id: 'annen-sport', label: 'Annen sport' },
    ],
  },
  {
    id: 'klar-og-mote',
    label: 'Klær & mote',
    subcategories: [
      { id: 'bryllup', label: 'Bryllup' },
      { id: 'fest-og-ball', label: 'Fest & ball' },
      { id: 'konfirmasjon', label: 'Konfirmasjon' },
      { id: 'begravelse-og-seremoni', label: 'Begravelse & seremoni' },
      { id: 'hverdag-og-casual', label: 'Hverdag & casual' },
      { id: 'annet-klar', label: 'Annet' },
    ],
    filters: [
      {
        id: 'storrelse-dame',
        label: 'Størrelse dame',
        type: 'size',
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => ({ id: s.toLowerCase(), label: s })),
      },
      {
        id: 'storrelse-herre',
        label: 'Størrelse herre',
        type: 'size',
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => ({ id: s.toLowerCase(), label: s })),
      },
      {
        id: 'storrelse-barn',
        label: 'Størrelse barn',
        type: 'size',
        options: [
          { id: '86-92', label: '86–92' },
          { id: '98-104', label: '98–104' },
          { id: '110-116', label: '110–116' },
          { id: '122-128', label: '122–128' },
          { id: '134-140', label: '134–140' },
          { id: '146-152', label: '146–152' },
          { id: '158-164', label: '158–164' },
        ],
      },
    ],
  },
  {
    id: 'boker',
    label: 'Bøker',
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

export const CATEGORY_IDS = CATEGORIES.map(c => c.id)

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}

export function getCategoryLabel(id: string): string {
  return getCategoryById(id)?.label ?? id
}

export function getSubcategoryLabel(categoryId: string, subcategoryId: string): string {
  const cat = getCategoryById(categoryId)
  return cat?.subcategories?.find(s => s.id === subcategoryId)?.label ?? subcategoryId
}

// Flat list of all subcategory ids for a given category — useful for DB queries
export function getSubcategoryIds(categoryId: string): string[] {
  return getCategoryById(categoryId)?.subcategories?.map(s => s.id) ?? []
}
