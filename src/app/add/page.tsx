# Patch-instruksjoner for src/app/add/page.tsx
# Tre endringer må gjøres manuelt eller ved å levere filen på nytt

## Endring 1 — Importer useSearchParams
# Bytt ut:
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

# Med:
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

---

## Endring 2 — Les query params øverst i komponenten
# Legg til rett etter: const router = useRouter()

  const searchParams = useSearchParams()

---

## Endring 3 — Forhåndsutfyll fra params i useEffect
# Bytt ut den eksisterende useEffect/load():

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('location').eq('id', user.id).single()
      if (prof?.location) setLocation(prof.location)

      // Forhåndsutfyll fra query params (brukes av "Spør kretsen" / "Jeg har dette!"-flyt)
      const paramName     = searchParams.get('name')
      const paramCategory = searchParams.get('category')
      const paramImageUrl = searchParams.get('image_url')

      if (paramName)     setName(paramName)
      if (paramCategory) setCategory(paramCategory)
      if (paramImageUrl) {
        setImagePreview(paramImageUrl)
        // Ikke sett imageFile — URL brukes direkte ved lagring
        setSuggestedImageUrl(paramImageUrl)
        setSelectedImage('suggested')
      }
    }
    load()
  }, [])
