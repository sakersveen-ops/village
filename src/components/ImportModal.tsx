'use client'
// src/components/ImportModal.tsx
// Glass-heavy drawer shown when user arrives at /add?import=<draftId>
// or when user pastes email text manually on the add page.
//
// Usage:
//   const [importDraft, setImportDraft] = useState<ImportDraft | null>(null)
//   <ImportModal draft={importDraft} onClose={() => setImportDraft(null)} onPublish={handlePublishItems} />

import { useState } from 'react'

export interface ParsedItem {
  name: string
  description: string
  category: 'baby-og-barn' | 'klar-og-mote' | 'boker' | 'annet'
  subcategory: string | null
  price_nok: number | null
  color: string | null
  size: string | null
  age_range: string | null
  brand: string | null
  confidence: number
}

export interface ImportDraft {
  id?: string
  parsed_items: ParsedItem[]
  store: string | null
  order_id: string | null
  source: 'email' | 'paste' | 'image' | 'finn'
}

interface Props {
  draft: ImportDraft | null
  onClose: () => void
  // Called with the items the user chose to publish.
  // Caller is responsible for iterating and inserting each item into `items` table.
  onPublish: (items: ParsedItem[]) => void
}

const CAT_LABELS: Record<string, string> = {
  'baby-og-barn': 'Baby & barn',
  'klar-og-mote': 'Antrekk',
  boker: 'Bøker',
  annet: 'Annet',
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 85 ? 'var(--terra-green)' : value >= 65 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--terra-mid)' }}>AI-sikkerhet</span>
        <span style={{ fontSize: 10, color, fontWeight: 500 }}>{value}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(46,98,113,0.12)', borderRadius: 2 }}>
        <div
          style={{
            width: `${value}%`, height: '100%',
            background: color, borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}

function ItemCard({
  item,
  selected,
  onToggle,
  onChange,
}: {
  item: ParsedItem
  selected: boolean
  onToggle: () => void
  onChange: (field: keyof ParsedItem, value: any) => void
}) {
  return (
    <div
      style={{
        border: `1.5px solid ${selected ? 'rgba(46,98,113,0.55)' : 'var(--glass-border)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        background: selected ? 'rgba(46,98,113,0.04)' : 'rgba(252,254,255,0.8)',
        cursor: 'pointer',
        transition: 'border-color 200ms ease, background 200ms ease',
      }}
      onClick={onToggle}
    >
      {/* Row 1: checkbox + name + price */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
            border: `1.5px solid ${selected ? 'var(--terra)' : '#9CA3AF'}`,
            background: selected ? 'var(--terra)' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {selected && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Name (editable) */}
        <div style={{ flex: 1 }}>
          <input
            value={item.name}
            onChange={(e) => { e.stopPropagation(); onChange('name', e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', fontWeight: 600, fontSize: 14,
              border: 'none', background: 'transparent',
              color: 'var(--terra-dark)', outline: 'none', padding: 0,
              fontFamily: 'inherit',
            }}
          />
          {item.brand && (
            <span style={{ fontSize: 11, color: 'var(--terra-mid)', display: 'block', marginTop: 1 }}>
              {item.brand}
            </span>
          )}
        </div>

        {/* Price badge */}
        {item.price_nok && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--terra)',
            background: 'rgba(46,98,113,0.08)', padding: '2px 8px',
            borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            kr {item.price_nok},-
          </span>
        )}
      </div>

      {/* Description (editable) */}
      <textarea
        value={item.description}
        onChange={(e) => { e.stopPropagation(); onChange('description', e.target.value) }}
        onClick={(e) => e.stopPropagation()}
        rows={2}
        style={{
          width: '100%', fontSize: 12, color: 'var(--terra-mid)',
          border: 'none', background: 'transparent', outline: 'none',
          resize: 'none', padding: 0, fontFamily: 'inherit', lineHeight: 1.5,
          marginBottom: 10,
        }}
      />

      {/* Category pills */}
      <div
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        {Object.entries(CAT_LABELS).map(([id, label]) => (
          <button
            key={id}
            onClick={() => onChange('category', id as ParsedItem['category'])}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${item.category === id ? 'var(--terra)' : 'var(--glass-border)'}`,
              background: item.category === id ? 'var(--terra)' : 'transparent',
              color: item.category === id ? 'white' : 'var(--terra-mid)',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Metadata fields (color / size / age_range) */}
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        {(['color', 'size', 'age_range'] as const).map((field) => {
          const placeholders = { color: 'Farge', size: 'Størrelse', age_range: 'Aldersgruppe' }
          const val = item[field]
          if (!val) return null
          return (
            <input
              key={field}
              value={val as string}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder={placeholders[field]}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 8,
                border: '1px solid var(--glass-border)',
                color: 'var(--terra-dark)', fontFamily: 'inherit',
                width: field === 'age_range' ? 110 : 90,
                background: 'white',
              }}
            />
          )
        })}
      </div>

      <ConfidenceBar value={item.confidence} />
    </div>
  )
}

export default function ImportModal({ draft, onClose, onPublish }: Props) {
  const [items, setItems] = useState<ParsedItem[]>(draft?.parsed_items ?? [])
  const [selected, setSelected] = useState<Set<number>>(
    new Set(draft?.parsed_items.map((_, i) => i) ?? [])
  )
  const [publishing, setPublishing] = useState(false)

  if (!draft) return null

  function toggleItem(idx: number) {
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(idx) ? s.delete(idx) : s.add(idx)
      return s
    })
  }

  function updateItem(idx: number, field: keyof ParsedItem, value: any) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  async function handlePublish() {
    setPublishing(true)
    const chosenItems = items.filter((_, i) => selected.has(i))
    await onPublish(chosenItems)
    setPublishing(false)
  }

  const selectedCount = selected.size
  const storeLabel = draft.store ? ` fra ${draft.store}` : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
        style={{ zIndex: 60 }}
      />

      {/* Drawer */}
      <div
        className="glass-heavy"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 61,
          borderRadius: '24px 24px 0 0',
          padding: '0 0 env(safe-area-inset-bottom)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <div className="drawer-handle" style={{ margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                className="font-display"
                style={{ fontSize: 18, color: 'var(--terra-dark)', margin: 0 }}
              >
                Legg ut gjenstander
              </h2>
              <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 2 }}>
                {items.length} {items.length === 1 ? 'produkt funnet' : 'produkter funnet'}
                {storeLabel} · Velg og rediger før du legger ut
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(46,98,113,0.08)', border: 'none',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 13, color: 'var(--terra-mid)', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
          </div>
        </div>

        {/* Scrollable item list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => (
            <ItemCard
              key={i}
              item={item}
              selected={selected.has(i)}
              onToggle={() => toggleItem(i)}
              onChange={(field, val) => updateItem(i, field, val)}
            />
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--glass-border)' }}>
          <button
            className="btn-primary"
            onClick={handlePublish}
            disabled={selectedCount === 0 || publishing}
            style={{ width: '100%', opacity: selectedCount === 0 ? 0.4 : 1 }}
          >
            {publishing
              ? 'Legger ut...'
              : selectedCount === 0
              ? 'Velg minst én gjenstand'
              : `Legg ut ${selectedCount} ${selectedCount === 1 ? 'gjenstand' : 'gjenstander'}`}
          </button>
        </div>
      </div>
    </>
  )
}
