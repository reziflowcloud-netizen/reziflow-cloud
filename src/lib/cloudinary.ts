import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

export type CloudinaryDocumentResource = {
  publicId?: string | null
  fileType?: string | null
  storageProvider?: string | null
  storagePath?: string | null
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured')
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true })
  return { cloudName }
}

export async function uploadAuthenticatedCloudinaryDocument(args: {
  bytes: Buffer
  folder: string
  resourceType: 'image' | 'raw'
}): Promise<UploadApiResponse> {
  configureCloudinary()

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_chunked_stream(
      {
        folder: args.folder,
        resource_type: args.resourceType,
        type: 'authenticated',
        access_mode: 'authenticated',
        overwrite: false,
        unique_filename: true,
        chunk_size: 6_000_000,
      },
      (error, result) => {
        if (error || !result?.public_id) reject(error || new Error('Cloudinary upload failed'))
        else resolve(result)
      },
    )
    stream.end(args.bytes)
  })
}

export function getAuthenticatedCloudinaryDocumentUrl(args: {
  publicId: string
  resourceType: 'image' | 'raw'
  version?: number | null
}) {
  configureCloudinary()
  return cloudinary.url(args.publicId, {
    secure: true,
    sign_url: true,
    type: 'authenticated',
    resource_type: args.resourceType,
    version: args.version || undefined,
  })
}

export async function deleteCloudinaryResource(
  publicId: string | null | undefined,
  options?: { resourceType?: 'image' | 'raw' | 'video'; authenticated?: boolean },
) {
  if (!publicId || String(publicId).startsWith('local:')) return false
  try {
    configureCloudinary()
  } catch {
    return false
  }

  const resourceTypes: Array<'image' | 'raw' | 'video'> = options?.resourceType
    ? [options.resourceType]
    : ['image', 'raw', 'video']
  for (const resourceType of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: options?.authenticated ? 'authenticated' : 'upload',
        invalidate: true,
      })
      if (result?.result === 'ok') return true
    } catch (error) {
      console.error('Cloudinary delete error:', error instanceof Error ? error.name : 'UnknownError')
    }
  }
  return false
}

export async function deleteCloudinaryResources(publicIds: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(publicIds.filter(Boolean).map(String)))
  const results = await Promise.allSettled(uniqueIds.map(publicId => deleteCloudinaryResource(publicId)))
  return results.filter(result => result.status === 'fulfilled' && result.value).length
}

export async function deleteCloudinaryDocumentResources(documents: CloudinaryDocumentResource[]) {
  const uniqueDocuments = Array.from(
    new Map(
      documents
        .filter(document => document.publicId && !String(document.publicId).startsWith('local:') && document.storageProvider !== 'dropbox')
        .map(document => [String(document.publicId), document]),
    ).values(),
  )
  const results = await Promise.allSettled(uniqueDocuments.map(document => deleteCloudinaryResource(document.publicId, {
    authenticated: document.storageProvider === 'cloudinary_authenticated',
    resourceType: document.storagePath === 'raw' || document.fileType === 'pdf' ? 'raw' : 'image',
  })))
  return results.filter(result => result.status === 'fulfilled' && result.value).length
}
