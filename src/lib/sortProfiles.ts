// src/lib/sortProfiles.ts

export function sortProfilesWithConnectionFirst(
  profiles: any[],
  connectedProfileId: string | null
): any[] {
  return [...profiles].sort((a, b) => {
    if (a.id === connectedProfileId) return -1
    if (b.id === connectedProfileId) return 1
    return a.name.localeCompare(b.name, 'no')
  })
}