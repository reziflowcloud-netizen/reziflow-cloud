export const INSTAGRAM_LEAD_FALLBACK_NAME = 'Лид из Instagram'
const INSTAGRAM_PROFILE_TIMEOUT_MS = 3_000

export type InstagramProfile = {
  id?: string
  name?: string
  username?: string
}

function apiVersion(value: string) {
  return value.startsWith('v') ? value : `v${value || '23.0'}`
}

export async function fetchInstagramProfile(
  instagramScopedId: string,
  accessToken: string,
  version: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramProfile | null> {
  if (!instagramScopedId || !accessToken) return null

  const url = new URL(
    `https://graph.instagram.com/${apiVersion(version)}/${encodeURIComponent(instagramScopedId)}`,
  )
  url.searchParams.set('fields', 'id,name,username')
  url.searchParams.set('access_token', accessToken)

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(INSTAGRAM_PROFILE_TIMEOUT_MS),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data || typeof data !== 'object') return null
    return {
      id: String(data.id || '').trim() || undefined,
      name: String(data.name || '').trim() || undefined,
      username: String(data.username || '').trim() || undefined,
    }
  } catch {
    return null
  }
}

export function instagramProfileValues(profile: InstagramProfile | null | undefined) {
  const name = String(profile?.name || '').trim()
  const username = String(profile?.username || '').trim()
  return {
    fullName: name || (username ? `@${username}` : INSTAGRAM_LEAD_FALLBACK_NAME),
    instagram: username || null,
  }
}
