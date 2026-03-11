'use client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreatedPage() {
  const { id } = useParams()
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#FAF7F2]">
      <div className="bg-white rounded-3xl p-8 shadow-sm max-w-sm w-full flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#EEF4F0] flex items-center justify-center text-4xl">
          ✅
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#2C1A0E]">Krets opprettet!</h1>
          <p className="text-sm text-[#9C7B65] mt-1">Hva vil du gjøre nå?</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Link href={`/community/${id}/invite-friends`}>
            <button className="w-full bg-[#C4673A] text-white rounded-xl py-3 font-medium">
              👥 Inviter venner
            </button>
          </Link>
          <Link href={`/community/${id}/share`}>
            <button className="w-full bg-white border border-[#E8DDD0] text-[#2C1A0E] rounded-xl py-3 font-medium">
              📦 Legg til gjenstander
            </button>
          </Link>
          <Link href={`/community/${id}`}>
            <button className="w-full text-[#9C7B65] text-sm py-2">
              Gå til kretsen →
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}