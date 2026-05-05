import crypto from 'crypto'

function signDestroy(publicId: string, timestamp: number, apiSecret: string) {
  return crypto
    .createHash('sha1')
    .update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')
}

export async function deleteCloudinaryResource(publicId: string | null | undefined) {
  if (!publicId || String(publicId).startsWith('local:')) return false

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return false

  const timestamp = Math.round(Date.now() / 1000)
  const signature = signDestroy(publicId, timestamp, apiSecret)
  const body = JSON.stringify({
    public_id: publicId,
    invalidate: true,
    signature,
    api_key: apiKey,
    timestamp,
  })

  for (const resourceType of ['image', 'raw', 'video']) {
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.result === 'ok') return true
    } catch (error) {
      console.error('Cloudinary delete error:', error)
    }
  }

  return false
}

export async function deleteCloudinaryResources(publicIds: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(publicIds.filter(Boolean).map(String)))
  const results = await Promise.allSettled(uniqueIds.map(publicId => deleteCloudinaryResource(publicId)))
  return results.filter(result => result.status === 'fulfilled' && result.value).length
}
