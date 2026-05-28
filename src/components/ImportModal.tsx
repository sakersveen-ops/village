'use client'
// src/components/ImportModal.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
  emoji: string | null
  access: 'public' | 'friends' | 'friends_of_friends'
}

export interface ImportDraft {
  id?: string
  parsed_items: ParsedItem[]
  store: string | null
  order_id: string | null
  source: 'email' | 'paste' | 'image' | 'finn'
}

export const IMPORT_EDIT_KEY = 'village_import_edit'

interface Props {
  draft: ImportDraft | null
  onClose: () => void
  onPublish: (items: ParsedItem[], deletedIndices: number[]) => void
}

const CAT_LABELS: Record<string, string> = {
  'baby-og-barn': 'Baby & barn',
  'klar-og-mote': 'Antrekk',
  boker: 'Bøker',
  annet: 'Annet',
}

const ACCESS_OPTIONS: { value: ParsedItem['access']; label: string }[] = [
  { value: 'friends',            label: '👥 Venner' },
  { value: 'friends_of_friends', label: '🤝 Venners venner' },
  { value: 'public',             label: '🌍 Alle' },
]

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'var(--terra-green)' : value >= 65 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--terra-mid)' }}>AI-sikkerhet</span>
        <span style={{ fontSize: 10, color, fontWeight: 500 }}>{value}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(46,98,113,0.12)', borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function ItemCard({
  item, selected, onToggle, onChange, onEditFull, onDelete,
}: {
  item: ParsedItem
  selected: boolean
  onToggle: () => void
  onChange: (field: keyof ParsedItem, value: any) => void
  onEditFull: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{
        border: `1.5px solid ${selected ? 'rgba(46,98,113,0.45)' : 'rgba(46,98,113,0.12)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        background: selected ? 'rgba(46,98,113,0.05)' : 'rgba(248,251,252,0.97)',
        cursor: 'pointer',
        transition: 'border-color 200ms ease, background 200ms ease',
      }}
      onClick={onToggle}
    >
      {/* Row 1: checkbox + emoji + name + price */}
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

        {/* Emoji */}
        {item.emoji && (
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(46,98,113,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {item.emoji}
          </div>
        )}

        {/* Name */}
        <div style={{ flex: 1 }}>
          <input
            value={item.name}
            onChange={(e) => { e.stopPropagation(); onChange('name', e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', fontWeight: 600, fontSize: 14,
              border: 'none', background: 'transparent',
              color: 'var(--terra-dark)', outline: 'none', padding: 0, fontFamily: 'inherit',
            }}
          />
          {item.brand && (
            <span style={{ fontSize: 11, color: 'var(--terra-mid)', display: 'block', marginTop: 1 }}>
              {item.brand}
            </span>
          )}
        </div>

        {/* Price */}
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--terra-mid)' }}>kr</span>
          <input
            type="number" min={0}
            value={item.price_nok ?? 0}
            onChange={(e) => onChange('price_nok', parseInt(e.target.value) || 0)}
            style={{
              width: 54, fontSize: 12, fontWeight: 600, color: 'var(--terra)',
              background: 'rgba(46,98,113,0.08)', border: 'none', outline: 'none',
              padding: '2px 6px', borderRadius: 20, textAlign: 'right', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--terra-mid)' }}>,-</span>
        </div>
      </div>

      {/* Description */}
      <textarea
        value={item.description}
        onChange={(e) => { e.stopPropagation(); onChange('description', e.target.value) }}
        onClick={(e) => e.stopPropagation()}
        rows={2}
        style={{
          width: '100%', fontSize: 12, color: 'var(--terra-mid)',
          border: 'none', background: 'transparent', outline: 'none',
          resize: 'none', padding: 0, fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 10,
        }}
      />

      {/* Category pills */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries(CAT_LABELS).map(([id, label]) => (
          <button key={id} onClick={() => onChange('category', id as ParsedItem['category'])}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${item.category === id ? 'var(--terra)' : 'rgba(46,98,113,0.18)'}`,
              background: item.category === id ? 'var(--terra)' : 'transparent',
              color: item.category === id ? 'white' : 'var(--terra-mid)', fontFamily: 'inherit',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Access dropdown + action row */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {/* Access dropdown */}
        <div style={{ flex: 1 }}>
          <select
            value={item.access ?? 'friends'}
            onChange={(e) => onChange('access', e.target.value as ParsedItem['access'])}
            style={{
              width: '100%', fontSize: 12, padding: '5px 10px', borderRadius: 10,
              border: '1px solid rgba(46,98,113,0.2)',
              background: 'white', color: 'var(--terra-dark)', fontFamily: 'inherit',
              cursor: 'pointer', appearance: 'auto',
            }}
          >
            {ACCESS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Avanserte endringer */}
        <button onClick={onEditFull}
          style={{
            padding: '5px 12px', borderRadius: 10, fontSize: 12,
            border: '1px solid rgba(46,98,113,0.2)', background: 'transparent',
            color: 'var(--terra)', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 500, whiteSpace: 'nowrap',
          }}>
          ✏️ Avansert
        </button>

        {/* Slett */}
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setConfirmDelete(false)}
              style={{ padding: '5px 8px', borderRadius: 10, fontSize: 11, border: '1px solid rgba(46,98,113,0.2)', background: 'transparent', color: 'var(--terra-mid)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Nei
            </button>
            <button onClick={onDelete}
              style={{ padding: '5px 8px', borderRadius: 10, fontSize: 11, border: '1px solid #dc2626', background: '#dc2626', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Slett
            </button>
          </div>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(46,98,113,0.15)',
              background: 'transparent', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        )}
      </div>

      {/* Metadata fields */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {(['color', 'size', 'age_range'] as const).map((field) => {
          const placeholders = { color: 'Farge', size: 'Størrelse', age_range: 'Aldersgruppe' }
          const val = item[field]
          if (!val) return null
          return (
            <input key={field} value={val as string} onChange={(e) => onChange(field, e.target.value)}
              placeholder={placeholders[field]}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 8,
                border: '1px solid rgba(46,98,113,0.18)',
                color: 'var(--terra-dark)', fontFamily: 'inherit',
                width: field === 'age_range' ? 110 : 90, background: 'white',
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
  const router = useRouter()
  const [items, setItems] = useState<ParsedItem[]>(() =>
    (draft?.parsed_items ?? []).map(it => ({
      ...it,
      price_nok: it.price_nok ?? 0,
      access: (it.access as ParsedItem['access']) ?? 'friends',
      emoji: it.emoji ?? null,
    }))
  )
  const [selected, setSelected] = useState<Set<number>>(
    new Set(draft?.parsed_items.map((_, i) => i) ?? [])
  )
  // Indices that have been hard-deleted in this session (to pass to onPublish for DB cleanup)
  const [deletedIndices, setDeletedIndices] = useState<number[]>([])
  const [publishing, setPublishing] = useState(false)

  if (!draft) return null

  function toggleItem(idx: number) {
    setSelected(prev => {
      const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s
    })
  }

  function updateItem(idx: number, field: keyof ParsedItem, value: any) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function deleteItem(idx: number) {
    // Map real indices before splicing
    setDeletedIndices(prev => [...prev, idx])
    setItems(prev => prev.filter((_, i) => i !== idx))
    setSelected(prev => {
      const s = new Set<number>()
      prev.forEach(i => { if (i < idx) s.add(i); else if (i > idx) s.add(i - 1) })
      return s
    })
  }

  function handleEditFull(idx: number) {
    sessionStorage.setItem(IMPORT_EDIT_KEY, JSON.stringify({
      draft, items, selected: [...selected], editIndex: idx,
    }))
    router.push(`/add?edit_import=${idx}`)
  }

  async function handlePublish() {
    setPublishing(true)
    const chosenItems = items.filter((_, i) => selected.has(i))
    await onPublish(chosenItems, deletedIndices)
    setPublishing(false)
  }

  const selectedCount = selected.size
  const storeLabel = draft.store ? ` fra ${draft.store}` : ''

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 60 }} />
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
          borderRadius: '24px 24px 0 0',
          padding: '0 0 env(safe-area-inset-bottom)',
          maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          // Økt opasitet — mer solid enn standard glass-heavy
          background: 'rgba(245,250,252,0.97)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid rgba(46,98,113,0.18)',
          borderBottom: 'none',
          boxShadow: '0 -4px 40px rgba(26,37,48,0.14)',
        }}
      >
        <div className="drawer-handle" style={{ margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(46,98,113,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 18, color: 'var(--terra-dark)', margin: 0 }}>
                Legg ut gjenstander
              </h2>
              <p style={{ fontSize: 12, color: 'var(--terra-mid)', marginTop: 2 }}>
                {items.length} {items.length === 1 ? 'produkt funnet' : 'produkter funnet'}
                {storeLabel} · Velg og rediger
              </p>
            </div>
            <button onClick={onClose}
              style={{
                background: 'rgba(46,98,113,0.08)', border: 'none',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 13, color: 'var(--terra-mid)', cursor: 'pointer',
              }}>
              Avbryt
            </button>
          </div>
        </div>

        {/* Item list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(240,247,250,0.6)' }}>
          {items.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--terra-mid)', fontSize: 13, padding: '32px 0' }}>
              Ingen gjenstander igjen
            </p>
          ) : items.map((item, i) => (
            <ItemCard
              key={i}
              item={item}
              selected={selected.has(i)}
              onToggle={() => toggleItem(i)}
              onChange={(field, val) => updateItem(i, field, val)}
              onEditFull={() => handleEditFull(i)}
              onDelete={() => deleteItem(i)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(46,98,113,0.1)', background: 'rgba(245,250,252,0.97)' }}>
          <button
            className="btn-primary"
            onClick={handlePublish}
            disabled={selectedCount === 0 || publishing}
            style={{ width: '100%', opacity: selectedCount === 0 ? 0.4 : 1 }}
          >
            {publishing ? 'Legger ut...'
              : selectedCount === 0 ? 'Velg minst én gjenstand'
              : `Legg ut ${selectedCount} ${selectedCount === 1 ? 'gjenstand' : 'gjenstander'}`}
          </button>
        </div>
      </div>
    </>
  )
}
