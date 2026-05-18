export type DropboxSettings = {
  enabled: boolean
  accessToken: string
  rootFolder: string
}

export function getDropboxSettings(settings: unknown): DropboxSettings {
  const raw = settings && typeof settings === 'object' ? settings as Record<string, unknown> : {}
  const rootFolder = String(raw.dropboxRootFolder || '/LegalHub').trim() || '/LegalHub'
  return {
    enabled: raw.dropboxEnabled === true,
    accessToken: String(raw.dropboxAccessToken || '').trim(),
    rootFolder: rootFolder.startsWith('/') ? rootFolder : `/${rootFolder}`,
  }
}

export function sanitizeDropboxSegment(value: string | null | undefined, fallback = 'folder') {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback
}

export function joinDropboxPath(...segments: Array<string | null | undefined>) {
  const clean = segments
    .filter(Boolean)
    .map(segment => String(segment).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
  return `/${clean.join('/')}`.replace(/\/+/g, '/')
}

async function readDropboxError(response: Response) {
  const text = await response.text().catch(() => '')
  try {
    const data = JSON.parse(text)
    return data?.error_summary || data?.error?.['.tag'] || text
  } catch {
    return text || `Dropbox request failed: ${response.status}`
  }
}

export async function uploadDropboxFile(args: {
  accessToken: string
  path: string
  bytes: Buffer
}) {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: args.path,
        mode: 'add',
        autorename: true,
        mute: false,
        strict_conflict: false,
      }),
    },
    body: new Uint8Array(args.bytes),
  })

  if (!response.ok) throw new Error(await readDropboxError(response))
  return await response.json() as {
    id?: string
    name?: string
    path_lower?: string
    path_display?: string
    size?: number
  }
}

export async function downloadDropboxFile(accessToken: string, pathOrId: string) {
  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: pathOrId }),
    },
  })

  if (!response.ok) throw new Error(await readDropboxError(response))
  return response
}

export async function deleteDropboxFile(accessToken: string, pathOrId: string) {
  const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: pathOrId }),
  })

  if (!response.ok) throw new Error(await readDropboxError(response))
  return true
}
